const CACHE_NAME = "pjok-teacher-assistant-v30";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/styles.css",
  "./src/data/models.js",
  "./src/data/schema.js",
  "./src/data/seed.js",
  "./src/data/session-state.js",
  "./src/storage/backup.js",
  "./src/storage/storage.js",
  "./src/repositories/academic-year-repository.js",
  "./src/repositories/base-repository.js",
  "./src/repositories/attendance-repository.js",
  "./src/repositories/class-repository.js",
  "./src/repositories/note-repository.js",
  "./src/repositories/repository-context.js",
  "./src/repositories/schedule-repository.js",
  "./src/repositories/session-repository.js",
  "./src/repositories/school-repository.js",
  "./src/repositories/semester-repository.js",
  "./src/repositories/student-repository.js",
  "./src/repositories/tag-repository.js",
  "./src/repositories/teacher-repository.js",
  "./src/repositories/session-activity-repository.js",
  "./src/repositories/assessment-definition-repository.js",
  "./src/repositories/assessment-session-repository.js",
  "./src/repositories/assessment-result-repository.js",
  "./src/repositories/growth-record-repository.js",
  "./src/repositories/observation-repository.js",
  "./src/services/session-manager.js",
  "./src/services/camera-service.js",
  "./src/ui/form-controls.js",
  "./src/ui/first-run-setup.js",
  "./src/ui/classes-screen.js",
  "./src/ui/students-screen.js",
  "./src/ui/settings-screen.js",
  "./src/ui/master-data-screen.js",
  "./src/ui/navigation.js",
  "./src/ui/screens.js",
  "./src/ui/icons.js",
  "./src/ui/student-detail-modal.js",
  "./src/ui/student-avatar.js",
  "./src/ui/student-photo-field.js",
  "./src/ui/camera-modal.js",
  "./src/session/session-screen.js",
  "./src/session/attendance-panel.js",
  "./src/session/activity-panel.js",
  "./src/session/assessment-panel.js",
  "./src/session/summary-panel.js",
  "./src/utils/date-utils.js"
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

  // Network-First, falling back to Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the successful network response for offline availability
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network request fails, fall back to cached copy
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match("./index.html");
        });
      })
  );
});
