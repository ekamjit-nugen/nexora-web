/**
 * Nexora Service Worker — handles push notifications.
 *
 * Registered by the frontend on login. Receives push events from
 * FCM/Web Push and shows native notifications.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Nexora', body: event.data.text() };
  }

  const title = data.title || 'Nexora';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.conversationId || data.type || 'default',
    data: {
      url: data.clickUrl || '/',
      conversationId: data.conversationId,
      type: data.type,
    },
    actions: [],
    requireInteraction: data.priority === 'critical',
  };

  // Add reply action for messages
  if (data.type === 'message' || data.type === 'dm') {
    options.actions.push({ action: 'reply', title: 'Reply' });
  }

  // Add answer/decline for calls
  if (data.type === 'call') {
    options.actions.push({ action: 'answer', title: 'Answer' });
    options.actions.push({ action: 'decline', title: 'Decline' });
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  let url = data.url || '/';

  if (action === 'reply' && data.conversationId) {
    url = `/messages?chat=${data.conversationId}`;
  } else if (action === 'answer' && data.conversationId) {
    url = `/messages?chat=${data.conversationId}&answer=true`;
  } else if (data.conversationId) {
    url = `/messages?chat=${data.conversationId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes('/messages') && 'focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
