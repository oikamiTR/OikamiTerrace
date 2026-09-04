const CACHE_NAME = "voice-reader-v2";
const APP_SHELL = ["./index.html", "./manifest.webmanifest"];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// network-first: always prefer the latest deployed files when online,
// only fall back to the cached copy when the network is unavailable.
self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
      return res;
    }).catch(function(){
      return caches.match(event.request);
    })
  );
});
