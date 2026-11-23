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
 *   - page navigations: the saved copy of THAT page (never another page's) is
 *     shown at once and refreshed from the network in the background, so a
 *     launch or refresh never waits on a slow server (launch logs showed page
 *     requests taking 1-15 s). A page with no saved copy yet goes to the
 *     network, falling back to an offline card. Page HTML here is a static
 *     shell with no user data in it; data always comes from /api. After a
 *     deploy the app's update check (PwaServiceWorker) drops these copies and
 *     reloads once, so a saved shell never outlives a release.
 *   - /api/*, auth and anything cross-origin: never touched, never cached.
 */
const VERSION = 'v4'
const STATIC_CACHE = `ft-static-${VERSION}`
const PAGE_CACHE = `ft-pages-${VERSION}`
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

self.addEventListener('install', event => {
  swLog('new worker installed')
  self.skipWaiting()
  // Page loads race the network against this worker (Static Routing API,
  // Chrome 123+): whichever answers first wins. A worker that is slow to
  // start, or whose saved-page lookup is stuck on the phone's storage, can no
  // longer hold a page on the splash screen; a slow network is still covered
  // by the saved copy. Browsers without it keep the plain fetch handler.
  if (typeof event.addRoutes === 'function') {
    event.waitUntil(
      event
        .addRoutes([{ condition: { requestMode: 'navigate' }, source: 'race-network-and-fetch-handler' }])
        .then(() => swLog('page loads race network and saved copy'))
        .catch(e => swLog(`page-load racing not available: ${(e && e.message) || e}`)),
    )
  }
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

/** Resolves to `fallback` if `p` has not settled within `ms` (storage can stall). */
function within(p, ms, fallback) {
  return Promise.race([p, new Promise(resolve => setTimeout(() => resolve(fallback), ms))])
}

async function savedFirstPage(event) {
  const request = event.request
  const t0 = Date.now()
  const cache = await within(caches.open(PAGE_CACHE), 1500, null)
  if (!cache) {
    swLog(`page ${new URL(request.url).pathname}: saved pages did not open in 1.5s, going to the network`)
    try {
      return await fetch(request)
    } catch {
      return offlineResponse()
    }
  }
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

  // Only this exact page's last copy. Serving `/` for a page never cached here
  // would load the wrong screen under the requested URL.
  const cached = await within(cache.match(key.href), 1500, undefined)
  if (cached) {
    swLog(`page ${key.pathname}: showing the saved copy at once, refreshing it in the background`)
    event.waitUntil(network.catch(() => {}))
    return cached
  }
  // Nothing saved yet (first visit of this page): wait for the network.
  swLog(`page ${key.pathname}: no saved copy yet, waiting for the network`)
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
    event.respondWith(savedFirstPage(event))
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
