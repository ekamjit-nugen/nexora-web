/**
 * WebSocket test client helper for Socket.IO integration tests.
 *
 * Usage:
 *   const socket = await createTestSocketClient('/chat', token);
 *   socket.emit('message:send', { conversationId, content: 'Hello' });
 *   const msg = await waitForEvent(socket, 'message:new');
 *   expect(msg.content).toBe('Hello');
 *   socket.disconnect();
 */

export function createTestSocketClient(
  namespace: string,
  token: string,
  port: number = 3002,
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const { io } = await (Function('return import("socket.io-client")')());
      const socket = io(`http://localhost:${port}${namespace}`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timeout (5s)'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });

      socket.on('connect_error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function waitForEvent<T = any>(socket: any, event: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}' (${timeout}ms)`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export function emitAndWait<T = any>(socket: any, emitEvent: string, emitData: any, waitEvent: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${waitEvent}' after emitting '${emitEvent}'`)), timeout);
    socket.once(waitEvent, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
    socket.emit(emitEvent, emitData);
  });
}
