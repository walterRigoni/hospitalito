const CACHE = 'hospitalito-v315-shell';
const HOME = new URL('./', self.registration.scope).href;
const ASSETS = ['./manifest.webmanifest', './hospitalito-icon.svg'];
const appPages = new Set([new URL(HOME).pathname, new URL('./index.html', HOME).pathname, new URL('./Hospitalito_v315.html', HOME).pathname]);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([HOME, ...ASSETS].map(url => new Request(new URL(url, HOME), {cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^hospitalito-v\d+(?:-shell)?$/.test(key) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.has('_hc_update_probe')) return;
  const isPage = request.mode === 'navigate' && appPages.has(url.pathname);
  const isAsset = ASSETS.some(path => new URL(path, HOME).pathname === url.pathname);
  if (!isPage && !isAsset) return;
  event.respondWith((async () => {
    const key = isPage ? HOME : url.origin + url.pathname;
    const cache = await caches.open(CACHE);
    let response;
    try { response = await fetch(request, {cache:'no-store'}); }
    catch (error) { return await cache.match(key) || Response.error(); }
    if (response.ok && (!isPage || (response.headers.get('Content-Type') || '').includes('text/html'))) {
      const copy = response.clone();
      event.waitUntil(cache.put(key, copy).catch(() => {}));
    }
    return response;
  })());
});
