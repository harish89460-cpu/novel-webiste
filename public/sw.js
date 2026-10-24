// Service Worker for Rudhra Prarthana Novels
// Handles Web Push background notifications and deep navigation clicks

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Handle incoming Web Push notifications from server
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Rudhra Prarthana Novels',
      body: event.data.text()
    };
  }

  const title = payload.title || 'Rudhra Prarthana Novels';
  const options = {
    body: payload.body || payload.message || 'You have a new update.',
    icon: payload.icon || '/profile.png',
    badge: payload.badge || '/images/logo.png',
    tag: payload.tag || 'rp-notif',
    renotify: true,
    data: payload.data || { url: '#home' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const relativeUrl = event.notification.data?.url || '#home';
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open on this origin, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.startsWith(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
