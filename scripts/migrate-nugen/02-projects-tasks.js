// Nugen → Nexora migration: Phase 2 (Projects + Tasks)
// Migrates: Projects, Tasks, task_comments, taskSubmissions
// Strategy A: preserve source _ids. Orphan tasks go into a synthetic project.
//
// Run: node scripts/migrate-nugen/02-projects-tasks.js
//
// SAFE TO RE-RUN: uses upsert on source _id.

const { MongoClient, ObjectId } = require('mongodb');

const SOURCE_URI =
  'mongodb+srv://varun:hariom786@cluster0-r2jpw.mongodb.net/nugen_backend_prod?retryWrites=true&w=majority';
const LOCAL_URI =
  'mongodb://root:nexora_dev_password@localhost:27017/?authSource=admin';

const NUGEN_ORG_ID = '6600000000000000000000a0';
const ADMIN_USER_ID = '645c9ffd5329fcac1a3d0d21';
const LEGACY_PROJECT_ID = '6600000000000000000000b0'; // synthetic, deterministic

function parseHoursMinutes(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

function mapTaskStatus(task) {
  if (task.isCompleted) return 'done';
  if (task.onHold) return 'blocked';
  return 'in_progress'; // open + not-on-hold → in_progress
}

async function main() {
  const src = await MongoClient.connect(SOURCE_URI);
  const dst = await MongoClient.connect(LOCAL_URI);

  try {
    const srcDb = src.db('nugen_backend_prod');
    const projDb = dst.db('nexora_projects');
    const taskDb = dst.db('nexora_tasks');
    const now = new Date();
    const counters = {};

    // ── 1. Projects ──
    console.log('\n=== 1. Projects ===');

    // 1a. Real projects from source
    const srcProjects = await srcDb.collection('projects').find({ isDeleted: { $ne: true } }).toArray();
    let projectCount = 0;
    for (const p of srcProjects) {
      const team = (p.assignedUsers || []).map((a) => ({
        userId: String(a.userId),
        role: a.role === 'owner' ? 'owner' : 'member',
        allocationPercentage: 100,
        assignedAt: a.assignedAt || now,
      }));

      const doc = {
        _id: p._id,
        organizationId: NUGEN_ORG_ID,
        projectName: p.projectName,
        projectKey: String(p.projectName || '').substring(0, 3).toUpperCase() || 'PRJ',
        description: (p.description || '').replace(/<[^>]*>/g, '').trim() || null,
        category: p.category || null,
        startDate: p.startDate || null,
        status: p.status === 'active' ? 'active' : 'planning',
        priority: 'medium',
        visibility: 'private',
        team,
        milestones: [],
        risks: [],
        activities: [{
          action: 'project_migrated',
          description: 'Migrated from Nugen backend',
          userId: ADMIN_USER_ID,
          createdAt: now,
        }],
        settings: {
          boardType: 'kanban',
          clientPortalEnabled: false,
          sprintDuration: 14,
          estimationUnit: 'hours',
          defaultView: 'board',
          enableTimeTracking: true,
          enableSubtasks: true,
        },
        healthScore: 100,
        progressPercentage: 0,
        tags: ['migrated'],
        isDeleted: !!p.isDeleted,
        createdBy: String(p.createdBy || ADMIN_USER_ID),
        createdAt: p.createdAt || now,
        updatedAt: p.updatedAt || now,
      };
      await projDb.collection('projects').replaceOne({ _id: doc._id }, doc, { upsert: true });
      projectCount++;
      console.log(`  upserted project: ${doc.projectName} (${doc._id})`);
    }

    // 1b. Synthetic "Legacy Tasks" project for orphan tasks
    const legacyProject = {
      _id: new ObjectId(LEGACY_PROJECT_ID),
      organizationId: NUGEN_ORG_ID,
      projectName: '[LEGACY] Imported Tasks',
      projectKey: 'LGC',
      description: 'Synthetic project containing tasks imported from the legacy Nugen backend that had no project association.',
      category: 'Legacy',
      startDate: new Date('2023-05-01'),
      status: 'completed',
      priority: 'low',
      visibility: 'private',
      team: [{ userId: ADMIN_USER_ID, role: 'owner', allocationPercentage: 100, assignedAt: now }],
      milestones: [],
      risks: [],
      activities: [{
        action: 'project_created',
        description: 'Auto-created during Nugen → Nexora migration to hold orphan tasks',
        userId: ADMIN_USER_ID,
        createdAt: now,
      }],
      settings: {
        boardType: 'kanban',
        clientPortalEnabled: false,
        sprintDuration: 14,
        estimationUnit: 'hours',
        defaultView: 'list',
        enableTimeTracking: false,
        enableSubtasks: false,
      },
      healthScore: 100,
      progressPercentage: 100,
      tags: ['migrated', 'legacy'],
      isDeleted: false,
      createdBy: ADMIN_USER_ID,
      createdAt: now,
      updatedAt: now,
    };
    await projDb.collection('projects').replaceOne({ _id: legacyProject._id }, legacyProject, { upsert: true });
    projectCount++;
    console.log(`  upserted synthetic project: ${legacyProject.projectName}`);

    counters.projects = projectCount;

    // ── 2. Tasks ──
    console.log('\n=== 2. Tasks ===');
    const srcTasks = await srcDb.collection('tasks').find({ isDeleted: { $ne: true } }).toArray();

    // Build project ID map (source tasks that reference a projectId)
    const sourceProjectIds = new Set(srcProjects.map((p) => String(p._id)));

    // Pre-load task_comments and taskSubmissions for merging
    const taskComments = await srcDb.collection('task_comments').find({ isDeleted: { $ne: true } }).toArray();
    const taskSubmissions = await srcDb.collection('taskSubmissions').find({ isDeleted: { $ne: true } }).toArray();

    // Group by taskId
    const commentsByTask = new Map();
    for (const c of taskComments) {
      const tid = String(c.taskId);
      if (!commentsByTask.has(tid)) commentsByTask.set(tid, []);
      commentsByTask.get(tid).push(c);
    }
    const submissionsByTask = new Map();
    for (const s of taskSubmissions) {
      const tid = String(s.taskId);
      if (!submissionsByTask.has(tid)) submissionsByTask.set(tid, []);
      submissionsByTask.get(tid).push(s);
    }

    let taskCount = 0;
    let commentsMerged = 0;
    let submissionsMerged = 0;

    for (const t of srcTasks) {
      // Determine projectId
      let projectId;
      if (t.projectId && sourceProjectIds.has(String(t.projectId))) {
        projectId = String(t.projectId);
      } else {
        projectId = LEGACY_PROJECT_ID;
      }

      // Build embedded comments from task_comments
      const comments = [];
      const srcComments = commentsByTask.get(String(t._id)) || [];
      for (const c of srcComments) {
        comments.push({
          userId: String(c.userId),
          content: c.comment || '',
          createdAt: c.createdAt || now,
          updatedAt: c.updatedAt || null,
          isEdited: !!c.isEdited,
        });
        commentsMerged++;
      }

      // Synthesize taskSubmissions as comments
      const srcSubs = submissionsByTask.get(String(t._id)) || [];
      for (const s of srcSubs) {
        let content = `**Task Submission** (${s.reviewStatus || 'pending'})\n`;
        if (s.submissionNotes) content += s.submissionNotes + '\n';
        if (s.submissionImages?.length) {
          content += s.submissionImages.map((url) => `![submission](${url})`).join('\n') + '\n';
        }
        if (s.holdNote) content += `_Hold note:_ ${s.holdNote}\n`;
        if (s.submissionAt) content += `_Submitted:_ ${new Date(s.submissionAt).toISOString()}\n`;

        comments.push({
          userId: String(s.userId),
          content: content.trim(),
          createdAt: s.createdAt || now,
        });
        submissionsMerged++;
      }

      // Synthesize reviewFeedback as a comment if present
      if (t.reviewFeedback) {
        comments.push({
          userId: String(t.assignedBy || ADMIN_USER_ID),
          content: `**Review Feedback**\n${t.reviewFeedback}`,
          createdAt: t.completionDate || t.updatedAt || now,
        });
      }

      // Build attachments from taskImages
      const attachments = (t.taskImages || []).map((url) => ({
        name: url.split('/').pop() || 'image',
        url,
        uploadedBy: String(t.userAssigned || t.assignedBy || ADMIN_USER_ID),
        uploadedAt: t.createdAt || now,
      }));

      const status = mapTaskStatus(t);
      const estimatedHours = parseHoursMinutes(t.taskEffort);

      // Generate a task key
      const keyPrefix = projectId === LEGACY_PROJECT_ID ? 'LGC' : 'NAP';

      const doc = {
        _id: t._id,
        organizationId: NUGEN_ORG_ID,
        taskKey: `${keyPrefix}-${String(t._id).slice(-4).toUpperCase()}`,
        title: t.taskTitle || 'Untitled Task',
        description: t.description || null,
        projectId,
        type: 'task',
        status,
        priority: 'medium',
        assigneeId: t.userAssigned ? String(t.userAssigned) : null,
        reporterId: String(t.assignedBy || ADMIN_USER_ID),
        dueDate: t.deadline || null,
        labels: [],
        estimatedHours: estimatedHours || null,
        loggedHours: 0,
        comments,
        timeEntries: [],
        attachments,
        completedAt: t.isCompleted ? (t.completionDate || t.updatedAt || null) : null,
        isDeleted: !!t.isDeleted,
        createdBy: String(t.assignedBy || ADMIN_USER_ID),
        createdAt: t.createdAt || now,
        updatedAt: t.updatedAt || now,
      };

      await taskDb.collection('tasks').replaceOne({ _id: doc._id }, doc, { upsert: true });
      taskCount++;
    }

    counters.tasks = taskCount;
    counters.commentsMerged = commentsMerged;
    counters.submissionsMerged = submissionsMerged;

    console.log(`  tasks: ${taskCount} (${commentsMerged} comments merged, ${submissionsMerged} submissions merged)`);

    // ── 3. Update project progress ──
    console.log('\n=== 3. Project progress ===');
    // For the legacy project: count done vs total
    for (const pid of [LEGACY_PROJECT_ID, ...srcProjects.map((p) => String(p._id))]) {
      const total = await taskDb.collection('tasks').countDocuments({ projectId: pid, isDeleted: false });
      const done = await taskDb.collection('tasks').countDocuments({ projectId: pid, isDeleted: false, status: 'done' });
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      await projDb.collection('projects').updateOne(
        { _id: pid.length === 24 ? new ObjectId(pid) : pid },
        { $set: { progressPercentage: pct } },
      );
      console.log(`  ${pid}: ${done}/${total} done (${pct}%)`);
    }

    // ── Summary ──
    console.log('\n=== SUMMARY ===');
    console.table(counters);

  } finally {
    await src.close();
    await dst.close();
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
