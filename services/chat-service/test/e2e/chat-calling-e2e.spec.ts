import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { SearchModule } from '../../src/search/search.module';
import { PinsModule } from '../../src/pins/pins.module';
import { BookmarksModule } from '../../src/bookmarks/bookmarks.module';
import { PollsModule } from '../../src/polls/polls.module';
import { ScheduledMessagesModule } from '../../src/scheduled/scheduled-messages.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

/**
 * First End-to-End Test — Full Communication Stack.
 *
 * Tests a complete user flow through conversations, messages, mentions,
 * edits, file messages, pins, bookmarks, polls, scheduled messages,
 * search, and archiving. Uses real MongoDB via NestJS test app.
 */
describe('E2E: Full Communication Flow', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userAToken: string;
  let userBToken: string;

  const USER_A = '660000000000000000000aaa';
  const USER_B = '660000000000000000000bbb';
  const ORG_ID = 'test-org-e2e';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([
      ConversationsModule,
      MessagesModule,
      SearchModule,
      PinsModule,
      BookmarksModule,
      PollsModule,
      ScheduledMessagesModule,
    ]));

    jwtService = module.get(JwtService);

    userAToken = generateTestToken(jwtService, {
      sub: USER_A,
      email: 'alice@e2e.test',
      firstName: 'Alice',
      lastName: 'Smith',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    userBToken = generateTestToken(jwtService, {
      sub: USER_B,
      email: 'bob@e2e.test',
      firstName: 'Bob',
      lastName: 'Jones',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  afterEach(async () => {
    await clearAllCollections(module);
  });

  it('should complete the full communication flow end-to-end', async () => {
    // ────────────────────────────────────────────────────────
    // Step 1: User A creates a direct conversation with User B
    // ────────────────────────────────────────────────────────
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ targetUserId: USER_B })
      .expect(201);

    expect(convRes.body.success).toBe(true);
    expect(convRes.body.data.type).toBe('direct');
    const conversationId = convRes.body.data._id;
    expect(conversationId).toBeDefined();

    const participantIds = convRes.body.data.participants.map((p: any) => p.userId);
    expect(participantIds).toContain(USER_A);
    expect(participantIds).toContain(USER_B);

    // ────────────────────────────────────────────────────────
    // Step 2: User A sends a message
    // ────────────────────────────────────────────────────────
    const msg1Res = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Hello Bob, how is the project going?', type: 'text' })
      .expect(201);

    expect(msg1Res.body.success).toBe(true);
    const msg1Id = msg1Res.body.data._id;
    expect(msg1Res.body.data.content).toContain('Hello Bob');
    expect(msg1Res.body.data.senderId).toBe(USER_A);

    // Verify the message appears in the conversation
    const msgsRes = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(msgsRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(msgsRes.body.data.some((m: any) => m._id === msg1Id)).toBe(true);

    // ────────────────────────────────────────────────────────
    // Step 3: User A sends a message with @mention of User B
    // ────────────────────────────────────────────────────────
    const mentionRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        content: `Hey <@${USER_B}>, please review the PR`,
        type: 'text',
      })
      .expect(201);

    expect(mentionRes.body.success).toBe(true);
    const mentionMsgId = mentionRes.body.data._id;
    // The mention marker should be preserved in the content
    expect(mentionRes.body.data.content).toContain(`<@${USER_B}>`);

    // ────────────────────────────────────────────────────────
    // Step 4: User A edits the first message
    // ────────────────────────────────────────────────────────
    const editRes = await request(app.getHttpServer())
      .put(`/api/v1/chat/messages/${msg1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Hello Bob, how is the project going? Updated.' })
      .expect(200);

    expect(editRes.body.success).toBe(true);
    expect(editRes.body.data.content).toContain('Updated.');
    expect(editRes.body.data.isEdited).toBe(true);

    // ────────────────────────────────────────────────────────
    // Step 5: User A sends a file message
    // ────────────────────────────────────────────────────────
    const fileRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        content: 'Here is the design doc',
        type: 'file',
      })
      .expect(201);

    expect(fileRes.body.success).toBe(true);
    expect(fileRes.body.data.type).toBe('file');
    const fileMsgId = fileRes.body.data._id;

    // ────────────────────────────────────────────────────────
    // Step 6: User A pins a message
    // ────────────────────────────────────────────────────────
    const pinRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/messages/${msg1Id}/pin`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(pinRes.body.success).toBe(true);

    // Verify pin appears in conversation pins
    const pinsRes = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationId}/pins`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(pinsRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(pinsRes.body.data.some((m: any) => m._id === msg1Id)).toBe(true);

    // ────────────────────────────────────────────────────────
    // Step 7: User A bookmarks a message
    // ────────────────────────────────────────────────────────
    const bookmarkRes = await request(app.getHttpServer())
      .post('/api/v1/chat/bookmarks')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messageId: mentionMsgId,
        label: 'Important PR review',
        note: 'Follow up with Bob',
      })
      .expect(201);

    expect(bookmarkRes.body.success).toBe(true);
    expect(bookmarkRes.body.data.messageId).toBe(mentionMsgId);

    // Verify bookmark appears in list
    const bookmarksRes = await request(app.getHttpServer())
      .get('/api/v1/chat/bookmarks')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(bookmarksRes.body.data.length).toBe(1);
    expect(bookmarksRes.body.data[0].label).toBe('Important PR review');

    // ────────────────────────────────────────────────────────
    // Step 8: User A creates a poll
    // ────────────────────────────────────────────────────────
    const pollRes = await request(app.getHttpServer())
      .post('/api/v1/chat/polls')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId,
        question: 'When should we deploy?',
        options: ['Monday', 'Wednesday', 'Friday'],
      })
      .expect(201);

    expect(pollRes.body.success).toBe(true);
    expect(pollRes.body.data).toBeDefined();
    const pollMsgId = pollRes.body.data._id;

    // The poll data should be embedded in the message
    expect(pollRes.body.data.poll).toBeDefined();
    expect(pollRes.body.data.poll.question).toBe('When should we deploy?');
    expect(pollRes.body.data.poll.options).toHaveLength(3);

    // ────────────────────────────────────────────────────────
    // Step 9: User B votes on the poll
    // ────────────────────────────────────────────────────────
    const optionId = pollRes.body.data.poll.options[1].id; // Wednesday

    const voteRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/polls/${pollMsgId}/vote`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ optionId })
      .expect(200);

    expect(voteRes.body.success).toBe(true);
    // Verify the vote is registered
    const votedOption = voteRes.body.data.poll.options.find(
      (o: any) => o.id === optionId,
    );
    expect(votedOption.votes).toContain(USER_B);

    // ────────────────────────────────────────────────────────
    // Step 10: User A schedules a message
    // ────────────────────────────────────────────────────────
    const scheduledAt = new Date(Date.now() + 3600_000).toISOString();

    const schedRes = await request(app.getHttpServer())
      .post('/api/v1/chat/scheduled')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId,
        content: 'Reminder: standup in 5 minutes',
        scheduledAt,
      })
      .expect(201);

    expect(schedRes.body.success).toBe(true);
    const scheduledMsgId = schedRes.body.data._id;
    expect(schedRes.body.data.status).toBe('scheduled');

    // Verify it appears in scheduled list
    const schedListRes = await request(app.getHttpServer())
      .get('/api/v1/chat/scheduled')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(schedListRes.body.data.length).toBe(1);
    expect(schedListRes.body.data[0]._id).toBe(scheduledMsgId);

    // ────────────────────────────────────────────────────────
    // Step 11: User A cancels the scheduled message
    // ────────────────────────────────────────────────────────
    await request(app.getHttpServer())
      .delete(`/api/v1/chat/scheduled/${scheduledMsgId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // Verify it no longer appears in scheduled list
    const schedListAfterCancel = await request(app.getHttpServer())
      .get('/api/v1/chat/scheduled')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // The cancelled message should either be gone or marked cancelled
    const stillPending = schedListAfterCancel.body.data.filter(
      (m: any) => m.status === 'scheduled',
    );
    expect(stillPending.length).toBe(0);

    // ────────────────────────────────────────────────────────
    // Step 12: User A searches messages
    // ────────────────────────────────────────────────────────
    const searchRes = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationId}/search?q=project`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
    // The edited message should appear in results
    expect(
      searchRes.body.data.some((m: any) => m.content?.includes('project')),
    ).toBe(true);

    // ────────────────────────────────────────────────────────
    // Step 13: User A archives the conversation
    // ────────────────────────────────────────────────────────
    // First pin the conversation (to verify unarchive works separately)
    // Then try to archive by updating the conversation
    // In the ConversationsService, archiving is done via muteConversation
    // or directly via the model. Let's verify the archive blocks sending.

    // Directly update the conversation to archived state
    const convModel = module.get('ConversationModel');
    await convModel.updateOne(
      { _id: conversationId },
      { $set: { isArchived: true } },
    );

    // Try to send a message — should be blocked
    const blockedRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'This should fail', type: 'text' })
      .expect(400);

    expect(blockedRes.body.message).toContain('archived');

    // Unarchive and verify sending works again
    await request(app.getHttpServer())
      .put(`/api/v1/chat/conversations/${conversationId}/unarchive`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const afterUnarchiveRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Back in action!', type: 'text' })
      .expect(201);

    expect(afterUnarchiveRes.body.success).toBe(true);

    // ────────────────────────────────────────────────────────
    // Final verification: conversation message count
    // ────────────────────────────────────────────────────────
    const finalMsgs = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationId}/messages?limit=50`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // We sent: msg1 (edited), mention msg, file msg, poll msg, "Back in action"
    // = 5 messages total (scheduled was cancelled before sending)
    expect(finalMsgs.body.data.length).toBe(5);
  });

  // ── Isolated sub-flow tests ──

  describe('Isolation: mention parsing', () => {
    it('should preserve @mention syntax in message content', async () => {
      const conv = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: USER_B });

      const convId = conv.body.data._id;

      const msg = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          content: `<@${USER_B}> check this out @here`,
          type: 'text',
        })
        .expect(201);

      expect(msg.body.data.content).toContain(`<@${USER_B}>`);
      expect(msg.body.data.content).toContain('@here');
    });
  });

  describe('Isolation: poll vote validation', () => {
    it('should register vote and track voter', async () => {
      const conv = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: USER_B });

      const convId = conv.body.data._id;

      const poll = await request(app.getHttpServer())
        .post('/api/v1/chat/polls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          conversationId: convId,
          question: 'Lunch?',
          options: ['Pizza', 'Sushi'],
        })
        .expect(201);

      const optId = poll.body.data.poll.options[0].id;

      const vote = await request(app.getHttpServer())
        .post(`/api/v1/chat/polls/${poll.body.data._id}/vote`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ optionId: optId })
        .expect(200);

      const option = vote.body.data.poll.options.find((o: any) => o.id === optId);
      expect(option.votes).toContain(USER_B);
      expect(option.voteCount).toBe(1);
    });
  });

  describe('Isolation: scheduled message lifecycle', () => {
    it('should schedule, list, and cancel a message', async () => {
      const conv = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: USER_B });

      const convId = conv.body.data._id;
      const scheduledAt = new Date(Date.now() + 7200_000).toISOString();

      // Schedule
      const sched = await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ conversationId: convId, content: 'Future message', scheduledAt })
        .expect(201);

      const schedId = sched.body.data._id;

      // List
      const list = await request(app.getHttpServer())
        .get('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(list.body.data.some((m: any) => m._id === schedId)).toBe(true);

      // Cancel
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/scheduled/${schedId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // Verify gone
      const listAfter = await request(app.getHttpServer())
        .get('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const pending = listAfter.body.data.filter(
        (m: any) => m._id === schedId && m.status === 'scheduled',
      );
      expect(pending.length).toBe(0);
    });
  });

  describe('Isolation: archive blocks sending', () => {
    it('should reject messages to archived conversations', async () => {
      const conv = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetUserId: USER_B });

      const convId = conv.body.data._id;

      // Archive via direct DB update
      const convModel = module.get('ConversationModel');
      await convModel.updateOne({ _id: convId }, { $set: { isArchived: true } });

      // Try sending
      const res = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ content: 'Should fail', type: 'text' })
        .expect(400);

      expect(res.body.message).toContain('archived');
    });
  });
});
