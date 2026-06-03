'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────

interface WidgetSettings {
  fixed_expenses: boolean
  budget: boolean
  projection: boolean
  reminders: boolean
  ai_tip: boolean
}

interface WidgetData {
  totalBills: number
  totalLoans: number
  totalBudget: number
  budgetSpent: number
  reminders: Array<{ id: string; title: string; amount: number | null; due_date: string }>
  userId: string
}

const DEFAULT_SETTINGS: WidgetSettings = {
  fixed_expenses: true,
  budget: true,
  projection: true,
  reminders: true,
  ai_tip: true,
}

const WIDGET_LABELS: Record<keyof WidgetSettings, string> = {
  fixed_expenses: '🧾 每月固定总支出',
  budget: '📊 月度预算',
  projection: '📈 总预计支出',
  reminders: '🔔 即将到期提醒',
  ai_tip: '🤖 AI 理财建议',
}

// ─── Main Component ───────────────────────────────────────────

export default function DashboardWidgets({ data }: { data: WidgetData }) {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
  const [customizing, setCustomizing] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard_widgets')
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
    } catch { /* ignore */ }
  }, [])

  function toggle(key: keyof WidgetSettings) {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('dashboard_widgets', JSON.stringify(next))
      return next
    })
  }

  const { totalBills, totalLoans, totalBudget, budgetSpent, reminders, userId } = data
  const totalFixed = totalBills + totalLoans
  const projMin = totalFixed
  const projMax = totalFixed + totalBudget

  return (
    <div className="px-4 space-y-3 mt-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">财务概览</h2>
        <button
          onClick={() => setCustomizing(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted transition-colors"
        >
          ⚙️ {customizing ? '完成' : '自定义'}
        </button>
      </div>

      {/* Customize toggles */}
      {customizing && (
        <div className="p-3 rounded-2xl border border-border bg-card space-y-2">
          {(Object.keys(DEFAULT_SETTINGS) as (keyof WidgetSettings)[]).map(key => (
            <label key={key} className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-sm">{WIDGET_LABELS[key]}</span>
              <button
                onClick={() => toggle(key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${settings[key] ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          ))}
        </div>
      )}

      {/* Widget 1: Fixed Expenses */}
      {settings.fixed_expenses && (
        <Link href="/bills" className="block p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🧾 每月固定支出</p>
            <span className="text-xs text-muted-foreground">→</span>
          </div>
          <p className="text-2xl font-bold text-red-500">RM {totalFixed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>账单 RM {totalBills.toFixed(2)}</span>
            <span>月供 RM {totalLoans.toFixed(2)}</span>
          </div>
        </Link>
      )}

      {/* Widget 2: Monthly Budget */}
      {settings.budget && totalBudget > 0 && (
        <Link href="/budgets" className="block p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📊 月度预算</p>
            <span className="text-xs text-muted-foreground">→</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-bold">RM {budgetSpent.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">已用 / 预算 RM {totalBudget.toFixed(2)}</p>
            </div>
            <p className={`text-sm font-semibold ${budgetSpent > totalBudget ? 'text-red-500' : 'text-emerald-600'}`}>
              {budgetSpent > totalBudget
                ? `超支 RM ${(budgetSpent - totalBudget).toFixed(2)}`
                : `剩余 RM ${(totalBudget - budgetSpent).toFixed(2)}`}
            </p>
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetSpent > totalBudget ? 'bg-red-500' : budgetSpent / totalBudget > 0.8 ? 'bg-orange-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((budgetSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        </Link>
      )}

      {/* Widget 3: Projection */}
      {settings.projection && (totalFixed > 0 || totalBudget > 0) && (
        <div className="p-4 rounded-2xl bg-card border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📈 本月总预计支出</p>
          <p className="text-xl font-bold">
            RM {projMin.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            {totalBudget > 0 && (
              <span className="text-muted-foreground font-normal text-base">
                {' '}～ RM {projMax.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
            )}
          </p>
          <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="bg-muted px-2 py-0.5 rounded-full">固定 RM {totalFixed.toFixed(0)}</span>
            {totalBudget > 0 && <span className="bg-muted px-2 py-0.5 rounded-full">+ 预算 RM {totalBudget.toFixed(0)}</span>}
          </div>
        </div>
      )}

      {/* Widget 4: Upcoming Reminders */}
      {settings.reminders && reminders.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🔔 即将到期（7天内）</p>
            <Link href="/reminders" className="text-xs text-emerald-600">全部 →</Link>
          </div>
          <div className="space-y-2">
            {reminders.slice(0, 3).map(r => {
              const daysLeft = Math.ceil((new Date(r.due_date).getTime() - Date.now()) / 86400000)
              return (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${daysLeft <= 1 ? 'bg-red-500' : daysLeft <= 3 ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <span className="text-sm truncate max-w-[160px]">{r.title}</span>
                  </div>
                  <div className="text-right shrink-0">
                    {r.amount && <span className="text-xs font-medium">RM {Number(r.amount).toFixed(2)}</span>}
                    <span className={`text-[10px] ml-2 ${daysLeft <= 1 ? 'text-red-500' : daysLeft <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {daysLeft === 0 ? '今天' : daysLeft === 1 ? '明天' : `${daysLeft}天后`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Widget 5: AI Daily Tip */}
      {settings.ai_tip && <AiTipWidget userId={userId} />}
    </div>
  )
}

// ─── AI Tip Widget (client fetch) ────────────────────────────

function AiTipWidget({ userId }: { userId: string }) {
  const [tip, setTip] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check cache first (1 hour)
    const cacheKey = `ai_tip_${userId}_${new Date().toISOString().slice(0, 13)}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setTip(cached); setLoading(false); return }

    fetch(`/api/ai/daily-tip?user_id=${userId}`)
      .then(r => r.json())
      .then(({ tip }) => {
        if (tip) {
          sessionStorage.setItem(cacheKey, tip)
          setTip(tip)
        }
      })
      .catch(() => setTip(null))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">🤖 AI 今日理财建议</p>
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">生成中...</span>
        </div>
      ) : tip ? (
        <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">{tip}</p>
      ) : (
        <p className="text-xs text-muted-foreground">今日建议暂不可用</p>
      )}
    </div>
  )
}
