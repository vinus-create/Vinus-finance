'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface BatchEditState {
  active: boolean
  selected: Set<string>
  toggleActive: () => void
  toggle: (id: string) => void
  clear: () => void
}

// Default = inactive. TransactionRows rendered outside a provider (e.g. account
// detail page) read this and behave normally — no checkbox, tap opens editor.
const noop = () => {}
const BatchEditContext = createContext<BatchEditState>({
  active: false,
  selected: new Set(),
  toggleActive: noop,
  toggle: noop,
  clear: noop,
})

export function useBatchEdit() {
  return useContext(BatchEditContext)
}

export function BatchEditProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleActive = useCallback(() => {
    setActive(a => !a)
    setSelected(new Set()) // leaving/entering batch mode clears the selection
  }, [])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  return (
    <BatchEditContext.Provider value={{ active, selected, toggleActive, toggle, clear }}>
      {children}
    </BatchEditContext.Provider>
  )
}
