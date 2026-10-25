/**
 * Open a web link in the device's real browser.
 *
 * The apps are installed as standalone PWAs, and from there `target="_blank"`
 * / `window.open` land in the OS's in-app viewer (a Safari sheet on iOS, a
 * Custom Tab on Android) rather than the browser. So in standalone mode the
 * link is handed off explicitly:
 *
 *   iOS      x-safari-https://…   opens the Safari app
 *   Android  intent://…           opens the default handler (browser, or the
 *                                 matching app, e.g. Drive for a Drive link)
 *
 * If the hand-off doesn't take the app to the background shortly after
 * (an older iOS without the scheme, a blocked intent), it falls back to a
 * normal new tab so the tap is never silently lost. Outside standalone mode —
 * a regular browser tab, desktop — it is just a new tab, as before.
 *
 * Only http(s) links are rerouted; tel:, mailto:, app schemes go straight through.
 */

/** How long a successful hand-off has to background the page before we fall back. */
const HANDOFF_TIMEOUT_MS = 1200

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function platform(): 'ios' | 'android' | 'other' {
  const ua = window.navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac; touch support tells them apart.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)) return 'ios'
  return 'other'
}

function newTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function handOff(target: string, fallbackUrl: string) {
  let left = false
  const onHide = () => {
    if (document.visibilityState === 'hidden') left = true
  }
  document.addEventListener('visibilitychange', onHide)
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    if (!left && document.visibilityState === 'visible') newTab(fallbackUrl)
  }, HANDOFF_TIMEOUT_MS)
  window.location.href = target
}

export function openExternal(rawUrl: string | null | undefined): void {
  const url = String(rawUrl ?? '').trim()
  if (!url || typeof window === 'undefined') return

  let parsed: URL
  try {
    parsed = new URL(url, window.location.href)
  } catch {
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    window.location.href = url
    return
  }

  const href = parsed.href
  if (!isStandalone()) {
    newTab(href)
    return
  }

  const os = platform()
  if (os === 'ios') {
    handOff(`x-safari-${href}`, href)
  } else if (os === 'android') {
    const scheme = parsed.protocol.replace(':', '')
    const rest = href.slice(parsed.protocol.length + 2) // drop "https://"
    handOff(
      `intent://${rest}#Intent;scheme=${scheme};action=android.intent.action.VIEW;` +
        `S.browser_fallback_url=${encodeURIComponent(href)};end`,
      href,
    )
  } else {
    newTab(href)
  }
}

/**
 * onClick for an `<a href target="_blank">`: keeps the real href (long-press,
 * copy link, middle-click still work) but routes a plain tap through `openExternal`.
 */
export function externalLinkClick(e: {
  preventDefault: () => void
  stopPropagation: () => void
  currentTarget: { href: string }
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  button?: number
}): void {
  e.stopPropagation()
  // Modified or non-primary clicks keep the browser's own behaviour.
  if (e.metaKey || e.ctrlKey || e.shiftKey || (e.button !== undefined && e.button !== 0)) return
  e.preventDefault()
  openExternal(e.currentTarget.href)
}
