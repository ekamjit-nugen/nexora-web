import { Injectable, Logger } from '@nestjs/common';

export interface CommandResult {
  handled: boolean;
  response?: string;
  type?: string;        // 'text' | 'system' | 'poll'
  data?: any;
}

interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  handler: (args: string, userId: string, conversationId: string) => Promise<CommandResult>;
}

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);
  private readonly commands = new Map<string, CommandHandler>();

  constructor() {
    this.registerBuiltinCommands();
  }

  private parseDuration(input: string): number | null {
    const match = input.match(/^(\d+)([mhd])$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === 'm') return value;
    if (unit === 'h') return value * 60;
    if (unit === 'd') return value * 24 * 60;
    return null;
  }

  private registerBuiltinCommands() {
    this.commands.set('/help', {
      name: '/help',
      description: 'Show available commands',
      usage: '/help',
      handler: async () => {
        const list = Array.from(this.commands.values())
          .map(c => `**${c.name}** — ${c.description}\n  Usage: \`${c.usage}\``)
          .join('\n\n');
        return { handled: true, response: `**Available Commands:**\n\n${list}`, type: 'system' };
      },
    });

    this.commands.set('/status', {
      name: '/status',
      description: 'Set your status message with optional emoji',
      usage: '/status [:emoji] [message]',
      handler: async (args) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/status :coffee Working from home`', type: 'system' };
        const trimmed = args.trim();
        const parts = trimmed.split(/\s+/);
        const firstWord = parts[0];
        const isEmoji = firstWord.startsWith(':') || /^\p{Emoji}/u.test(firstWord);
        const emoji = isEmoji ? firstWord : undefined;
        const text = isEmoji ? parts.slice(1).join(' ') || '' : trimmed;
        const display = emoji ? `${emoji} ${text}`.trim() : text;
        return { handled: true, response: `Status set to: ${display}`, type: 'system', data: { action: 'setStatus', emoji, text } };
      },
    });

    this.commands.set('/shrug', {
      name: '/shrug',
      description: 'Append a shrug to your message',
      usage: '/shrug [message]',
      handler: async (args) => {
        return { handled: true, response: `${args.trim()} ¯\\_(ツ)_/¯`, type: 'text' };
      },
    });

    this.commands.set('/tableflip', {
      name: '/tableflip',
      description: 'Flip a table',
      usage: '/tableflip',
      handler: async () => {
        return { handled: true, response: '(╯°□°)╯︵ ┻━┻', type: 'text' };
      },
    });

    this.commands.set('/remind', {
      name: '/remind',
      description: 'Set a reminder',
      usage: '/remind [time] [message]',
      handler: async (args, _userId, conversationId) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/remind 2h Review PR #42`', type: 'system' };
        const parts = args.trim().split(/\s+/);
        const durationMinutes = this.parseDuration(parts[0]);
        if (!durationMinutes) return { handled: true, response: 'Invalid duration. Use format: `30m`, `2h`, or `1d`', type: 'system' };
        const message = parts.slice(1).join(' ') || 'Reminder';
        return { handled: true, response: `Reminder set for ${parts[0]}: ${message}`, type: 'system', data: { action: 'setReminder', durationMinutes, message, conversationId } };
      },
    });

    this.commands.set('/mute', {
      name: '/mute',
      description: 'Mute current conversation',
      usage: '/mute',
      handler: async (_args, _userId, conversationId) => {
        return { handled: true, response: 'Conversation muted', type: 'system', data: { action: 'muteConversation', conversationId } };
      },
    });

    this.commands.set('/unmute', {
      name: '/unmute',
      description: 'Unmute current conversation',
      usage: '/unmute',
      handler: async (_args, _userId, conversationId) => {
        return { handled: true, response: 'Conversation unmuted', type: 'system', data: { action: 'unmuteConversation', conversationId } };
      },
    });

    this.commands.set('/giphy', {
      name: '/giphy',
      description: 'Search for a GIF',
      usage: '/giphy [search]',
      handler: async (args) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/giphy cats dancing`', type: 'system' };
        return { handled: true, response: `Searching for GIF: ${args.trim()}`, type: 'system', data: { action: 'searchGiphy', query: args.trim() } };
      },
    });

    this.commands.set('/me', {
      name: '/me',
      description: 'Send an action message',
      usage: '/me [action]',
      handler: async (args) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/me is thinking...`', type: 'system' };
        return { handled: true, response: `_${args.trim()}_`, type: 'text' };
      },
    });

    this.commands.set('/away', {
      name: '/away',
      description: 'Toggle away status',
      usage: '/away',
      handler: async () => {
        return { handled: true, response: 'Status set to away', type: 'system', data: { action: 'setStatus', status: 'away' } };
      },
    });

    this.commands.set('/dnd', {
      name: '/dnd',
      description: 'Enable Do Not Disturb',
      usage: '/dnd [duration]',
      handler: async (args) => {
        let durationMinutes = 60;
        if (args.trim()) {
          const parsed = this.parseDuration(args.trim());
          if (!parsed) return { handled: true, response: 'Invalid duration. Use format: `30m`, `2h`, or `1d`', type: 'system' };
          durationMinutes = parsed;
        }
        return { handled: true, response: `Do Not Disturb enabled for ${durationMinutes} minutes`, type: 'system', data: { action: 'setDnd', durationMinutes } };
      },
    });
  }

    // ── Cross-Service Commands ──

    this.commands.set('/task', {
      name: '/task',
      description: 'Create a task from chat',
      usage: '/task <title> [@assignee]',
      handler: async (args, userId) => {
        const trimmed = args.trim();
        if (!trimmed) {
          return { handled: true, response: 'Usage: `/task Fix login bug @john`', type: 'system' };
        }

        const assigneeMatch = trimmed.match(/@(\S+)\s*$/);
        const assignee = assigneeMatch ? assigneeMatch[1] : undefined;
        const title = assignee ? trimmed.replace(/@\S+\s*$/, '').trim() : trimmed;

        if (!title) {
          return { handled: true, response: 'Please provide a task title.', type: 'system' };
        }

        const response = assignee
          ? `**Task Created**\nTitle: ${title}\nAssigned to: @${assignee}\nCreated by: <user:${userId}>`
          : `**Task Created**\nTitle: ${title}\nCreated by: <user:${userId}>`;

        return {
          handled: true,
          response,
          type: 'system',
          data: { action: 'createTask', title, assignee },
        };
      },
    });

    this.commands.set('/leave', {
      name: '/leave',
      description: 'Submit a leave request',
      usage: '/leave <casual|sick|earned> <start> <end> [reason]',
      handler: async (args, userId) => {
        const trimmed = args.trim();
        if (!trimmed) {
          return { handled: true, response: 'Usage: `/leave casual 2026-04-10 2026-04-12 Family event`', type: 'system' };
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length < 3) {
          return { handled: true, response: 'Usage: `/leave <casual|sick|earned> <start-date> <end-date> [reason]`', type: 'system' };
        }

        const leaveType = parts[0].toLowerCase();
        if (!['casual', 'sick', 'earned'].includes(leaveType)) {
          return { handled: true, response: 'Invalid leave type. Use: `casual`, `sick`, or `earned`.', type: 'system' };
        }

        const start = parts[1];
        const end = parts[2];
        const reason = parts.slice(3).join(' ') || undefined;

        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return { handled: true, response: 'Invalid date format. Use YYYY-MM-DD.', type: 'system' };
        }
        if (endDate < startDate) {
          return { handled: true, response: 'End date must be after start date.', type: 'system' };
        }

        const response = [
          `**Leave Request Submitted**`,
          `Type: ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)}`,
          `From: ${start}`,
          `To: ${end}`,
          reason ? `Reason: ${reason}` : null,
          `Requested by: <user:${userId}>`,
        ].filter(Boolean).join('\n');

        return {
          handled: true,
          response,
          type: 'system',
          data: { action: 'leaveRequest', leaveType, start, end, reason },
        };
      },
    });

    this.commands.set('/poll', {
      name: '/poll',
      description: 'Create a poll',
      usage: '/poll <question> | <option1> | <option2> | ...',
      handler: async (args) => {
        const trimmed = args.trim();
        if (!trimmed) {
          return { handled: true, response: 'Usage: `/poll What for lunch? | Pizza | Sushi | Tacos`', type: 'system' };
        }

        const segments = trimmed.split('|').map(s => s.trim()).filter(s => s.length > 0);
        if (segments.length < 3) {
          return { handled: true, response: 'A poll needs a question and at least 2 options, separated by `|`.', type: 'system' };
        }

        const question = segments[0];
        const options = segments.slice(1);

        return {
          handled: true,
          type: 'poll',
          data: { action: 'createPoll', question, options },
        };
      },
    });

    this.commands.set('/standup', {
      name: '/standup',
      description: 'Share your standup update',
      usage: '/standup [what I did | what I will do | blockers]',
      handler: async (args) => {
        const trimmed = args.trim();
        if (!trimmed) {
          return { handled: true, response: 'Usage: `/standup Fixed auth bug | Working on API tests | Waiting for design review`', type: 'system' };
        }

        const sections = trimmed.split('|').map(s => s.trim());
        const yesterday = sections[0] || '';
        const today = sections[1] || '';
        const blockers = sections[2] || '';

        const lines: string[] = ['**Standup Update**'];
        if (yesterday) lines.push(`**Yesterday:** ${yesterday}`);
        if (today) lines.push(`**Today:** ${today}`);
        if (blockers) lines.push(`**Blockers:** ${blockers}`);

        return {
          handled: true,
          response: lines.join('\n'),
          type: 'text',
        };
      },
    });
  }

  /**
   * Parse and execute a slash command from message content.
   * Returns null if content is not a command.
   */
  async parseAndExecute(content: string, userId: string, conversationId: string): Promise<CommandResult | null> {
    if (!content || !content.startsWith('/')) return null;

    const spaceIdx = content.indexOf(' ');
    const commandName = spaceIdx > 0 ? content.substring(0, spaceIdx).toLowerCase() : content.toLowerCase();
    const args = spaceIdx > 0 ? content.substring(spaceIdx + 1) : '';

    const handler = this.commands.get(commandName);
    if (!handler) return null;

    this.logger.log(`Command executed: ${commandName} by ${userId}`);
    return handler.handler(args, userId, conversationId);
  }

  getAvailableCommands(): Array<{ name: string; description: string; usage: string }> {
    return Array.from(this.commands.values()).map(c => ({
      name: c.name, description: c.description, usage: c.usage,
    }));
  }
}
