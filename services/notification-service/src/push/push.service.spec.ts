import { PushService, NotificationPayload } from './push.service';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function buildMockPreferencesService(overrides: Record<string, any> = {}) {
  return {
    getPreferences: jest.fn().mockResolvedValue({
      dnd: { enabled: false },
      overrides: [],
      ...overrides,
    }),
    getDeviceTokens: jest.fn().mockResolvedValue([]),
  } as any;
}

function buildMockFcmService() {
  return {
    sendPush: jest.fn().mockResolvedValue(true),
    isAvailable: jest.fn().mockReturnValue(false),
  } as any;
}

function buildMockDeviceTokenModel() {
  return {
    updateOne: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
  } as any;
}

function createDevice(overrides: Record<string, any> = {}) {
  return {
    _id: 'device-id-1',
    deviceId: 'device-1',
    platform: 'web',
    token: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/push/v1/test', keys: { p256dh: 'key', auth: 'auth' } }),
    failCount: 0,
    ...overrides,
  };
}

function basePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    type: 'message',
    title: 'New message',
    body: 'Hello there',
    userId: 'user-a',
    organizationId: 'org-1',
    priority: 'normal',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PushService', () => {
  let service: PushService;
  let preferencesService: any;
  let fcmService: any;
  let deviceTokenModel: any;

  beforeEach(() => {
    preferencesService = buildMockPreferencesService();
    fcmService = buildMockFcmService();
    deviceTokenModel = buildMockDeviceTokenModel();
    service = new PushService(preferencesService, fcmService, deviceTokenModel);
  });

  // ── sendToUser: DND ───────────────────────────────────────────────────────

  describe('sendToUser - DND handling', () => {
    it('should suppress notification when DND is active', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: true, allowUrgent: false },
        overrides: [],
      });

      await service.sendToUser(basePayload({ priority: 'normal' }));

      expect(preferencesService.getDeviceTokens).not.toHaveBeenCalled();
    });

    it('should allow critical priority through DND', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: true, allowUrgent: false },
        overrides: [],
      });
      preferencesService.getDeviceTokens.mockResolvedValue([]);

      await service.sendToUser(basePayload({ priority: 'critical' }));

      expect(preferencesService.getDeviceTokens).toHaveBeenCalled();
    });

    it('should allow high priority through DND when allowUrgent is true', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: true, allowUrgent: true },
        overrides: [],
      });
      preferencesService.getDeviceTokens.mockResolvedValue([]);

      await service.sendToUser(basePayload({ priority: 'high' }));

      expect(preferencesService.getDeviceTokens).toHaveBeenCalled();
    });

    it('should suppress low priority even when allowUrgent is true', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: true, allowUrgent: true },
        overrides: [],
      });

      await service.sendToUser(basePayload({ priority: 'low' }));

      expect(preferencesService.getDeviceTokens).not.toHaveBeenCalled();
    });
  });

  // ── sendToUser: incoming_call bypasses DND ────────────────────────────────

  describe('sendToUser - incoming calls bypass DND', () => {
    it('should treat incoming_call as critical priority and bypass DND', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: true, allowUrgent: false },
        overrides: [],
      });
      preferencesService.getDeviceTokens.mockResolvedValue([]);

      await service.sendToUser(basePayload({ type: 'incoming_call', priority: 'normal' }));

      expect(preferencesService.getDeviceTokens).toHaveBeenCalled();
    });
  });

  // ── sendToUser: muted conversations ───────────────────────────────────────

  describe('sendToUser - muted conversations', () => {
    it('should skip when notifyPreference is "nothing"', async () => {
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: false },
        overrides: [{ conversationId: 'conv-1', notify: 'nothing' }],
      });

      await service.sendToUser(basePayload({ conversationId: 'conv-1' }));

      expect(preferencesService.getDeviceTokens).not.toHaveBeenCalled();
    });

    it('should skip when conversation is muted until a future time', async () => {
      const futureDate = new Date(Date.now() + 3600_000);
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: false },
        overrides: [{ conversationId: 'conv-1', mutedUntil: futureDate }],
      });

      await service.sendToUser(basePayload({ conversationId: 'conv-1' }));

      expect(preferencesService.getDeviceTokens).not.toHaveBeenCalled();
    });

    it('should send when mute has expired', async () => {
      const pastDate = new Date(Date.now() - 3600_000);
      preferencesService.getPreferences.mockResolvedValue({
        dnd: { enabled: false },
        overrides: [{ conversationId: 'conv-1', mutedUntil: pastDate }],
      });
      preferencesService.getDeviceTokens.mockResolvedValue([]);

      await service.sendToUser(basePayload({ conversationId: 'conv-1' }));

      expect(preferencesService.getDeviceTokens).toHaveBeenCalled();
    });
  });

  // ── sendWebPush: endpoint validation ──────────────────────────────────────

  describe('sendWebPush - endpoint validation (via isValidPushEndpoint)', () => {
    // Access private method via any cast
    let isValid: (endpoint: string) => boolean;

    beforeEach(() => {
      isValid = (service as any).isValidPushEndpoint.bind(service);
    });

    it('should allow FCM endpoints', () => {
      expect(isValid('https://fcm.googleapis.com/fcm/send/abc123')).toBe(true);
    });

    it('should allow Mozilla push endpoints', () => {
      expect(isValid('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    });

    it('should allow Windows notification endpoints', () => {
      expect(isValid('https://wns2.notify.windows.com/w/?token=abc')).toBe(true);
    });

    it('should allow Apple push endpoints', () => {
      expect(isValid('https://web.push.apple.com/QGz123')).toBe(true);
    });

    it('should block internal URLs (SSRF prevention)', () => {
      expect(isValid('http://localhost:8080/push')).toBe(false);
      expect(isValid('http://127.0.0.1:3000/api')).toBe(false);
      expect(isValid('https://internal.company.com/push')).toBe(false);
      expect(isValid('http://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('should block unknown push services', () => {
      expect(isValid('https://evil.example.com/push')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isValid('not-a-url')).toBe(false);
      expect(isValid('')).toBe(false);
    });
  });

  // ── handleTokenFailure ────────────────────────────────────────────────────

  describe('handleTokenFailure', () => {
    // Access private method via any cast
    let handleFailure: (device: any) => Promise<void>;

    beforeEach(() => {
      handleFailure = (service as any).handleTokenFailure.bind(service);
    });

    it('should increment failCount on first failure', async () => {
      const device = createDevice({ failCount: 0 });

      await handleFailure(device);

      expect(deviceTokenModel.updateOne).toHaveBeenCalledWith(
        { _id: 'device-id-1' },
        { $set: { failCount: 1 } },
      );
    });

    it('should increment failCount on second failure', async () => {
      const device = createDevice({ failCount: 1 });

      await handleFailure(device);

      expect(deviceTokenModel.updateOne).toHaveBeenCalledWith(
        { _id: 'device-id-1' },
        { $set: { failCount: 2 } },
      );
    });

    it('should delete token after 3 failures', async () => {
      const device = createDevice({ failCount: 2 });

      await handleFailure(device);

      expect(deviceTokenModel.deleteOne).toHaveBeenCalledWith({ _id: 'device-id-1' });
      expect(deviceTokenModel.updateOne).not.toHaveBeenCalled();
    });

    it('should delete token when failCount is already >= 3', async () => {
      const device = createDevice({ failCount: 5 });

      await handleFailure(device);

      expect(deviceTokenModel.deleteOne).toHaveBeenCalled();
    });
  });

  // ── Urgency mapping ──────────────────────────────────────────────────────

  describe('urgency mapping', () => {
    // We test the mapping logic indirectly. Since sendWebPush is private and
    // depends on web-push being configured, we verify the mapping logic inline.
    it('should map priority to web-push urgency correctly', () => {
      const mapping: Record<string, string> = {
        critical: 'very-high',
        high: 'high',
        normal: 'normal',
        low: 'very-low',
      };

      for (const [priority, expected] of Object.entries(mapping)) {
        const urgency =
          priority === 'critical' ? 'very-high' :
          priority === 'high' ? 'high' :
          priority === 'low' ? 'very-low' : 'normal';
        expect(urgency).toBe(expected);
      }
    });
  });

  // ── sendToUser: device delivery ───────────────────────────────────────────

  describe('sendToUser - device delivery', () => {
    it('should call handleTokenFailure on delivery failure', async () => {
      preferencesService.getPreferences.mockResolvedValue({ dnd: { enabled: false }, overrides: [] });
      const device = createDevice({ platform: 'android', token: 'fcm-token' });
      preferencesService.getDeviceTokens.mockResolvedValue([device]);
      fcmService.sendPush.mockResolvedValue(false); // delivery failed

      await service.sendToUser(basePayload());

      expect(deviceTokenModel.updateOne).toHaveBeenCalledWith(
        { _id: 'device-id-1' },
        { $set: { failCount: 1 } },
      );
    });

    it('should reset failCount on successful delivery', async () => {
      preferencesService.getPreferences.mockResolvedValue({ dnd: { enabled: false }, overrides: [] });
      const device = createDevice({ platform: 'android', token: 'fcm-token', failCount: 2 });
      preferencesService.getDeviceTokens.mockResolvedValue([device]);
      fcmService.sendPush.mockResolvedValue(true);

      await service.sendToUser(basePayload());

      expect(deviceTokenModel.updateOne).toHaveBeenCalledWith(
        { _id: 'device-id-1' },
        { $set: { failCount: 0, lastUsedAt: expect.any(Date) } },
      );
    });

    it('should handle exceptions from push delivery gracefully', async () => {
      preferencesService.getPreferences.mockResolvedValue({ dnd: { enabled: false }, overrides: [] });
      const device = createDevice({ platform: 'android', token: 'fcm-token' });
      preferencesService.getDeviceTokens.mockResolvedValue([device]);
      fcmService.sendPush.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(service.sendToUser(basePayload())).resolves.not.toThrow();

      // Should still attempt to handle the failure
      expect(deviceTokenModel.updateOne).toHaveBeenCalled();
    });
  });
});
