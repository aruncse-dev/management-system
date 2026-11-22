/*
 * Service worker shared by the FinTracker, Vault and Staff PWAs.
 *
 * Source of truth: packages/shared/config/pwa/sw.js. Each app serves a copy at
 * public/sw.js (run `pnpm pwa:sync` after editing). Keep it small and boring:
 * a broken worker is far worse than none, because it keeps running after the
 * bug is fixed.
 *
 * Why it exists: a cold launch of the installed app re-downloaded every script
 * and waited on the network for the HTML with no upper bound, so a phone whose
 * radio was still waking sat on the splash screen. Now:
 *   - /_next/static/* (content-hashed, immutable) and icons: cache-first.
 *   - page navigations: network-first, but give up after NAV_TIMEOUT_MS and
 *     serve the last good copy of the page shell. Page HTML here is a static
 *     shell with no user data in it; data always comes from /api.
 *   - /api/*, auth and anything cross-origin: never touched, never cached.
 */
const VERSION = 'v2'
const STATIC_CACHE = `ft-static-${VERSION}`
const PAGE_CACHE = `ft-pages-${VERSION}`
const NAV_TIMEOUT_MS = 4000
const MAX_STATIC_ENTRIES = 250

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith('ft-') && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|svg|ico|webp|woff2?)$/i.test(url.pathname)
  )
}

async function trimCache(cache, max) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') {
    cache.put(request, res.clone()).then(() => trimCache(cache, MAX_STATIC_ENTRIES)).catch(() => {})
  }
  return res
}

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Offline</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;color:#0f172a">' +
      '<div><p style="font-weight:700;margin:0 0 8px">You&#39;re offline</p>' +
      '<p style="color:#64748b;margin:0 0 16px;font-size:14px">Check your connection and try again.</p>' +
      '<button onclick="location.reload()" style="padding:10px 18px;border-radius:10px;border:0;background:#1E5CC7;color:#fff;font-weight:600">Retry</button></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

async function networkFirstPage(event) {
  const request = event.request
  const cache = await caches.open(PAGE_CACHE)
  const key = new URL(request.url)
  key.search = ''

  const network = fetch(request).then(res => {
    // Only cache a real page. A redirect is the middleware sending a signed-out
    // user to `/`; caching it would replay that redirect later.
    if (res.ok && res.type === 'basic' && !res.redirected) {
      cache.put(key.href, res.clone()).catch(() => {})
    }
    return res
  })

  const timeout = new Promise(resolve => setTimeout(() => resolve(null), NAV_TIMEOUT_MS))
  try {
    const first = await Promise.race([network, timeout])
    if (first) return first
  } catch {
    /* network failed — fall back below */
  }

  const cached = (await cache.match(key.href)) || (await cache.match(new URL('/', key).href))
  if (cached) {
    // Let the slow request finish in the background so the next launch is fresh.
    event.waitUntil(network.catch(() => {}))
    return cached
  }
  // Nothing cached yet: keep waiting on the network rather than give up early.
  try {
    return await network
  } catch {
    return offlineResponse()
  }
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event))
    return
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})

// Tapping a reminder notification focuses an open window, or opens the app at
// the URL the notification carries.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          await w.focus()
          if ('navigate' in w) await w.navigate(target).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
