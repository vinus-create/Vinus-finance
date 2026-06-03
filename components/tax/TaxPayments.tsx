'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Payment {
  installment: number
  amount: number
  payment_date: string | null
}

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const CP500_MONTHS = [1, 3, 5, 7, 9, 11] // odd months (Jan, Mar, May, Jul, Sep, Nov)

interface Props {
  year: number
}

export default function TaxPayments({ year }: Props) {
  const [tab, setTab] = useState<'pcb' | 'cp500'>('pcb')
  const [pcb, setPcb] = useState<Payment[]>(
    Array.from({ length: 12 }, (_, i) => ({ installment: i + 1, amount: 0, payment_date: null }))
  )
  const [cp500, setCp500] = useState<Payment[]>(
    Array.from({ length: 6 }, (_, i) => ({ installment: i + 1, amount: 0, payment_date: null }))
  )
  const [saving, setSaving] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('tax_payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('assessment_year', year)
    if (!data) return

    const pcbData = data.filter(d => d.payment_type === 'pcb')
    const cp500Data = data.filter(d => d.payment_type === 'cp500')

    setPcb(prev => prev.map(p => {
      const found = pcbData.find(d => d.installment === p.installment)
      return found ? { installment: p.installment, amount: Number(found.amount), payment_date: found.payment_date } : p
    }))
    setCp500(prev => prev.map(p => {
      const found = cp500Data.find(d => d.installment === p.installment)
      return found ? { installment: p.installment, amount: Number(found.amount), payment_date: found.payment_date } : p
    }))
  }, [year])

  useEffect(() => { loadPayments() }, [loadPayments])

  async function savePayment(type: 'pcb' | 'cp500', installment: number, amount: number, date: string | null) {
    const key = `${type}-${installment}`
    setSaving(key)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')
      await supabase.from('tax_payments').upsert({
        user_id: user.id,
        assessment_year: year,
        payment_type: type,
        installment,
        amount,
        payment_date: date || null,
      }, { onConflict: 'user_id,assessment_year,payment_type,installment' })
      toast.success('已保存')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(null)
    }
  }

  const totalPcb = pcb.reduce((s, p) => s + p.amount, 0)
  const totalCp500 = cp500.reduce((s, p) => s + p.amount, 0)
  const totalPaid = totalPcb + totalCp500

  return (
    <div className="space-y-4">
      {/* Total paid summary */}
      <div className="p-4 rounded-2xl bg-card border border-border grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">PCB 合计</p>
          <p className="font-bold text-sm text-blue-600">RM {totalPcb.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CP500 合计</p>
          <p className="font-bold text-sm text-purple-600">RM {totalCp500.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">已缴税款总计</p>
          <p className="font-bold text-sm text-emerald-600">RM {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden text-sm">
        <button
          onClick={() => setTab('pcb')}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === 'pcb' ? 'bg-blue-500 text-white' : 'hover:bg-muted'}`}
        >
          📋 PCB（每月扣税）
        </button>
        <button
          onClick={() => setTab('cp500')}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === 'cp500' ? 'bg-purple-500 text-white' : 'hover:bg-muted'}`}
        >
          📄 CP500（分期缴税）
        </button>
      </div>

      {/* PCB: 12 months */}
      {tab === 'pcb' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">PCB = Potongan Cukai Berjadual，每月薪资自动扣税。从工资单或 EA Form 填入各月份金额。</p>
          {pcb.map((p, i) => (
            <div key={p.installment} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <span className="text-sm font-medium w-16 shrink-0">{MONTHS[i]}</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={p.amount || ''}
                onChange={e => setPcb(prev => prev.map((x, xi) => xi === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                onBlur={() => savePayment('pcb', p.installment, p.amount, p.payment_date)}
                className="h-9 flex-1"
              />
              <span className={`text-xs w-12 text-right font-medium ${p.amount > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {saving === `pcb-${p.installment}` ? '...' : p.amount > 0 ? `RM ${p.amount.toFixed(0)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CP500: 6 installments */}
      {tab === 'cp500' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">CP500 = 分期预缴税款通知书，LHDN 每两个月发出一张。共 6 期，在奇数月缴付。</p>
          {cp500.map((p, i) => (
            <div key={p.installment} className="p-3 rounded-xl bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">第 {p.installment} 期 ({MONTHS[CP500_MONTHS[i]! - 1]})</span>
                {p.amount > 0 && <span className="text-xs font-semibold text-purple-600">RM {p.amount.toFixed(2)}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">金额 (RM)</p>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={p.amount || ''}
                    onChange={e => setCp500(prev => prev.map((x, xi) => xi === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                    onBlur={() => savePayment('cp500', p.installment, p.amount, p.payment_date)}
                    className="h-9"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">缴付日期</p>
                  <Input
                    type="date"
                    value={p.payment_date ?? ''}
                    onChange={e => setCp500(prev => prev.map((x, xi) => xi === i ? { ...x, payment_date: e.target.value || null } : x))}
                    onBlur={() => savePayment('cp500', p.installment, p.amount, p.payment_date)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
