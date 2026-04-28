import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { ITask } from './schemas/task.schema';
import { IGitIntegrationConfig } from './schemas/git-integration.schema';

@Injectable()
export class GitIntegrationService {
  private readonly logger = new Logger(GitIntegrationService.name);

  constructor(
    @InjectModel('Task', 'nexora_tasks') private taskModel: Model<ITask>,
    @InjectModel('GitIntegrationConfig', 'nexora_tasks') private gitConfigModel: Model<IGitIntegrationConfig>,
  ) {}

  // ── Task Key Parsing ──

  parseTaskKeys(text: string): string[] {
    if (!text) return [];
    const pattern = /([A-Z]{2,10}-\d+)/g;
    const matches = text.match(pattern);
    return matches ? [...new Set(matches)] : [];
  }

  async resolveTasksByKeys(taskKeys: string[], orgId?: string): Promise<ITask[]> {
    if (!taskKeys.length) return [];
    const filter: any = {
      taskKey: { $in: taskKeys },
      isDeleted: false,
    };
    if (orgId) filter.organizationId = orgId;
    return this.taskModel.find(filter).exec();
  }

  // ── Git Link Management ──

  async addCommitLink(
    taskId: string,
    commitData: {
      provider: 'github' | 'gitlab' | 'bitbucket';
      url: string;
      title: string;
      author: string;
      authorAvatar?: string;
      sha: string;
      repository: string;
      branch?: string;
    },
  ) {
    const existing = await this.taskModel.findOne({
      _id: taskId,
      'gitLinks.sha': commitData.sha,
      'gitLinks.type': 'commit',
    });
    if (existing) {
      this.logger.debug(`Commit ${commitData.sha} already linked to task ${taskId}`);
      return existing;
    }

    const task = await this.taskModel.findByIdAndUpdate(
      taskId,
      {
        $push: {
          gitLinks: {
            type: 'commit',
            ...commitData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    );
    this.logger.log(`Commit ${commitData.sha.slice(0, 7)} linked to task ${taskId}`);
    return task;
  }

  async addPullRequestLink(
    taskId: string,
    prData: {
      provider: 'github' | 'gitlab' | 'bitbucket';
      url: string;
      title: string;
      status: string;
      author: string;
      authorAvatar?: string;
      number: number;
      repository: string;
      branch?: string;
    },
  ) {
    // Update existing PR link if same number + provider
    const existing = await this.taskModel.findOne({
      _id: taskId,
      'gitLinks.number': prData.number,
      'gitLinks.type': 'pull_request',
      'gitLinks.provider': prData.provider,
      'gitLinks.repository': prData.repository,
    });

    if (existing) {
      return this.taskModel.findOneAndUpdate(
        {
          _id: taskId,
          'gitLinks.number': prData.number,
          'gitLinks.type': 'pull_request',
          'gitLinks.provider': prData.provider,
        },
        {
          $set: {
            'gitLinks.$.title': prData.title,
            'gitLinks.$.status': prData.status,
            'gitLinks.$.url': prData.url,
            'gitLinks.$.branch': prData.branch,
            'gitLinks.$.updatedAt': new Date(),
          },
        },
        { new: true },
      );
    }

    const task = await this.taskModel.findByIdAndUpdate(
      taskId,
      {
        $push: {
          gitLinks: {
            type: 'pull_request',
            ...prData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    );
    this.logger.log(`PR #${prData.number} linked to task ${taskId}`);
    return task;
  }

  async updatePullRequestStatus(
    taskId: string,
    prNumber: number,
    status: string,
    provider: string,
  ) {
    return this.taskModel.findOneAndUpdate(
      {
        _id: taskId,
        'gitLinks.number': prNumber,
        'gitLinks.type': 'pull_request',
        'gitLinks.provider': provider,
      },
      {
        $set: {
          'gitLinks.$.status': status,
          'gitLinks.$.updatedAt': new Date(),
        },
      },
      { new: true },
    );
  }

  async addBranchLink(
    taskId: string,
    branchData: {
      provider: 'github' | 'gitlab' | 'bitbucket';
      url: string;
      branch: string;
      repository: string;
      author: string;
    },
  ) {
    const existing = await this.taskModel.findOne({
      _id: taskId,
      'gitLinks.branch': branchData.branch,
      'gitLinks.type': 'branch',
      'gitLinks.repository': branchData.repository,
    });
    if (existing) return existing;

    return this.taskModel.findByIdAndUpdate(
      taskId,
      {
        $push: {
          gitLinks: {
            type: 'branch',
            title: branchData.branch,
            ...branchData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    );
  }

  async getGitLinks(taskId: string) {
    const task = await this.taskModel.findById(taskId).select('gitLinks').lean();
    if (!task) throw new NotFoundException('Task not found');
    const links = task.gitLinks || [];
    // Sort by createdAt descending
    return links.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // ── Auto-Transition ──

  async autoTransitionOnMerge(taskId: string, orgId?: string) {
    const config = orgId
      ? await this.gitConfigModel.findOne({ organizationId: orgId, isActive: true })
      : null;

    if (!config?.autoTransition) return null;

    const task = await this.taskModel.findById(taskId);
    if (!task) return null;

    const transitionableStatuses = ['in_progress', 'in_review'];
    if (!transitionableStatuses.includes(task.status)) return null;

    const targetStatus = config.autoTransitionTarget || 'done';
    task.status = targetStatus;
    task.completedAt = targetStatus === 'done' ? new Date() : task.completedAt;
    if (!task.statusHistory) task.statusHistory = [];
    task.statusHistory.push({
      status: targetStatus,
      changedAt: new Date(),
      changedBy: 'git-integration',
    });
    await task.save();
    this.logger.log(`Auto-transitioned task ${task.taskKey || taskId} to ${targetStatus} after PR merge`);
    return task;
  }

  // ── Webhook Signature Verification ──

  verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature) return false;
    const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  verifyGitLabToken(token: string, secret: string): boolean {
    if (!token || !secret) return false;
    try {
      return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
    } catch {
      return false;
    }
  }

  // ── Integration Config ──

  async setupGitConfig(
    orgId: string,
    provider: 'github' | 'gitlab' | 'bitbucket',
    options?: { autoTransition?: boolean; autoTransitionTarget?: string },
  ) {
    const webhookSecret = randomBytes(32).toString('hex');

    const config = await this.gitConfigModel.findOneAndUpdate(
      { organizationId: orgId, provider },
      {
        organizationId: orgId,
        provider,
        webhookSecret,
        isActive: true,
        autoTransition: options?.autoTransition ?? false,
        autoTransitionTarget: options?.autoTransitionTarget ?? 'done',
      },
      { upsert: true, new: true },
    );

    return config;
  }

  async getGitConfig(orgId: string) {
    return this.gitConfigModel.find({ organizationId: orgId }).lean();
  }

  async removeGitConfig(orgId: string, provider?: string): Promise<{ deletedCount: number }> {
    const filter: any = { organizationId: orgId };
    if (provider) filter.provider = provider;
    const res = await this.gitConfigModel.deleteMany(filter);
    return { deletedCount: res.deletedCount || 0 };
  }

  async getWebhookSecret(orgId: string, provider: string): Promise<string | null> {
    const config = await this.gitConfigModel.findOne({
      organizationId: orgId,
      provider,
      isActive: true,
    });
    return config?.webhookSecret || null;
  }

  async updateLastWebhookTime(orgId: string, provider: string) {
    await this.gitConfigModel.updateOne(
      { organizationId: orgId, provider },
      { $set: { lastWebhookAt: new Date() } },
    );
  }

  // ── GitHub Webhook Processing ──

  async processGitHubPush(payload: any, orgId: string) {
    const repository = payload.repository?.full_name || payload.repository?.name || 'unknown';
    const branch = (payload.ref || '').replace('refs/heads/', '');
    const commits = payload.commits || [];

    let linkedCount = 0;

    for (const commit of commits) {
      const message = commit.message || '';
      const taskKeys = this.parseTaskKeys(message);
      if (!taskKeys.length) continue;

      const tasks = await this.resolveTasksByKeys(taskKeys, orgId);
      for (const task of tasks) {
        await this.addCommitLink(task._id.toString(), {
          provider: 'github',
          url: commit.url || `https://github.com/${repository}/commit/${commit.id}`,
          title: message.split('\n')[0].slice(0, 200),
          author: commit.author?.name || commit.author?.username || 'unknown',
          authorAvatar: '',
          sha: commit.id,
          repository,
          branch,
        });
        linkedCount++;
      }

      // Also link branch
      if (branch) {
        for (const task of tasks) {
          await this.addBranchLink(task._id.toString(), {
            provider: 'github',
            url: `https://github.com/${repository}/tree/${branch}`,
            branch,
            repository,
            author: commit.author?.name || 'unknown',
          });
        }
      }
    }

    await this.updateLastWebhookTime(orgId, 'github');
    return { linkedCount };
  }

  async processGitHubPullRequest(payload: any, orgId: string) {
    const action = payload.action;
    const pr = payload.pull_request;
    if (!pr) return { linkedCount: 0 };

    const repository = payload.repository?.full_name || 'unknown';
    const textToSearch = `${pr.title || ''} ${pr.body || ''}`;
    const taskKeys = this.parseTaskKeys(textToSearch);
    if (!taskKeys.length) return { linkedCount: 0 };

    let status: string;
    if (pr.merged) {
      status = 'merged';
    } else if (pr.state === 'closed') {
      status = 'closed';
    } else {
      status = 'open';
    }

    const tasks = await this.resolveTasksByKeys(taskKeys, orgId);
    let linkedCount = 0;

    for (const task of tasks) {
      if (action === 'closed' || action === 'opened' || action === 'synchronize' || action === 'edited' || action === 'reopened') {
        await this.addPullRequestLink(task._id.toString(), {
          provider: 'github',
          url: pr.html_url || pr.url,
          title: pr.title || '',
          status,
          author: pr.user?.login || 'unknown',
          authorAvatar: pr.user?.avatar_url || '',
          number: pr.number,
          repository,
          branch: pr.head?.ref || '',
        });
        linkedCount++;
      }

      // Auto-transition on merge
      if (pr.merged && action === 'closed') {
        await this.autoTransitionOnMerge(task._id.toString(), orgId);
      }
    }

    await this.updateLastWebhookTime(orgId, 'github');
    return { linkedCount };
  }

  // ── GitLab Webhook Processing ──

  async processGitLabPush(payload: any, orgId: string) {
    const repository = payload.project?.path_with_namespace || payload.repository?.name || 'unknown';
    const branch = (payload.ref || '').replace('refs/heads/', '');
    const commits = payload.commits || [];

    let linkedCount = 0;

    for (const commit of commits) {
      const message = commit.message || '';
      const taskKeys = this.parseTaskKeys(message);
      if (!taskKeys.length) continue;

      const tasks = await this.resolveTasksByKeys(taskKeys, orgId);
      for (const task of tasks) {
        await this.addCommitLink(task._id.toString(), {
          provider: 'gitlab',
          url: commit.url || '',
          title: message.split('\n')[0].slice(0, 200),
          author: commit.author?.name || 'unknown',
          authorAvatar: '',
          sha: commit.id,
          repository,
          branch,
        });
        linkedCount++;
      }

      if (branch) {
        for (const task of tasks) {
          await this.addBranchLink(task._id.toString(), {
            provider: 'gitlab',
            url: `${payload.project?.web_url || ''}/-/tree/${branch}`,
            branch,
            repository,
            author: commit.author?.name || 'unknown',
          });
        }
      }
    }

    await this.updateLastWebhookTime(orgId, 'gitlab');
    return { linkedCount };
  }

  async processGitLabMergeRequest(payload: any, orgId: string) {
    const mr = payload.object_attributes;
    if (!mr) return { linkedCount: 0 };

    const repository = payload.project?.path_with_namespace || 'unknown';
    const textToSearch = `${mr.title || ''} ${mr.description || ''}`;
    const taskKeys = this.parseTaskKeys(textToSearch);
    if (!taskKeys.length) return { linkedCount: 0 };

    let status: string;
    if (mr.state === 'merged') {
      status = 'merged';
    } else if (mr.state === 'closed') {
      status = 'closed';
    } else {
      status = 'open';
    }

    const tasks = await this.resolveTasksByKeys(taskKeys, orgId);
    let linkedCount = 0;

    for (const task of tasks) {
      await this.addPullRequestLink(task._id.toString(), {
        provider: 'gitlab',
        url: mr.url || '',
        title: mr.title || '',
        status,
        author: payload.user?.name || payload.user?.username || 'unknown',
        authorAvatar: payload.user?.avatar_url || '',
        number: mr.iid || mr.id,
        repository,
        branch: mr.source_branch || '',
      });
      linkedCount++;

      if (mr.state === 'merged') {
        await this.autoTransitionOnMerge(task._id.toString(), orgId);
      }
    }

    await this.updateLastWebhookTime(orgId, 'gitlab');
    return { linkedCount };
  }
}
