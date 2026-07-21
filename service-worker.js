const CACHE_NAME = "pjok-teacher-assistant-v2";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/styles.css",
  "./src/data/models.js",
  "./src/data/schema.js",
  "./src/data/seed.js",
  "./src/storage/backup.js",
  "./src/storage/storage.js",
  "./src/repositories/academic-year-repository.js",
  "./src/repositories/base-repository.js",
  "./src/repositories/class-repository.js",
  "./src/repositories/note-repository.js",
  "./src/repositories/repository-context.js",
  "./src/repositories/school-repository.js",
  "./src/repositories/semester-repository.js",
  "./src/repositories/student-repository.js",
  "./src/repositories/tag-repository.js",
  "./src/repositories/teacher-repository.js",
  "./src/ui/form-controls.js",
  "./src/ui/master-data-screen.js",
  "./src/ui/navigation.js",
  "./src/ui/screens.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => caches.match("./index.html"))
      );
    })
  );
});
