// عامل الخدمة (Service Worker) لمنصة السكن.
// القاعدة الأمنية: لا نخزّن أي صفحة أو استجابة فيها بيانات مستخدم. نخزّن فقط الملفات الثابتة العامة
// (سكربتات وخطوط وأيقونات وبيانات المصحف)، وصفحة «لا اتصال» الجاهزة.

// ارفع رقم النسخة عند تعديل offline.html ليُعاد تخزينه عند الأجهزة
const STATIC_CACHE = "yurt-static-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icon", "/apple-icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // فشل ملف واحد لا يمنع تثبيت الباقي
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // يحذف كل كاش غير الحالي، ومنه كاش النسخة القديمة (yurt-platform-v1) الذي كان يحوي صفحات المستخدمين
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// ملفات عامة لا تتغير بتغيّر المستخدم
function isStaticAsset(url) {
  const p = url.pathname;
  return p.startsWith("/_next/static/") || p.startsWith("/quran/") || p === "/icon" || p === "/apple-icon" || p === "/manifest.webmanifest";
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return hit ?? (await refresh) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // التنقل بين الصفحات: الشبكة فقط، وعند الانقطاع نعرض صفحة «لا اتصال». الصفحات لا تُخزَّن أبداً.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }

  if (isStaticAsset(url)) {
    // ملفات Next ثابتة باسم مُجزَّأ (hash) فلا تتغير؛ والباقي نحدّثه في الخلفية
    event.respondWith(url.pathname.startsWith("/_next/static/") ? cacheFirst(request) : staleWhileRevalidate(request));
  }
  // أي طلب آخر (بيانات، RSC، API) يمرّ للشبكة مباشرة بلا تدخل
});

// إشعارات تذكير الصلاة (Web Push). الحمولة: { title, body, url, tag }
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "منصة السكن", {
      body: payload.body,
      icon: "/icon",
      badge: "/icon",
      dir: "rtl",
      lang: "ar",
      // نفس الوسم يستبدل الإشعار السابق بدل تراكمها
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      vibrate: [120, 60, 120],
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
