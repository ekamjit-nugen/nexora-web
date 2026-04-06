import { MentionsService } from './mentions.service';

describe('MentionsService', () => {
  let service: MentionsService;

  beforeEach(() => {
    service = new MentionsService();
  });

  describe('parseMentions', () => {
    it('should return empty array for empty content', () => {
      expect(service.parseMentions('')).toEqual([]);
      expect(service.parseMentions(null as any)).toEqual([]);
    });

    it('should parse @here mention', () => {
      const mentions = service.parseMentions('Hey @here, check this out');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('here');
      expect(mentions[0].targetId).toBe('here');
    });

    it('should parse @all mention', () => {
      const mentions = service.parseMentions('Attention @all: meeting in 5');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('all');
    });

    it('should parse @channel mention', () => {
      const mentions = service.parseMentions('FYI @channel');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('channel');
    });

    it('should parse user ID mentions (24-char hex)', () => {
      const mentions = service.parseMentions('Thanks @660000000000000000000001 for the help');
      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('user');
      expect(mentions[0].targetId).toBe('660000000000000000000001');
    });

    it('should parse multiple mentions', () => {
      const mentions = service.parseMentions('@here @660000000000000000000001 @all');
      expect(mentions).toHaveLength(3);
      expect(mentions.map(m => m.type)).toEqual(['here', 'user', 'all']);
    });

    it('should include offset and length', () => {
      const mentions = service.parseMentions('Hello @here world');
      expect(mentions[0].offset).toBe(6);
      expect(mentions[0].length).toBe(5);
    });

    it('should not match partial hex strings', () => {
      const mentions = service.parseMentions('see @abc not a mention');
      expect(mentions).toHaveLength(0);
    });
  });

  describe('getMentionedUserIds', () => {
    const participants = [
      { userId: 'user1', notifyPreference: 'all' },
      { userId: 'user2', notifyPreference: 'mentions' },
      { userId: 'user3', notifyPreference: 'nothing' },
    ];

    it('should return specific user for @user mention', () => {
      const ids = service.getMentionedUserIds(
        [{ type: 'user', targetId: 'user1', displayName: '', offset: 0, length: 0 }],
        participants,
      );
      expect(ids).toContain('user1');
    });

    it('should notify online users for @here', () => {
      const ids = service.getMentionedUserIds(
        [{ type: 'here', targetId: 'here', displayName: '', offset: 0, length: 0 }],
        participants,
        ['user1', 'user2'],
      );
      expect(ids).toContain('user1');
      expect(ids).toContain('user2');
      expect(ids).not.toContain('user3');
    });

    it('should notify all except "nothing" preference for @all', () => {
      const ids = service.getMentionedUserIds(
        [{ type: 'all', targetId: 'all', displayName: '', offset: 0, length: 0 }],
        participants,
      );
      expect(ids).toContain('user1');
      expect(ids).toContain('user2');
      expect(ids).not.toContain('user3');
    });
  });
});
