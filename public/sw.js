// Lets the installed app open with no signal. Recipes are bundled into the
// JavaScript at build time and the kitchen lives in localStorage, so caching
// the shell and its assets is all it takes for the whole app to work offline.
//
// Vite content-hashes every asset, so those are cached forever. The HTML shell
// is fetched fresh when online - that is how a new recipe arrives - and served
// from cache when not. Bumping CACHE evicts the previous version on activate.
const CACHE = 'cookable-v1'

// Fonts are the only cross-origin assets; cache them so the app keeps its
// typography offline instead of falling back to system fonts.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

/**
 * Only ever store a real page from this origin. Otherwise a login redirect
 * (deployment protection on a preview URL) or an error page gets cached as the
 * app shell, and keeps being served offline long after the cause is gone.
 */
function isStorableShell(res) {
  return res.ok && !res.redirected && res.type === 'basic'
}

/** Opaque font responses have ok === false but are still worth keeping. */
function isStorableAsset(res, sameOrigin) {
  if (sameOrigin) return res.ok && res.type === 'basic'
  return res.ok || res.type === 'opaque'
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // Tolerant: a failed precache must not block the new worker from taking
  // over, since every request path falls back to the network anyway.
  event.waitUntil(
    fetch('/')
      .then((res) => (isStorableShell(res) ? caches.open(CACHE).then((c) => c.put('/', res)) : undefined))
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return

  // One page app: every navigation is the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isStorableShell(res)) {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (isStorableAsset(res, sameOrigin)) {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
