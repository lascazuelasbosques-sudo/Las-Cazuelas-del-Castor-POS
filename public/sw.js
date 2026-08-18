const CACHE_NAME = 'cazuelas-pos-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_las_cazuelas_del_castor.jpg'
];

// Install Event - Pre-cache essential offline shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW Cache addAll warning:', err);
      });
    })
  );
});

// Activate Event - Claim clients & purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate with full offline fallback
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests or chrome-extension or external Firebase backend API requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  if (url.origin !== location.origin || url.pathname.includes('/api/')) {
    return;
  }

  // For SPA Navigation (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallbackIndex = await caches.match('/index.html') || await caches.match('/');
          if (fallbackIndex) return fallbackIndex;
          return new Response('Modo Offline: Las Cazuelas del Castor', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, Images, Fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push and message notifications
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Radio Las Cazuelas', body: event.data ? event.data.text() : 'Nuevo mensaje de radio' };
  }

  const title = data.title || '🚨 ¡ALERTA LAS CAZUELAS!';
  const options = {
    body: data.body || 'Nueva comanda o transmisión de radio recibida.',
    icon: '/logo_las_cazuelas_del_castor.jpg',
    badge: '/logo_las_cazuelas_del_castor.jpg',
    vibrate: [800, 200, 800, 200, 1200, 300, 1200],
    renotify: true,
    requireInteraction: true,
    silent: false,
    tag: data.tag || 'cazuelas-alert-' + Date.now(),
    data: {
      url: data.url || self.registration.scope
    },
    actions: [
      { action: 'open', title: '📲 Abrir Aplicación' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_BACKGROUND_NOTIFICATION') {
    const { title, body, tag, icon } = event.data;
    const options = {
      body: body || 'Alguien está transmitiendo en el Walkie-Talkie...',
      icon: icon || '/logo_las_cazuelas_del_castor.jpg',
      badge: '/logo_las_cazuelas_del_castor.jpg',
      vibrate: [800, 200, 800, 200, 1200, 300, 1200],
      tag: tag || 'cazuelas-radio-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: {
        url: self.registration.scope
      },
      actions: [
        { action: 'open', title: '📻 Abrir Radio' }
      ]
    };
    self.registration.showNotification(title || '🚨 Transmisión de Radio', options);
  }

  if (event.data && event.data.type === 'PRECACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls).catch((err) => console.warn('Precache error:', err));
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data ? event.notification.data.url : '/');
      }
    })
  );
});
