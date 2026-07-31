'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useCustomCategories, invalidateCustomCategories } from '@/lib/hooks/useCustomCategories'

const ICONS = ['🏷️', '🍜', '🛒', '🚗', '🏠', '💊', '🎮', '✈️', '👕', '💰', '📦', '🐾', '🎁', '☕', '⚽', '📚', '💡', '🔧', '🎨', '🍺']

export default function CategoryManager() {
  const cats = useCustomCategories('expense')
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('🏷️')
  const [busy, setBusy] = useState(false)

  async function add() {
    const name = label.trim()
    if (!name) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const slug = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const { error } = await supabase.from('custom_categories')
        .insert({ user_id: user.id, slug, label: name, icon, kind: 'expense' })
      if (error) { toast.error('添加失败——请确认已在 Supabase 建表'); return }
      setLabel(''); setIcon('🏷️')
      invalidateCustomCategories()
      toast.success('已添加分类')
    } finally {
      setBusy(false)
    }
  }

  async function del(slug: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('custom_categories')
      .delete().eq('user_id', user.id).eq('slug', slug)
    if (error) { toast.error('删除失败'); return }
    invalidateCustomCategories()
    toast.success('已删除')
  }

  return (
    <div className="space-y-3">
      {/* Existing custom categories */}
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <span key={c.slug} className="inline-flex items-center gap-1 text-xs bg-muted px-2.5 py-1.5 rounded-full">
              <span>{c.icon}</span>
              <span>{c.label}</span>
              <button onClick={() => del(c.slug)} className="ml-0.5 text-muted-foreground hover:text-red-500">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Icon picker */}
      <div className="flex flex-wrap gap-1">
        {ICONS.map(e => (
          <button
            key={e}
            onClick={() => setIcon(e)}
            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
              icon === e ? 'bg-emerald-500' : 'bg-muted hover:bg-muted/70'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Add row */}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="新分类名称，例如「宠物」"
          className="flex-1 h-9 text-sm px-3 rounded-lg border border-border bg-background"
        />
        <button
          onClick={add}
          disabled={busy || !label.trim()}
          className="text-sm bg-emerald-500 text-white px-4 rounded-lg disabled:opacity-40"
        >
          {icon} 添加
        </button>
      </div>
    </div>
  )
}
