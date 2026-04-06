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
      description: 'Set your status message',
      usage: '/status [message]',
      handler: async (args) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/status Working from home`', type: 'system' };
        return { handled: true, response: `Status set to: ${args.trim()}`, type: 'system', data: { action: 'setStatus', text: args.trim() } };
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
      handler: async (args) => {
        if (!args.trim()) return { handled: true, response: 'Usage: `/remind 2h Review PR #42`', type: 'system' };
        return { handled: true, response: `Reminder set: ${args.trim()}`, type: 'system', data: { action: 'setReminder', text: args.trim() } };
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
