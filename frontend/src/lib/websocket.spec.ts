import { WebSocketClient } from './websocket';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockWebSocket: any;

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    global.WebSocket = jest.fn(() => mockWebSocket) as any;
    client = new WebSocketClient({ autoReconnect: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const wsClient = new WebSocketClient();
      expect(wsClient).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const wsClient = new WebSocketClient({
        url: 'ws://custom:8080',
        autoReconnect: false,
        reconnectAttempts: 3,
      });
      expect(wsClient).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect and resolve when WebSocket opens', async () => {
      const connectPromise = client.connect('test-token');

      // Simulate WebSocket open event
      const openHandler = (global.WebSocket as any).mock.calls[0];
      mockWebSocket.onopen();

      await connectPromise;
      expect(client.isConnected()).toBe(true);
    });

    it('should reject on connection error', async () => {
      const connectPromise = client.connect('test-token');

      // Simulate WebSocket error
      mockWebSocket.onerror(new Error('Connection failed'));

      try {
        await connectPromise;
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('Connection failed');
      }
    });
  });

  describe('event subscription', () => {
    it('should subscribe to events', (done) => {
      client.on('organization:created', (data) => {
        expect(data).toEqual({ _id: 'org-1', name: 'Test Org' });
        done();
      });

      // Simulate message
      const message = {
        type: 'organization:created',
        data: { _id: 'org-1', name: 'Test Org' },
        timestamp: Date.now(),
      };
      mockWebSocket.onmessage({ data: JSON.stringify(message) });
    });

    it('should unsubscribe from events', (done) => {
      const callback = jest.fn();
      const unsubscribe = client.on('organization:updated', callback);

      unsubscribe();

      // Simulate message
      const message = {
        type: 'organization:updated',
        data: { _id: 'org-1' },
        timestamp: Date.now(),
      };
      mockWebSocket.onmessage({ data: JSON.stringify(message) });

      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle multiple listeners for same event', (done) => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      client.on('user:created', callback1);
      client.on('user:created', callback2);

      // Simulate message
      const message = {
        type: 'user:created',
        data: { _id: 'user-1', email: 'test@example.com' },
        timestamp: Date.now(),
      };
      mockWebSocket.onmessage({ data: JSON.stringify(message) });

      setTimeout(() => {
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('message sending', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('test-token');
      mockWebSocket.onopen();
      await connectPromise;
    });

    it('should send message when connected', () => {
      const message = {
        type: 'organization:created',
        data: { name: 'Test' },
        timestamp: Date.now(),
      } as any;

      client.send(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should queue message when not connected', () => {
      client.disconnect();
      mockWebSocket.readyState = 0; // CONNECTING

      const message = {
        type: 'organization:created',
        data: { name: 'Test' },
        timestamp: Date.now(),
      } as any;

      client.send(message);

      // Message should be queued, not sent immediately
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect WebSocket', async () => {
      const connectPromise = client.connect('test-token');
      mockWebSocket.onopen();
      await connectPromise;

      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON messages', (done) => {
      const callback = jest.fn();
      client.on('organization:created', callback);

      // Simulate invalid JSON
      mockWebSocket.onmessage({ data: 'invalid json' });

      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle listener errors gracefully', (done) => {
      client.on('organization:created', () => {
        throw new Error('Listener error');
      });

      // Should not throw, just log error
      expect(() => {
        const message = {
          type: 'organization:created',
          data: { _id: 'org-1' },
          timestamp: Date.now(),
        };
        mockWebSocket.onmessage({ data: JSON.stringify(message) });
      }).not.toThrow();

      done();
    });
  });
});
