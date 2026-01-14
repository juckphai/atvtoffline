// service-worker.js
// Offline Version: ตัด Firebase ออก และ Cache ไฟล์ Adapter ใหม่
const staticCacheName = 'account-app-static-v119'; // update version
const dynamicCacheName = 'account-app-dynamic-v119';

// ไฟล์ที่ต้อง cache ตั้งแต่ตอน install
const assets = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './script.js',
  './indexeddb-adapter.js', // ✅ เพิ่มไฟล์นี้
  './192.png',
  './512.png',

  // ไลบรารีภายนอก (เพื่อใช้งาน offline)
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// 1) INSTALL
self.addEventListener('install', evt => {
  console.log('SW installing…');
  evt.waitUntil(
    caches.open(staticCacheName)
      .then(cache => cache.addAll(assets))
      .catch(err => console.error("CACHE ERROR:", err))
  );
  self.skipWaiting();
});

// 2) ACTIVATE
self.addEventListener('activate', evt => {
  console.log('SW activated.');
  evt.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== staticCacheName && k !== dynamicCacheName)
            .map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 3) FETCH
self.addEventListener('fetch', evt => {
  if (!evt.request.url.startsWith('http')) return;

  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      if (cacheRes) {
        return cacheRes; 
      }

      return fetch(evt.request)
        .then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            caches.open(dynamicCacheName).then(cache => {
              cache.put(evt.request, networkRes.clone());
            });
          }
          return networkRes;
        })
        .catch(() => {
          if (evt.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
