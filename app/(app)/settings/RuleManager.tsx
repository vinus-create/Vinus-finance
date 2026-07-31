'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { EXPENSE_CATEGORIES } from '@/lib/constants/categories'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import { useCustomCategories } from '@/lib/hooks/useCustomCategories'
import { useLang } from '@/lib/i18n/LanguageProvider'

interface Rule { id: string; pattern: string; category: string; match_field: string }

const FIELD_LABEL: Record<string, string> = { any: '商家或描述', merchant: '商家', description: '描述' }

export default function RuleManager() {
  const { lang } = useLang()
  const customCats = useCustomCategories('expense')
  const [rules, setRules] = useState<Rule[]>([])
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState('shopee')
  const [field, setField] = useState('any')
  const [busy, setBusy] = useState(false)

  const options = [
    ...EXPENSE_CATEGORIES.map(c => ({ value: c.value as string, label: getCategoryLabel(c.value, 'expense', lang) })),
    ...customCats.map(c => ({ value: c.slug, label: c.label })),
  ]
  const labelOf = (slug: string) => options.find(o => o.value === slug)?.label ?? slug

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('category_rules')
      .select('id, pattern, category, match_field')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
    if (!error && data) setRules(data as Rule[])
  }, [])

  useEffect(() => { load() }, [load])

  async function add() {
    const p = pattern.trim()
    if (!p) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('category_rules')
        .insert({ user_id: user.id, pattern: p, category, match_field: field, priority: 0 })
      if (error) { toast.error('添加失败——请确认已在 Supabase 建表'); return }
      setPattern('')
      toast.success('规则已添加')
      load()
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('category_rules').delete().eq('user_id', user.id).eq('id', id)
    if (error) { toast.error('删除失败'); return }
    toast.success('已删除')
    load()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        导入账单时，若商家/描述包含某关键词，自动归为指定分类。例：<span className="font-mono">GWP00</span> → 网购。
      </p>

      {/* Existing rules */}
      {rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
              <span className="font-mono bg-background px-1.5 py-0.5 rounded">{r.pattern}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{labelOf(r.category)}</span>
              <span className="text-muted-foreground">（{FIELD_LABEL[r.match_field] ?? r.match_field}）</span>
              <button onClick={() => del(r.id)} className="ml-auto text-muted-foreground hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add rule */}
      <div className="space-y-2">
        <input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          placeholder="关键词，例如 GWP00"
          className="w-full h-9 text-sm px-3 rounded-lg border border-border bg-background"
        />
        <div className="flex gap-2">
          <select value={field} onChange={e => setField(e.target.value)}
            className="h-9 text-sm px-2 rounded-lg border border-border bg-background">
            <option value="any">商家或描述</option>
            <option value="merchant">仅商家</option>
            <option value="description">仅描述</option>
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="flex-1 h-9 text-sm px-2 rounded-lg border border-border bg-background">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={add} disabled={busy || !pattern.trim()}
            className="text-sm bg-emerald-500 text-white px-4 rounded-lg disabled:opacity-40">添加</button>
        </div>
      </div>
    </div>
  )
}
