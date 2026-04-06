/**
 * Test data seeding script.
 * Creates all test users, conversations, channels, and messages
 * for regression testing.
 *
 * Usage:
 *   import { seedCommunicationTestData } from './seed-test-data';
 *   const { users, conversations } = await seedCommunicationTestData(module);
 */

import { TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';

// Test users matching TEST_DATA.md
export const TEST_USERS = [
  { userId: '660000000000000000000001', email: 'alice.owner@nexora-test.io', firstName: 'Alice', lastName: 'Owner', orgRole: 'owner' },
  { userId: '660000000000000000000002', email: 'bob.admin@nexora-test.io', firstName: 'Bob', lastName: 'Admin', orgRole: 'admin' },
  { userId: '660000000000000000000003', email: 'carol.hr@nexora-test.io', firstName: 'Carol', lastName: 'HRManager', orgRole: 'hr' },
  { userId: '660000000000000000000004', email: 'dave.member@nexora-test.io', firstName: 'Dave', lastName: 'Member', orgRole: 'member' },
  { userId: '660000000000000000000005', email: 'eve.member@nexora-test.io', firstName: 'Eve', lastName: 'Member', orgRole: 'member' },
  { userId: '660000000000000000000006', email: 'frank.viewer@nexora-test.io', firstName: 'Frank', lastName: 'Viewer', orgRole: 'viewer' },
];

export const TEST_ORG_ID = 'org_test_001';

export async function seedCommunicationTestData(module: TestingModule) {
  const conversationModel: Model<any> = module.get('ConversationModel');
  const messageModel: Model<any> = module.get('MessageModel');

  // 1. Create direct conversation (Alice ↔ Dave)
  const directConvo = await conversationModel.create({
    organizationId: TEST_ORG_ID,
    type: 'direct',
    participants: [
      { userId: TEST_USERS[0].userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() },
      { userId: TEST_USERS[3].userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() },
    ],
    createdBy: TEST_USERS[0].userId,
  });

  // 2. Create group chat (Bob + Dave + Eve)
  const groupConvo = await conversationModel.create({
    organizationId: TEST_ORG_ID,
    type: 'group',
    name: 'Engineering Standup',
    participants: [
      { userId: TEST_USERS[1].userId, role: 'owner', joinedAt: new Date(), lastReadAt: new Date() },
      { userId: TEST_USERS[3].userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() },
      { userId: TEST_USERS[4].userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() },
    ],
    createdBy: TEST_USERS[1].userId,
  });

  // 3. Create public channel
  const publicChannel = await conversationModel.create({
    organizationId: TEST_ORG_ID,
    type: 'channel',
    channelType: 'public',
    name: 'general',
    topic: 'Company-wide discussions',
    participants: TEST_USERS.slice(0, 5).map(u => ({
      userId: u.userId, role: u.orgRole === 'owner' ? 'owner' : 'member', joinedAt: new Date(), lastReadAt: new Date(),
    })),
    createdBy: TEST_USERS[0].userId,
  });

  // 4. Create announcement channel
  const announcementChannel = await conversationModel.create({
    organizationId: TEST_ORG_ID,
    type: 'channel',
    channelType: 'announcement',
    name: 'announcements',
    topic: 'Company announcements — admins only',
    settings: { whoCanPost: 'admins', whoCanMention: 'admins', whoCanPin: 'admins' },
    participants: TEST_USERS.slice(0, 5).map(u => ({
      userId: u.userId, role: u.orgRole === 'owner' ? 'owner' : u.orgRole === 'admin' ? 'admin' : 'member',
      joinedAt: new Date(), lastReadAt: new Date(),
    })),
    createdBy: TEST_USERS[0].userId,
  });

  // 5. Seed messages in direct convo
  const messages = [];
  for (const text of [
    'Hi Dave, how is the sprint going?',
    'Going well! PR #142 is up for review.',
    'The deployment pipeline needs attention.',
  ]) {
    const msg = await messageModel.create({
      conversationId: directConvo._id.toString(),
      senderId: messages.length % 2 === 0 ? TEST_USERS[0].userId : TEST_USERS[3].userId,
      senderName: messages.length % 2 === 0 ? 'Alice Owner' : 'Dave Member',
      content: text,
      contentPlainText: text,
      type: 'text',
      readBy: [{ userId: TEST_USERS[0].userId, readAt: new Date() }],
    });
    messages.push(msg);
  }

  // 6. Seed messages in public channel
  const channelMessages = [];
  for (const text of [
    'Good morning everyone!',
    'Sprint demo is at 3pm today.',
    '@here Please review the Q2 roadmap.',
  ]) {
    const msg = await messageModel.create({
      conversationId: publicChannel._id.toString(),
      senderId: TEST_USERS[channelMessages.length % 3].userId,
      senderName: `${TEST_USERS[channelMessages.length % 3].firstName} ${TEST_USERS[channelMessages.length % 3].lastName}`,
      content: text,
      contentPlainText: text,
      type: 'text',
      readBy: [],
    });
    channelMessages.push(msg);
  }

  return {
    users: TEST_USERS,
    conversations: {
      direct: directConvo,
      group: groupConvo,
      publicChannel,
      announcementChannel,
    },
    messages,
    channelMessages,
  };
}

export async function clearAllTestData(module: TestingModule) {
  const collections = ['Conversation', 'Message', 'ChatSettings', 'FlaggedMessage',
    'ChannelCategory', 'UserPresence', 'Bookmark', 'Reminder',
    'RetentionPolicy', 'LegalHold', 'DlpRule', 'Webhook'];
  for (const name of collections) {
    try {
      const model = module.get(`${name}Model`);
      await model.deleteMany({});
    } catch { /* skip */ }
  }
}
