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
 *   - /_next/static/* (content-hashed, immutable): cache-first.
 *   - icons and other /public files (same name, new content): stale-while-revalidate.
 *   - page navigations: network-first, but give up after NAV_TIMEOUT_MS and
 *     serve the last good copy of THAT page (never another page's). Page HTML here is a static
 *     shell with no user data in it; data always comes from /api.
 *   - /api/*, auth and anything cross-origin: never touched, never cached.
 */
const VERSION = 'v4'
const STATIC_CACHE = `ft-static-${VERSION}`
const PAGE_CACHE = `ft-pages-${VERSION}`
const NAV_TIMEOUT_MS = 4000
const MAX_STATIC_ENTRIES = 250

/*
 * Launch log (read by /launch-log.html). A worker has no localStorage, so the
 * lines live in one JSON entry in their own cache. Steps and timings only:
 * page paths without query strings, never data. Writes are batched and every
 * failure is swallowed, so logging can never slow or break a request.
 */
const LOG_CACHE = 'ft-log'
const LOG_KEY = '/__ft-sw-log'
const LOG_MAX = 200
let logBuffer = []
let logTimer = null
function swLog(msg) {
  try {
    logBuffer.push([Date.now(), String(msg).slice(0, 240)])
    if (!logTimer) logTimer = setTimeout(flushLog, 250)
  } catch {
    /* ignore */
  }
}
async function flushLog() {
  logTimer = null
  const lines = logBuffer
  logBuffer = []
  try {
    const cache = await caches.open(LOG_CACHE)
    const hit = await cache.match(LOG_KEY)
    let all = []
    if (hit) all = await hit.json().catch(() => [])
    if (!Array.isArray(all)) all = []
    all = all.concat(lines).slice(-LOG_MAX)
    await cache.put(LOG_KEY, new Response(JSON.stringify(all), { headers: { 'Content-Type': 'application/json' } }))
  } catch {
    /* ignore */
  }
}

// Runs each time the browser starts this worker (a cold launch starts it fresh).
swLog(`worker started (${VERSION})`)

self.addEventListener('install', () => {
  swLog('new worker installed')
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      swLog('new worker activated')
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, LOG_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith('ft-') && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

/** Build output: the file name changes whenever the content does, so a cached copy is never stale. */
function isHashedAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

/**
 * Files from /public (app icons, favicons, images) keep the same name when
 * their content changes. Serving them cache-first kept a recoloured icon blue
 * forever on any phone that had cached the old one, so they are
 * stale-while-revalidate: shown from cache at once, refreshed in the
 * background, and the new version is used from the next load.
 */
function isPublicAsset(url) {
  return /\.(?:png|svg|ico|webp|jpg|jpeg|woff2?)$/i.test(url.pathname)
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

async function staleWhileRevalidate(event) {
  const request = event.request
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then(res => {
      if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {})
      return res
    })
  if (hit) {
    event.waitUntil(refresh.catch(() => {}))
    return hit
  }
  return refresh
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
  const t0 = Date.now()
  const cache = await caches.open(PAGE_CACHE)
  const key = new URL(request.url)
  key.search = ''
  swLog(`page requested ${key.pathname} (saved pages opened in ${Date.now() - t0}ms)`)

  const network = fetch(request).then(res => {
    swLog(`page ${key.pathname}: network answered ${res.status} in ${Date.now() - t0}ms${res.redirected ? ' (redirected)' : ''}`)
    // Only cache a real page. A redirect is the middleware sending a signed-out
    // user to `/`; caching it would replay that redirect later.
    if (res.ok && res.type === 'basic' && !res.redirected) {
      cache.put(key.href, res.clone()).catch(() => {})
    }
    return res
  })
  network.catch(e => swLog(`page ${key.pathname}: network failed after ${Date.now() - t0}ms: ${(e && e.message) || e}`))

  const timeout = new Promise(resolve => setTimeout(() => resolve(null), NAV_TIMEOUT_MS))
  try {
    const first = await Promise.race([network, timeout])
    if (first) return first
  } catch {
    /* network failed — fall back below */
  }

  // Only this exact page's last copy. Serving `/` for a page never cached here
  // would load the wrong screen under the requested URL.
  const cached = await cache.match(key.href)
  swLog(`page ${key.pathname}: no usable answer after ${Date.now() - t0}ms, ${cached ? 'showing the saved copy' : 'no saved copy, still waiting for the network'}`)
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
  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (isPublicAsset(url)) {
    event.respondWith(staleWhileRevalidate(event))
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
