'use client'

import { useEffect } from 'react'
import { useFab } from '@/lib/contexts/FabContext'

/**
 * Register a FAB (center + button) action for the current page.
 * Automatically cleared when the component unmounts.
 */
export function useFabAction(action: () => void) {
  const { setFabAction } = useFab()

  useEffect(() => {
    setFabAction(action)
    return () => setFabAction(null)
  // action identity changes on every render — use a ref-stable pattern via the setter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setFabAction])
}
