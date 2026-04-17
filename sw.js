importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDQSPs6oly79c18Nyi-SP_WJlp52l9Ja7g",
  authDomain: "hookahtalya-b865f.firebaseapp.com",
  projectId: "hookahtalya-b865f",
  storageBucket: "hookahtalya-b865f.firebasestorage.app",
  messagingSenderId: "635656922703",
  appId: "1:635656922703:web:a27e2c407484ed641b2c3a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(notification.title || "Dessert Cafe Manager", {
    body: notification.body || "Timer finished!",
    tag: data.tag || "dessert-timer",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});
