'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { EXPENSE_CATEGORIES } from '@/lib/constants/categories'
import { getCategoryLabel } from '@/lib/utils/category-i18n'
import { useCustomCategories } from '@/lib/hooks/useCustomCategories'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { useBatchEdit } from '@/lib/contexts/BatchEditContext'

export default function BatchEditToolbar({ hasTxns }: { hasTxns: boolean }) {
  const { active, selected, toggleActive } = useBatchEdit()
  const { lang } = useLang()
  const router = useRouter()
  const customCats = useCustomCategories('expense')
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const count = selected.size

  const options = [
    ...EXPENSE_CATEGORIES.map(c => ({ value: c.value as string, icon: c.icon, label: getCategoryLabel(c.value, 'expense', lang) })),
    ...customCats.map(c => ({ value: c.slug, icon: c.icon, label: c.label })),
  ]

  async function applyCategory(slug: string) {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Only expense rows carry an expense_category; income/transfer are skipped.
      const { data, error } = await supabase
        .from('transactions')
        .update({ expense_category: slug })
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .in('id', [...selected])
        .select('id')
      if (error) { toast.error('更新失败'); return }
      toast.success(`已更新 ${data?.length ?? 0} 笔为该分类`)
      setPicking(false)
      toggleActive()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!confirm(`确定删除选中的 ${count} 笔交易？余额会自动回冲，此操作不可撤销。`)) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .in('id', [...selected])
      if (error) { toast.error('删除失败'); return }
      toast.success(`已删除 ${count} 笔`)
      toggleActive()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!active) {
    if (!hasTxns) return null
    return (
      <div className="px-4 pt-1 pb-2 flex justify-end">
        <button
          onClick={toggleActive}
          className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/70 transition-colors"
        >
          ☑️ 批量编辑
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Bottom action bar (sits above the BottomNav) */}
      <div className="fixed left-0 right-0 bottom-16 z-40 px-4">
        <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl shadow-lg px-3 py-2.5 flex items-center gap-2">
          <span className="text-sm font-medium shrink-0">已选 {count}</span>
          <div className="flex-1" />
          <button
            disabled={busy || count === 0}
            onClick={() => setPicking(true)}
            className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
          >
            🏷️ 改分类
          </button>
          <button
            disabled={busy || count === 0}
            onClick={del}
            className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
          >
            🗑️ 删除
          </button>
          <button
            onClick={toggleActive}
            className="text-xs text-muted-foreground px-2 py-1.5"
          >
            取消
          </button>
        </div>
      </div>

      {/* Category picker sheet */}
      {picking && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setPicking(false)}>
          <div className="w-full bg-card rounded-t-2xl p-4 max-h-[70dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-3">把选中的支出改为…</p>
            <div className="grid grid-cols-4 gap-1.5">
              {options.map(opt => (
                <button
                  key={opt.value}
                  disabled={busy}
                  onClick={() => applyCategory(opt.value)}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="leading-tight text-center line-clamp-2">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
