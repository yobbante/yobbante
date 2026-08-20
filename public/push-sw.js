/* Yobbanté — service worker dédié aux notifications push (Web Push / VAPID).
   Ce worker ne met RIEN en cache : il gère uniquement les messages push
   et l'ouverture de la bonne page au clic. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'Yobbanté', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Yobbanté';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    requireInteraction: payload.requireInteraction !== false,
    vibrate: [180, 80, 180],
    data: { url: payload.url || '/', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.focus();
            if ('navigate' in client) await client.navigate(target);
            return;
          } catch (_) { /* fallback ci-dessous */ }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
