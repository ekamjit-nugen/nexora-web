import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MentionsService } from '../mentions/mentions.service';

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockSocket(overrides: any = {}): any {
  const socket: any = {
    id: overrides.id || 'socket-1',
    handshake: overrides.handshake || {
      auth: { token: 'valid-jwt-token' },
      query: {},
      headers: {},
    },
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    rooms: new Set(['socket-1', 'conv:conv-1', 'conv:conv-2']),
    ...overrides,
  };
  return socket;
}

function createMockServer(): any {
  const toEmit = jest.fn();
  const server: any = {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: toEmit }),
    _toEmit: toEmit,
  };
  return server;
}

function createMockConversation(overrides: any = {}) {
  return {
    _id: 'conv-1',
    type: 'group',
    name: 'General',
    isDeleted: false,
    organizationId: 'org-1',
    participants: [
      { userId: 'user-1', role: 'owner', muted: false, notifyPreference: 'all' },
      { userId: 'user-2', role: 'member', muted: false, notifyPreference: 'all' },
      { userId: 'user-3', role: 'member', muted: false, notifyPreference: 'all' },
    ],
    ...overrides,
  };
}

function createMockMessage(overrides: any = {}) {
  return {
    _id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Hello world',
    senderName: 'Alice',
    type: 'text',
    reactions: [],
    toString: () => 'msg-1',
    ...overrides,
  };
}

function mockModel(defaultDoc: any = {}) {
  const model: any = jest.fn().mockImplementation((data) => {
    return { ...defaultDoc, ...data, save: jest.fn().mockResolvedValue(undefined) };
  });
  model.findOne = jest.fn();
  model.findById = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.find = jest.fn();
  model.findOneAndUpdate = jest.fn().mockResolvedValue(undefined);
  model.countDocuments = jest.fn();
  model.updateMany = jest.fn().mockResolvedValue({});
  return model;
}

// ── Test Suite ────────────────────────────────────────────────────────────

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let server: any;
  let jwtService: any;
  let messagesService: any;
  let conversationsService: any;
  let mentionsService: any;
  let conversationModel: any;
  let chatSettingsModel: any;
  let messageModel: any;

  beforeEach(async () => {
    conversationModel = mockModel();
    chatSettingsModel = mockModel();
    messageModel = mockModel();

    jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
    };

    messagesService = {
      sendMessage: jest.fn().mockResolvedValue(createMockMessage()),
      editMessage: jest.fn().mockResolvedValue(createMockMessage({ content: 'Edited', isEdited: true })),
      deleteMessage: jest.fn().mockResolvedValue({ message: 'Message deleted successfully' }),
      markAsRead: jest.fn().mockResolvedValue({ message: 'Marked as read' }),
      markAsDelivered: jest.fn().mockResolvedValue(undefined),
      addReaction: jest.fn().mockResolvedValue(createMockMessage({ reactions: [{ emoji: '👍', count: 1 }] })),
    };

    conversationsService = {
      getMyConversations: jest.fn().mockResolvedValue([
        { _id: 'conv-1' },
        { _id: 'conv-2' },
      ]),
    };

    mentionsService = {
      parseMentions: jest.fn().mockReturnValue([]),
      getMentionedUserIds: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: MessagesService, useValue: messagesService },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: MentionsService, useValue: mentionsService },
        { provide: getModelToken('Conversation'), useValue: conversationModel },
        { provide: getModelToken('ChatSettings'), useValue: chatSettingsModel },
        { provide: getModelToken('Message'), useValue: messageModel },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    server = createMockServer();
    gateway.server = server;
  });

  afterEach(() => {
    // Clean up any timers set during tests
    gateway.onModuleDestroy();
    jest.clearAllTimers();
  });

  // ── Connection Lifecycle ─────────────────────────────────────────────

  describe('handleConnection', () => {
    it('should authenticate user with valid JWT and join conversation rooms', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect(client.join).toHaveBeenCalledWith('conv:conv-1');
      expect(client.join).toHaveBeenCalledWith('conv:conv-2');
      expect(client.emit).toHaveBeenCalledWith('users:online-list', expect.any(Array));
      expect(server.emit).toHaveBeenCalledWith('user:online', { userId: 'user-1', online: true });
    });

    it('should disconnect client with missing token', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, query: {}, headers: {} },
      });
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should disconnect client with invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid token'); });
      const client = createMockSocket();
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should accept token from query parameter', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, query: { token: 'query-token' }, headers: {} },
      });
      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('query-token');
    });

    it('should accept token from Authorization header', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, query: {}, headers: { authorization: 'Bearer header-token' } },
      });
      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header-token');
    });

    it('should cancel disconnect grace timer on reconnect', async () => {
      // Connect first user, then disconnect, then reconnect
      const client1 = createMockSocket({ id: 'socket-1' });
      await gateway.handleConnection(client1);

      // Simulate disconnect
      await gateway.handleDisconnect(client1);

      // Reconnect before grace period
      const client2 = createMockSocket({ id: 'socket-2' });
      await gateway.handleConnection(client2);

      // The user should still be online (grace timer cancelled)
      expect(gateway.getOnlineUserIds()).toContain('user-1');
    });
  });

  describe('handleDisconnect', () => {
    it('should clear typing indicators and remove socket tracking', async () => {
      const client = createMockSocket({
        rooms: new Set(['socket-1', 'conv:conv-1', 'conv:conv-2']),
      });
      // First connect, then disconnect
      await gateway.handleConnection(client);
      await gateway.handleDisconnect(client);

      expect(client.removeAllListeners).toHaveBeenCalled();
      // Should emit typing:false for each conv room
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server.to).toHaveBeenCalledWith('conv:conv-2');
    });

    it('should start grace period before marking user offline', async () => {
      jest.useFakeTimers();
      const client = createMockSocket();
      await gateway.handleConnection(client);
      await gateway.handleDisconnect(client);

      // User should NOT be broadcast as offline immediately
      expect(server.emit).not.toHaveBeenCalledWith('user:online', { userId: 'user-1', online: false });

      // Fast-forward past grace period (30 seconds)
      jest.advanceTimersByTime(30_001);

      expect(server.emit).toHaveBeenCalledWith('user:online', { userId: 'user-1', online: false });
      jest.useRealTimers();
    });

    it('should update lastSeenAt on disconnect', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);
      await gateway.handleDisconnect(client);

      expect(chatSettingsModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1' },
        expect.objectContaining({ lastSeenAt: expect.any(Date) }),
        { upsert: true },
      );
    });

    it('should not broadcast offline if user has other active sockets', async () => {
      jest.useFakeTimers();
      const client1 = createMockSocket({ id: 'socket-1' });
      const client2 = createMockSocket({ id: 'socket-2' });

      await gateway.handleConnection(client1);
      await gateway.handleConnection(client2);

      // Disconnect only one socket
      await gateway.handleDisconnect(client1);

      jest.advanceTimersByTime(30_001);

      // Should NOT broadcast offline since socket-2 is still connected
      expect(server.emit).not.toHaveBeenCalledWith('user:online', { userId: 'user-1', online: false });
      jest.useRealTimers();
    });
  });

  // ── message:send ─────────────────────────────────────────────────────

  describe('message:send', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
    });

    it('should send a message and emit to conversation room', async () => {
      const data = { conversationId: 'conv-1', content: 'Hello' };

      await gateway.handleSendMessage(client, data);

      expect(messagesService.sendMessage).toHaveBeenCalledWith(
        'conv-1', 'user-1', 'Hello', 'text', undefined, null, undefined, undefined,
      );
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('message:new', expect.any(Object));
      expect(client.emit).toHaveBeenCalledWith('message:ack', expect.objectContaining({
        status: 'sent',
      }));
    });

    it('should emit error when rate limited', async () => {
      // Send 31 messages to exceed 30/min limit
      for (let i = 0; i < 30; i++) {
        await gateway.handleSendMessage(client, { conversationId: 'conv-1', content: `msg-${i}` });
      }

      // Clear mock to check only the 31st call
      client.emit.mockClear();
      await gateway.handleSendMessage(client, { conversationId: 'conv-1', content: 'one-too-many' });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
    });

    it('should emit error when content exceeds 40000 characters', async () => {
      const data = { conversationId: 'conv-1', content: 'x'.repeat(40001) };

      await gateway.handleSendMessage(client, data);

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: expect.stringContaining('40,000'),
      }));
      expect(messagesService.sendMessage).not.toHaveBeenCalled();
    });

    it('should return silently for unauthenticated socket', async () => {
      const unauthedClient = createMockSocket({ id: 'unauthed-socket' });
      // Do NOT call handleConnection

      await gateway.handleSendMessage(unauthedClient, { conversationId: 'conv-1', content: 'hi' });

      expect(messagesService.sendMessage).not.toHaveBeenCalled();
    });

    it('should send idempotency key in ack', async () => {
      const data = { conversationId: 'conv-1', content: 'Hello', idempotencyKey: 'idem-123' };

      await gateway.handleSendMessage(client, data);

      expect(client.emit).toHaveBeenCalledWith('message:ack', expect.objectContaining({
        idempotencyKey: 'idem-123',
        status: 'sent',
      }));
    });

    it('should emit failure ack with idempotency key on error', async () => {
      messagesService.sendMessage.mockRejectedValue(new Error('DB error'));
      const data = { conversationId: 'conv-1', content: 'Hello', idempotencyKey: 'idem-fail' };

      await gateway.handleSendMessage(client, data);

      expect(client.emit).toHaveBeenCalledWith('message:ack', expect.objectContaining({
        idempotencyKey: 'idem-fail',
        status: 'failed',
        error: 'DB error',
      }));
    });

    it('should emit error on service failure without idempotency key', async () => {
      messagesService.sendMessage.mockRejectedValue(new Error('Service error'));
      const data = { conversationId: 'conv-1', content: 'Hello' };

      await gateway.handleSendMessage(client, data);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Service error' });
    });

    it('should pass file metadata when provided', async () => {
      const data = {
        conversationId: 'conv-1',
        content: '',
        type: 'file',
        fileUrl: 'https://cdn.example.com/doc.pdf',
        fileName: 'doc.pdf',
        fileSize: 1024,
        fileMimeType: 'application/pdf',
      };

      await gateway.handleSendMessage(client, data);

      expect(messagesService.sendMessage).toHaveBeenCalledWith(
        'conv-1', 'user-1', '', 'file', undefined, null,
        { fileUrl: 'https://cdn.example.com/doc.pdf', fileName: 'doc.pdf', fileSize: 1024, fileMimeType: 'application/pdf' },
        undefined,
      );
    });

    it('should emit conversation:updated with last message info', async () => {
      await gateway.handleSendMessage(client, { conversationId: 'conv-1', content: 'Test' });

      expect(server._toEmit).toHaveBeenCalledWith('conversation:updated', expect.objectContaining({
        conversationId: 'conv-1',
        lastMessage: expect.objectContaining({
          content: 'Test',
          senderId: 'user-1',
        }),
      }));
    });
  });

  // ── message:edit ─────────────────────────────────────────────────────

  describe('message:edit', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
    });

    it('should edit a message and broadcast message:edited', async () => {
      const data = { messageId: 'msg-1', content: 'Edited content', conversationId: 'conv-1' };

      await gateway.handleEditMessage(client, data);

      expect(messagesService.editMessage).toHaveBeenCalledWith('msg-1', 'user-1', 'Edited content');
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('message:edited', expect.any(Object));
    });

    it('should emit error on edit failure', async () => {
      messagesService.editMessage.mockRejectedValue(new Error('Forbidden'));

      await gateway.handleEditMessage(client, {
        messageId: 'msg-1', content: 'hack', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Forbidden' });
    });

    it('should rate limit edits to 30/min', async () => {
      for (let i = 0; i < 30; i++) {
        await gateway.handleEditMessage(client, {
          messageId: `msg-${i}`, content: 'edit', conversationId: 'conv-1',
        });
      }
      client.emit.mockClear();

      await gateway.handleEditMessage(client, {
        messageId: 'msg-31', content: 'edit', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
      expect(messagesService.editMessage).toHaveBeenCalledTimes(30);
    });
  });

  // ── message:delete ───────────────────────────────────────────────────

  describe('message:delete', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
    });

    it('should delete a message and broadcast message:deleted', async () => {
      await gateway.handleDeleteMessage(client, { messageId: 'msg-1', conversationId: 'conv-1' });

      expect(messagesService.deleteMessage).toHaveBeenCalledWith('msg-1', 'user-1');
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('message:deleted', { messageId: 'msg-1' });
    });

    it('should emit error on delete failure', async () => {
      messagesService.deleteMessage.mockRejectedValue(new Error('Not found'));

      await gateway.handleDeleteMessage(client, { messageId: 'msg-1', conversationId: 'conv-1' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Not found' });
    });

    it('should rate limit deletes to 30/min', async () => {
      for (let i = 0; i < 30; i++) {
        await gateway.handleDeleteMessage(client, {
          messageId: `msg-${i}`, conversationId: 'conv-1',
        });
      }
      client.emit.mockClear();

      await gateway.handleDeleteMessage(client, { messageId: 'msg-31', conversationId: 'conv-1' });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
    });
  });

  // ── message:read ─────────────────────────────────────────────────────

  describe('message:read', () => {
    it('should mark conversation as read and emit conversation:read', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handleMarkAsRead(client, { conversationId: 'conv-1' });

      expect(messagesService.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('conversation:read', expect.objectContaining({
        conversationId: 'conv-1',
        userId: 'user-1',
        readAt: expect.any(Date),
      }));
    });

    it('should silently ignore errors', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);
      messagesService.markAsRead.mockRejectedValue(new Error('fail'));

      // Should not throw
      await expect(gateway.handleMarkAsRead(client, { conversationId: 'conv-1' }))
        .resolves.not.toThrow();
    });
  });

  // ── message:reaction ─────────────────────────────────────────────────

  describe('message:reaction', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
    });

    it('should toggle reaction and broadcast reaction:update', async () => {
      await gateway.handleReaction(client, {
        messageId: 'msg-1', emoji: '👍', conversationId: 'conv-1',
      });

      expect(messagesService.addReaction).toHaveBeenCalledWith('msg-1', 'user-1', '👍');
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('message:reaction:update', expect.objectContaining({
        messageId: 'msg-1',
      }));
    });

    it('should rate limit reactions to 20/min', async () => {
      for (let i = 0; i < 20; i++) {
        await gateway.handleReaction(client, {
          messageId: `msg-${i}`, emoji: '👍', conversationId: 'conv-1',
        });
      }
      client.emit.mockClear();

      await gateway.handleReaction(client, {
        messageId: 'msg-21', emoji: '👍', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
    });

    it('should reject emoji longer than 20 characters', async () => {
      await gateway.handleReaction(client, {
        messageId: 'msg-1', emoji: 'x'.repeat(21), conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid emoji' });
      expect(messagesService.addReaction).not.toHaveBeenCalled();
    });

    it('should reject empty emoji', async () => {
      await gateway.handleReaction(client, {
        messageId: 'msg-1', emoji: '', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid emoji' });
    });

    it('should emit error on service failure', async () => {
      messagesService.addReaction.mockRejectedValue(new Error('Not found'));

      await gateway.handleReaction(client, {
        messageId: 'msg-1', emoji: '👍', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Not found' });
    });
  });

  // ── typing:start / typing:stop ───────────────────────────────────────

  describe('typing:start', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      // client.to should emit to the room excluding sender
      client.to = jest.fn().mockReturnValue({ emit: jest.fn() });
      await gateway.handleConnection(client);
    });

    it('should emit typing indicator to conversation room', async () => {
      await gateway.handleTypingStart(client, { conversationId: 'conv-1' });

      expect(client.to).toHaveBeenCalledWith('conv:conv-1');
      expect(client.to('conv:conv-1').emit).toHaveBeenCalledWith('typing', {
        conversationId: 'conv-1',
        userId: 'user-1',
        typing: true,
      });
    });

    it('should auto-clear typing after 7s TTL', async () => {
      jest.useFakeTimers();
      await gateway.handleTypingStart(client, { conversationId: 'conv-1' });

      jest.advanceTimersByTime(7_001);

      // Server should emit typing:false after TTL
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('typing', {
        conversationId: 'conv-1',
        userId: 'user-1',
        typing: false,
      });
      jest.useRealTimers();
    });

    it('should rate limit typing:start to 60/min', async () => {
      for (let i = 0; i < 60; i++) {
        await gateway.handleTypingStart(client, { conversationId: 'conv-1' });
      }
      client.to.mockClear();

      await gateway.handleTypingStart(client, { conversationId: 'conv-1' });

      // Should silently drop (no error emitted, no typing emitted)
      expect(client.to).not.toHaveBeenCalled();
    });
  });

  describe('typing:stop', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      client.to = jest.fn().mockReturnValue({ emit: jest.fn() });
      await gateway.handleConnection(client);
    });

    it('should emit typing:false and clear TTL timer', async () => {
      // Start typing first to set a timer
      await gateway.handleTypingStart(client, { conversationId: 'conv-1' });

      await gateway.handleTypingStop(client, { conversationId: 'conv-1' });

      expect(client.to).toHaveBeenCalledWith('conv:conv-1');
      expect(client.to('conv:conv-1').emit).toHaveBeenCalledWith('typing', {
        conversationId: 'conv-1',
        userId: 'user-1',
        typing: false,
      });
    });
  });

  // ── thread:reply ─────────────────────────────────────────────────────

  describe('thread:reply', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
    });

    it('should create reply and broadcast thread:new-reply', async () => {
      const reply = createMockMessage({ _id: 'reply-1', content: 'Reply text' });
      messagesService.sendMessage.mockResolvedValue(reply);

      await gateway.handleThreadReply(client, {
        threadId: 'thread-1', content: 'Reply text', conversationId: 'conv-1',
      });

      expect(messagesService.sendMessage).toHaveBeenCalledWith(
        'conv-1', 'user-1', 'Reply text', 'text', undefined, null,
      );
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('thread:new-reply', expect.objectContaining({
        threadId: 'thread-1',
        reply,
        conversationId: 'conv-1',
      }));
    });

    it('should rate limit thread replies to 30/min', async () => {
      for (let i = 0; i < 30; i++) {
        await gateway.handleThreadReply(client, {
          threadId: 'thread-1', content: `reply-${i}`, conversationId: 'conv-1',
        });
      }
      client.emit.mockClear();

      await gateway.handleThreadReply(client, {
        threadId: 'thread-1', content: 'too many', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        code: 'RATE_LIMITED',
      }));
    });

    it('should return silently if conversationId is missing', async () => {
      await gateway.handleThreadReply(client, {
        threadId: 'thread-1', content: 'reply', conversationId: '',
      });

      expect(messagesService.sendMessage).not.toHaveBeenCalled();
    });

    it('should emit error on service failure', async () => {
      messagesService.sendMessage.mockRejectedValue(new Error('Thread error'));

      await gateway.handleThreadReply(client, {
        threadId: 'thread-1', content: 'reply', conversationId: 'conv-1',
      });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Thread error' });
    });
  });

  // ── poll:vote ────────────────────────────────────────────────────────

  describe('poll:vote', () => {
    it('should broadcast poll:updated to conversation room', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handlePollVote(client, {
        messageId: 'msg-poll-1', optionId: 'opt-1', conversationId: 'conv-1',
      });

      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('poll:updated', {
        messageId: 'msg-poll-1',
        optionId: 'opt-1',
        userId: 'user-1',
      });
    });

    it('should return silently if conversationId is missing', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handlePollVote(client, {
        messageId: 'msg-1', optionId: 'opt-1', conversationId: '',
      });

      expect(server.to).not.toHaveBeenCalledWith('conv:');
    });
  });

  // ── presence:heartbeat ───────────────────────────────────────────────

  describe('presence:heartbeat', () => {
    it('should not throw for authenticated user', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await expect(gateway.handlePresenceHeartbeat(client)).resolves.not.toThrow();
    });

    it('should return silently for unauthenticated socket', async () => {
      const client = createMockSocket({ id: 'no-auth' });
      // Not connected
      await expect(gateway.handlePresenceHeartbeat(client)).resolves.not.toThrow();
    });
  });

  // ── message:delivered ────────────────────────────────────────────────

  describe('message:delivered', () => {
    it('should mark message as delivered and emit status update', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handleMessageDelivered(client, {
        messageId: 'msg-1', conversationId: 'conv-1',
      });

      expect(messagesService.markAsDelivered).toHaveBeenCalledWith('msg-1', 'user-1');
      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('message:status-update', expect.objectContaining({
        messageId: 'msg-1',
        status: 'delivered',
        userId: 'user-1',
      }));
    });

    it('should return silently if messageId is missing', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handleMessageDelivered(client, {
        messageId: '', conversationId: 'conv-1',
      });

      expect(messagesService.markAsDelivered).not.toHaveBeenCalled();
    });
  });

  // ── conversation:join ────────────────────────────────────────────────

  describe('conversation:join', () => {
    it('should join room if user is a participant', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);
      conversationModel.findOne.mockResolvedValue(createMockConversation());

      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(client.join).toHaveBeenCalledWith('conv:conv-1');
    });

    it('should emit error if user is not a participant', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);
      conversationModel.findOne.mockResolvedValue(null);

      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Not a participant' });
    });

    it('should return silently if conversationId is missing', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      await gateway.handleJoinConversation(client, { conversationId: '' });

      expect(conversationModel.findOne).not.toHaveBeenCalled();
    });
  });

  // ── Notification publishing ──────────────────────────────────────────

  describe('publishMessageNotifications', () => {
    let client: any;

    beforeEach(async () => {
      client = createMockSocket();
      await gateway.handleConnection(client);
      // Enable Redis mock so notifications actually fire
      (gateway as any).redisClient = {
        publish: jest.fn().mockResolvedValue(1),
      };
    });

    it('should publish notifications to all participants except sender', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation());
      const msg = createMockMessage();

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', msg, 'Hello', 'text',
      );

      const redis = (gateway as any).redisClient;
      // user-2 and user-3 should get notifications, user-1 (sender) should not
      expect(redis.publish).toHaveBeenCalledTimes(2);
      const payloads = redis.publish.mock.calls.map((c: any) => JSON.parse(c[1]));
      expect(payloads.every((p: any) => p.userId !== 'user-1')).toBe(true);
      expect(payloads.map((p: any) => p.userId).sort()).toEqual(['user-2', 'user-3']);
    });

    it('should skip muted participants', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        participants: [
          { userId: 'user-1', muted: false, notifyPreference: 'all' },
          { userId: 'user-2', muted: true, notifyPreference: 'all' },
          { userId: 'user-3', muted: false, notifyPreference: 'all' },
        ],
      }));

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hello', 'text',
      );

      const redis = (gateway as any).redisClient;
      expect(redis.publish).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(redis.publish.mock.calls[0][1]);
      expect(payload.userId).toBe('user-3');
    });

    it('should respect notifyPreference: nothing', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        participants: [
          { userId: 'user-1', muted: false, notifyPreference: 'all' },
          { userId: 'user-2', muted: false, notifyPreference: 'nothing' },
        ],
      }));

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hello', 'text',
      );

      expect((gateway as any).redisClient.publish).not.toHaveBeenCalled();
    });

    it('should respect notifyPreference: mentions (skip when not mentioned)', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        participants: [
          { userId: 'user-1', muted: false, notifyPreference: 'all' },
          { userId: 'user-2', muted: false, notifyPreference: 'mentions' },
        ],
      }));
      mentionsService.getMentionedUserIds.mockReturnValue([]);

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hello no mention', 'text',
      );

      expect((gateway as any).redisClient.publish).not.toHaveBeenCalled();
    });

    it('should notify mentions-only user when they are mentioned', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        participants: [
          { userId: 'user-1', muted: false, notifyPreference: 'all' },
          { userId: 'user-2', muted: false, notifyPreference: 'mentions' },
        ],
      }));
      mentionsService.getMentionedUserIds.mockReturnValue(['user-2']);

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hey @user-2', 'text',
      );

      const redis = (gateway as any).redisClient;
      expect(redis.publish).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(redis.publish.mock.calls[0][1]);
      expect(payload.userId).toBe('user-2');
      expect(payload.type).toBe('mention');
      expect(payload.body).toContain('Mentioned you');
    });

    it('should not publish if Redis is unavailable', async () => {
      (gateway as any).redisClient = null;

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hello', 'text',
      );
      // Should return early with no errors
    });

    it('should set direct conversation title to senderName', async () => {
      conversationModel.findOne.mockResolvedValue(createMockConversation({
        type: 'direct',
        participants: [
          { userId: 'user-1', muted: false, notifyPreference: 'all' },
          { userId: 'user-2', muted: false, notifyPreference: 'all' },
        ],
      }));

      await (gateway as any).publishMessageNotifications(
        'conv-1', 'user-1', createMockMessage(), 'Hello', 'text',
      );

      const payload = JSON.parse((gateway as any).redisClient.publish.mock.calls[0][1]);
      expect(payload.title).toBe('Alice');
    });
  });

  describe('publishThreadReplyNotifications', () => {
    beforeEach(() => {
      (gateway as any).redisClient = {
        publish: jest.fn().mockResolvedValue(1),
      };
    });

    it('should notify thread followers except sender', async () => {
      messageModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'thread-1',
          threadInfo: { followers: ['user-1', 'user-2', 'user-3'] },
        }),
      });
      conversationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(createMockConversation()),
      });

      const reply = createMockMessage({ _id: 'reply-1' });
      await (gateway as any).publishThreadReplyNotifications(
        'conv-1', 'thread-1', 'user-1', reply, 'Thread reply',
      );

      const redis = (gateway as any).redisClient;
      expect(redis.publish).toHaveBeenCalledTimes(2);
      const payloads = redis.publish.mock.calls.map((c: any) => JSON.parse(c[1]));
      expect(payloads.every((p: any) => p.type === 'thread_reply')).toBe(true);
      expect(payloads.every((p: any) => p.userId !== 'user-1')).toBe(true);
    });

    it('should skip if root message has no followers', async () => {
      messageModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'thread-1',
          threadInfo: { followers: [] },
        }),
      });

      await (gateway as any).publishThreadReplyNotifications(
        'conv-1', 'thread-1', 'user-1', createMockMessage(), 'reply',
      );

      expect((gateway as any).redisClient.publish).not.toHaveBeenCalled();
    });

    it('should not publish if Redis is unavailable', async () => {
      (gateway as any).redisClient = null;

      // Should not throw
      await (gateway as any).publishThreadReplyNotifications(
        'conv-1', 'thread-1', 'user-1', createMockMessage(), 'reply',
      );
    });
  });

  // ── sanitizeNotificationText ─────────────────────────────────────────

  describe('sanitizeNotificationText', () => {
    it('should strip HTML tags', () => {
      const result = (gateway as any).sanitizeNotificationText('<b>bold</b> <script>evil</script>');
      expect(result).toBe('bold evil');
    });

    it('should decode HTML entities', () => {
      const result = (gateway as any).sanitizeNotificationText('a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;');
      expect(result).toBe('a & b < c > d "e" \'f\'');
    });

    it('should strip control characters', () => {
      const result = (gateway as any).sanitizeNotificationText('hello\x00\x01\x1Fworld');
      expect(result).toBe('helloworld');
    });

    it('should truncate to 200 characters', () => {
      const long = 'a'.repeat(250);
      const result = (gateway as any).sanitizeNotificationText(long);
      expect(result).toHaveLength(200);
    });

    it('should return empty string for falsy input', () => {
      expect((gateway as any).sanitizeNotificationText('')).toBe('');
      expect((gateway as any).sanitizeNotificationText(null)).toBe('');
      expect((gateway as any).sanitizeNotificationText(undefined)).toBe('');
    });
  });

  // ── formatNotificationPreview ────────────────────────────────────────

  describe('formatNotificationPreview', () => {
    it('should return "sent a photo" for image type', () => {
      expect((gateway as any).formatNotificationPreview('image')).toBe('sent a photo');
    });

    it('should return "sent a video" for video type', () => {
      expect((gateway as any).formatNotificationPreview('video')).toBe('sent a video');
    });

    it('should include fileName for file type', () => {
      expect((gateway as any).formatNotificationPreview('file', '', 'report.pdf')).toBe('sent report.pdf');
    });

    it('should return "a file" when fileName missing for file type', () => {
      expect((gateway as any).formatNotificationPreview('file', '', undefined)).toBe('sent a file');
    });

    it('should return "Voice message" for audio type', () => {
      expect((gateway as any).formatNotificationPreview('audio')).toBe('Voice message');
    });

    it('should return truncated poll body for poll type', () => {
      const result = (gateway as any).formatNotificationPreview('poll', 'What is your favorite color?');
      expect(result).toBe('Poll: What is your favorite color?');
    });

    it('should return text body truncated to 200 for default type', () => {
      const long = 'x'.repeat(300);
      const result = (gateway as any).formatNotificationPreview('text', long);
      expect(result).toHaveLength(200);
    });

    it('should return "shared a code snippet" for code type', () => {
      expect((gateway as any).formatNotificationPreview('code')).toBe('shared a code snippet');
    });
  });

  // ── Helper methods ───────────────────────────────────────────────────

  describe('helper methods', () => {
    it('emitToConversation should emit to the correct room', () => {
      gateway.emitToConversation('conv-1', 'test-event', { data: 'test' });

      expect(server.to).toHaveBeenCalledWith('conv:conv-1');
      expect(server._toEmit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('getOnlineUserIds should return all connected user IDs', async () => {
      const client1 = createMockSocket({ id: 'socket-1' });
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      await gateway.handleConnection(client1);

      const client2 = createMockSocket({ id: 'socket-2' });
      jwtService.verify.mockReturnValue({ sub: 'user-2' });
      await gateway.handleConnection(client2);

      const onlineIds = gateway.getOnlineUserIds();
      expect(onlineIds).toContain('user-1');
      expect(onlineIds).toContain('user-2');
    });

    it('isUserOnline should return correct status', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client);

      expect(gateway.isUserOnline('user-1')).toBe(true);
      expect(gateway.isUserOnline('user-999')).toBe(false);
    });
  });

  // ── Rate limiting internals ──────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('should allow requests within the limit (in-memory fallback)', async () => {
      // No redis client = in-memory
      (gateway as any).redisClient = null;

      const allowed = await (gateway as any).checkRateLimit('user-test', 'test-event', 5, 60000);
      expect(allowed).toBe(true);
    });

    it('should block requests over the limit (in-memory fallback)', async () => {
      (gateway as any).redisClient = null;

      for (let i = 0; i < 5; i++) {
        await (gateway as any).checkRateLimit('user-block', 'block-event', 5, 60000);
      }
      const blocked = await (gateway as any).checkRateLimit('user-block', 'block-event', 5, 60000);
      expect(blocked).toBe(false);
    });

    it('should use Redis when available', async () => {
      (gateway as any).redisClient = {
        incr: jest.fn().mockResolvedValue(1),
        pExpire: jest.fn().mockResolvedValue(true),
      };

      const allowed = await (gateway as any).checkRateLimit('user-redis', 'redis-event', 10, 60000);
      expect(allowed).toBe(true);
      expect((gateway as any).redisClient.incr).toHaveBeenCalledWith('ratelimit:user-redis:redis-event');
      expect((gateway as any).redisClient.pExpire).toHaveBeenCalledWith('ratelimit:user-redis:redis-event', 60000);
    });

    it('should set expiry only on first increment (count === 1)', async () => {
      (gateway as any).redisClient = {
        incr: jest.fn().mockResolvedValue(5),
        pExpire: jest.fn(),
      };

      await (gateway as any).checkRateLimit('user-redis2', 'event', 10, 60000);
      expect((gateway as any).redisClient.pExpire).not.toHaveBeenCalled();
    });

    it('should fall back to in-memory when Redis errors', async () => {
      (gateway as any).redisClient = {
        incr: jest.fn().mockRejectedValue(new Error('Redis down')),
      };

      const allowed = await (gateway as any).checkRateLimit('user-fallback', 'fallback-event', 10, 60000);
      expect(allowed).toBe(true);
    });
  });

  // ── onModuleDestroy ──────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should clear the rate limit cleanup interval', () => {
      // Simulate afterInit setting the interval
      (gateway as any).rateLimitCleanupInterval = setInterval(() => {}, 60000);

      gateway.onModuleDestroy();

      expect((gateway as any).rateLimitCleanupInterval).toBeNull();
    });

    it('should handle null cleanup interval gracefully', () => {
      (gateway as any).rateLimitCleanupInterval = null;

      expect(() => gateway.onModuleDestroy()).not.toThrow();
    });
  });
});
