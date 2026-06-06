'use client'

import { useEffect } from 'react'

/**
 * On iOS Safari/PWA, when the keyboard opens the layout viewport doesn't shrink.
 * This sets --keyboard-height CSS variable so elements can compensate.
 * Applied globally so every drawer/sheet benefits automatically.
 */
export default function IOSKeyboardFix() {
  useEffect(() => {
    const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport
    if (!vv) return

    const update = () => {
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--keyboard-height', `${kh}px`)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return null
}
