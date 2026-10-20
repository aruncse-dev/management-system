import { useEffect, useState } from 'react'

/**
 * How far the on-screen keyboard reaches up from the bottom of the layout
 * viewport, in px. 0 when no keyboard is open, or off mobile.
 *
 * `position: fixed; bottom: …` is measured from the layout viewport, which the
 * keyboard does not shrink on iOS Safari or (by default) Chrome on Android — so
 * a bottom-docked panel ends up behind the keyboard, and the browser scrolls
 * only far enough to bring the focused input into view. Anything below the
 * input stays hidden. Adding this to the panel's bottom offset keeps the whole
 * panel sitting on top of the keyboard instead.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!enabled || !vv) {
      setInset(0)
      return
    }
    const update = () => {
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return inset
}
