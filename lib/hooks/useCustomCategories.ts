'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CustomCategory {
  slug: string
  label: string
  icon: string
  kind: 'expense' | 'income'
}

// Module-level cache so a screen full of TransactionRows shares ONE fetch.
// invalidate() after a settings edit refreshes every mounted consumer.
let cache: CustomCategory[] | null = null
let inflight: Promise<CustomCategory[]> | null = null
const listeners = new Set<() => void>()

async function fetchAll(): Promise<CustomCategory[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('custom_categories')
      .select('slug, label, icon, kind')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) return [] // table not created yet → degrade to none
    return (data ?? []) as CustomCategory[]
  } catch {
    return []
  }
}

function load(force = false): Promise<CustomCategory[]> {
  if (cache && !force) return Promise.resolve(cache)
  if (!inflight) inflight = fetchAll().then(c => { cache = c; inflight = null; return c })
  return inflight
}

export function invalidateCustomCategories() {
  cache = null
  load(true).then(() => listeners.forEach(l => l()))
}

export function useCustomCategories(kind?: 'expense' | 'income'): CustomCategory[] {
  const [list, setList] = useState<CustomCategory[]>(cache ?? [])
  useEffect(() => {
    let mounted = true
    load().then(c => { if (mounted) setList(c) })
    const l = () => setList(cache ?? [])
    listeners.add(l)
    return () => { mounted = false; listeners.delete(l) }
  }, [])
  return kind ? list.filter(c => c.kind === kind) : list
}
