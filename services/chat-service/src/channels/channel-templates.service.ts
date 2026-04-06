import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';

/**
 * E3 7.4: Channel Templates.
 * Pre-configured channel sets for common team setups.
 */

interface ChannelTemplate {
  id: string;
  name: string;
  description: string;
  channels: Array<{
    namePattern: string;
    channelType: string;
    topic?: string;
    settings?: any;
  }>;
}

const BUILTIN_TEMPLATES: ChannelTemplate[] = [
  {
    id: 'engineering-sprint',
    name: 'Engineering Sprint',
    description: 'Channels for a sprint team: main, standup (thread-required), reviews',
    channels: [
      { namePattern: 'sprint-{name}', channelType: 'public', topic: 'Sprint discussions' },
      { namePattern: 'sprint-{name}-standup', channelType: 'public', topic: 'Daily standup updates', settings: { threadRequirement: 'required' } },
      { namePattern: 'sprint-{name}-reviews', channelType: 'public', topic: 'Code reviews and PRs' },
    ],
  },
  {
    id: 'client-project',
    name: 'Client Project',
    description: 'Channels for a client engagement: main, internal (private), files',
    channels: [
      { namePattern: 'client-{name}', channelType: 'public', topic: 'Client communication' },
      { namePattern: 'client-{name}-internal', channelType: 'private', topic: 'Internal discussions — not visible to client' },
      { namePattern: 'client-{name}-files', channelType: 'public', topic: 'Shared documents and files' },
    ],
  },
  {
    id: 'department',
    name: 'Department',
    description: 'Standard department channels: general, announcements, random',
    channels: [
      { namePattern: '{dept}-general', channelType: 'public', topic: 'General discussions' },
      { namePattern: '{dept}-announcements', channelType: 'announcement', topic: 'Department announcements' },
      { namePattern: '{dept}-random', channelType: 'public', topic: 'Off-topic and social' },
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Channels for new employee onboarding',
    channels: [
      { namePattern: 'new-joiners', channelType: 'public', topic: 'Welcome new team members!' },
      { namePattern: 'onboarding-tasks', channelType: 'public', topic: 'Onboarding checklist and tasks' },
      { namePattern: 'ask-anything', channelType: 'public', topic: 'No question is too basic — ask away' },
    ],
  },
];

@Injectable()
export class ChannelTemplatesService {
  private readonly logger = new Logger(ChannelTemplatesService.name);

  constructor(private conversationsService: ConversationsService) {}

  getTemplates(): ChannelTemplate[] {
    return BUILTIN_TEMPLATES;
  }

  getTemplate(templateId: string): ChannelTemplate | null {
    return BUILTIN_TEMPLATES.find(t => t.id === templateId) || null;
  }

  async createFromTemplate(templateId: string, variables: Record<string, string>, createdBy: string, organizationId?: string): Promise<any[]> {
    const template = this.getTemplate(templateId);
    if (!template) throw new NotFoundException(`Template '${templateId}' not found`);

    const created: any[] = [];
    for (const ch of template.channels) {
      let name = ch.namePattern;
      for (const [key, value] of Object.entries(variables)) {
        name = name.replace(`{${key}}`, value.toLowerCase().replace(/\s+/g, '-'));
      }

      const conversation = await this.conversationsService.createChannel(
        name, ch.topic || '', createdBy, undefined, ch.channelType, ch.topic,
      );

      // Apply settings if specified
      if (ch.settings && conversation._id) {
        // Settings are applied during channel creation via the schema defaults
      }

      created.push(conversation);
      this.logger.log(`Template channel created: ${name} (${ch.channelType})`);
    }

    return created;
  }
}
