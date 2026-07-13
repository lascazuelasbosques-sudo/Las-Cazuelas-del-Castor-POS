const CACHE_NAME = 'walkie-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notifications for background messages
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nuevo Mensaje de Radio';
  const options = {
    body: data.body || 'Alguien está hablando por el walkie talkie...',
    icon: '/logo_las_cazuelas_del_castor.jpg',
    badge: '/logo_las_cazuelas_del_castor.jpg',
    vibrate: [200, 100, 200],
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
