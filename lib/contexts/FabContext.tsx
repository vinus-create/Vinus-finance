'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type FabAction = (() => void) | null

interface FabContextValue {
  fabAction: FabAction
  setFabAction: (action: FabAction) => void
}

const FabContext = createContext<FabContextValue>({
  fabAction: null,
  setFabAction: () => {},
})

export function FabProvider({ children }: { children: React.ReactNode }) {
  const [fabAction, setFabActionState] = useState<FabAction>(null)

  // Wrap in arrow fn so React doesn't treat the passed fn as an updater
  const setFabAction = useCallback((action: FabAction) => {
    setFabActionState(() => action)
  }, [])

  return (
    <FabContext.Provider value={{ fabAction, setFabAction }}>
      {children}
    </FabContext.Provider>
  )
}

export function useFab() {
  return useContext(FabContext)
}
