"use strict";

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const FIREBASE_CONFIG_FALLBACK = {
  apiKey: "AIzaSyDQSPs6oly79c18Nyi-SP_WJlp52l9Ja7g",
  authDomain: "hookahtalya-b865f.firebaseapp.com",
  projectId: "hookahtalya-b865f",
  storageBucket: "hookahtalya-b865f.firebasestorage.app",
  messagingSenderId: "635656922703",
  appId: "1:635656922703:web:a27e2c407484ed641b2c3a",
};

const COLLECTION_NAME = "scheduled_notifications";
const MAX_TIMER_MS = 2147483647;

let initialized = false;
let initError = null;
let firestore = null;
let messaging = null;
let timers = new Map();

function envString(name) {
  return String(process.env[name] || "").trim();
}

function log(message, extra) {
  if (extra !== undefined) {
    console.log(`[Push] ${message}`, extra);
    return;
  }
  console.log(`[Push] ${message}`);
}

function readServiceAccountFromEnv() {
  const rawJson = envString("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const rawBase64 = envString("FIREBASE_SERVICE_ACCOUNT_BASE64");
  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
  }

  const configuredPath =
    envString("FIREBASE_SERVICE_ACCOUNT_PATH") ||
    path.join(__dirname, "serviceAccountKey.json");

  if (fs.existsSync(configuredPath)) {
    return JSON.parse(fs.readFileSync(configuredPath, "utf8"));
  }

  return null;
}

function getFirebaseWebConfig() {
  const rawJson = envString("FIREBASE_WEB_CONFIG_JSON");
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch (err) {
      log("Invalid FIREBASE_WEB_CONFIG_JSON", err.message);
    }
  }

  const projectId = envString("FIREBASE_PROJECT_ID");
  const apiKey = envString("FIREBASE_WEB_API_KEY");
  const messagingSenderId = envString("FIREBASE_MESSAGING_SENDER_ID");
  const appId = envString("FIREBASE_WEB_APP_ID");
  const authDomain = envString("FIREBASE_AUTH_DOMAIN");
  const storageBucket = envString("FIREBASE_STORAGE_BUCKET");

  if (projectId && apiKey && messagingSenderId && appId) {
    return {
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket:
        storageBucket || `${projectId}.firebasestorage.app`,
      messagingSenderId,
      appId,
    };
  }

  return FIREBASE_CONFIG_FALLBACK;
}

function getPublicVapidKey() {
  return (
    envString("FIREBASE_VAPID_PUBLIC_KEY") ||
    envString("VAPID_PUBLIC_KEY")
  );
}

function isPushConfigured() {
  return Boolean(messaging && firestore && getPublicVapidKey());
}

function getPushStatus() {
  return {
    supported: isPushConfigured(),
    publicKey: getPublicVapidKey() || null,
    firebaseConfig: getFirebaseWebConfig(),
    reason: initError ? initError.message : null,
  };
}

async function initializePushService() {
  if (initialized) return;
  initialized = true;

  try {
    const serviceAccount = readServiceAccountFromEnv();
    if (!serviceAccount) {
      log("Firebase service account is not configured; push endpoints will degrade.");
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firestore = admin.firestore();
    messaging = admin.messaging();
    await restorePendingNotifications();
    log("Firebase push service initialized");
  } catch (err) {
    initError = err;
    log("Failed to initialize push service", err.message);
  }
}

function assertPushAvailable() {
  if (!isPushConfigured()) {
    const reason =
      initError?.message ||
      "Push notifications are not configured on this server";
    const error = new Error(reason);
    error.statusCode = 503;
    throw error;
  }
}

function validatePayload(payload) {
  const input = payload && typeof payload === "object" ? payload : {};
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  const tag = String(input.tag || "dessert-timer").trim();
  const url = String(input.url || "/").trim();

  if (!title || !body) {
    const error = new Error("payload.title and payload.body are required");
    error.statusCode = 400;
    throw error;
  }

  return { title, body, tag, url };
}

function validateToken(token) {
  const normalized = String(token || "").trim();
  if (!normalized) {
    const error = new Error("token is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function validateSendAt(sendAt) {
  const numeric = Number(sendAt);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const error = new Error("sendAt must be a valid unix timestamp in milliseconds");
    error.statusCode = 400;
    throw error;
  }
  return Math.trunc(numeric);
}

function buildMessage(token, payload) {
  return {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
      notification: {
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        data: {
          url: payload.url,
        },
      },
      fcmOptions: {
        link: payload.url,
      },
    },
    data: {
      url: payload.url,
      tag: payload.tag,
      title: payload.title,
      body: payload.body,
    },
  };
}

async function sendNotification(token, payload) {
  assertPushAvailable();
  return messaging.send(buildMessage(token, payload));
}

async function sendTestNotification({ token, url }) {
  const normalizedToken = validateToken(token);
  const payload = {
    title: "Dessert Cafe Manager",
    body: "Push notifications are enabled.",
    tag: "notifications-enabled",
    url: String(url || "/").trim() || "/",
  };

  const messageId = await sendNotification(normalizedToken, payload);
  return { ok: true, messageId };
}

function scheduleTimer(notificationId, sendAt) {
  const remaining = sendAt - Date.now();

  if (timers.has(notificationId)) {
    clearTimeout(timers.get(notificationId));
    timers.delete(notificationId);
  }

  if (remaining <= 0) {
    const timer = setTimeout(() => {
      timers.delete(notificationId);
      void deliverScheduledNotification(notificationId);
    }, 250);
    timers.set(notificationId, timer);
    return;
  }

  const timeout = Math.min(remaining, MAX_TIMER_MS);
  const timer = setTimeout(() => {
    timers.delete(notificationId);
    if (remaining > MAX_TIMER_MS) {
      scheduleTimer(notificationId, sendAt);
      return;
    }
    void deliverScheduledNotification(notificationId);
  }, timeout);

  timers.set(notificationId, timer);
}

async function restorePendingNotifications() {
  if (!firestore) return;

  const snapshot = await firestore
    .collection(COLLECTION_NAME)
    .where("active", "==", true)
    .get();

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const sendAt = Number(data.sendAt || 0);
    if (!Number.isFinite(sendAt) || sendAt <= 0) return;
    scheduleTimer(doc.id, sendAt);
  });
}

async function scheduleNotification({ token, sendAt, payload }) {
  assertPushAvailable();

  const normalizedToken = validateToken(token);
  const normalizedSendAt = validateSendAt(sendAt);
  const normalizedPayload = validatePayload(payload);

  const docRef = firestore.collection(COLLECTION_NAME).doc();
  const now = Date.now();
  const job = {
    token: normalizedToken,
    sendAt: normalizedSendAt,
    payload: normalizedPayload,
    active: true,
    sent: false,
    canceled: false,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(job);
  scheduleTimer(docRef.id, normalizedSendAt);

  return {
    ok: true,
    id: docRef.id,
    sendAt: normalizedSendAt,
  };
}

async function cancelNotification({ token, tag }) {
  assertPushAvailable();

  const normalizedToken = validateToken(token);
  const normalizedTag = String(tag || "").trim();
  if (!normalizedTag) {
    const error = new Error("tag is required");
    error.statusCode = 400;
    throw error;
  }

  const snapshot = await firestore
    .collection(COLLECTION_NAME)
    .where("token", "==", normalizedToken)
    .where("active", "==", true)
    .where("payload.tag", "==", normalizedTag)
    .get();

  if (snapshot.empty) {
    return { ok: true, canceled: 0 };
  }

  const batch = firestore.batch();
  let canceled = 0;

  snapshot.forEach((doc) => {
    canceled += 1;
    batch.update(doc.ref, {
      active: false,
      canceled: true,
      updatedAt: Date.now(),
    });
    if (timers.has(doc.id)) {
      clearTimeout(timers.get(doc.id));
      timers.delete(doc.id);
    }
  });

  await batch.commit();
  return { ok: true, canceled };
}

async function deliverScheduledNotification(notificationId) {
  if (!firestore) return;

  const docRef = firestore.collection(COLLECTION_NAME).doc(notificationId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return;

  const data = snapshot.data() || {};
  if (!data.active || data.canceled || data.sent) return;

  try {
    await sendNotification(data.token, validatePayload(data.payload));
    await docRef.update({
      active: false,
      sent: true,
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (err) {
    log(`Failed to deliver notification ${notificationId}`, err.message);
    await docRef.update({
      lastError: err.message,
      updatedAt: Date.now(),
    });
  }
}

module.exports = {
  initializePushService,
  getPushStatus,
  isPushConfigured,
  sendTestNotification,
  scheduleNotification,
  cancelNotification,
};
