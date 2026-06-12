'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { calcEpfSocso } from '@/lib/utils/epf-socso'
import { calcPcb } from '@/lib/utils/pcb'
import type { Account } from '@/lib/types/app.types'
import { cn } from '@/lib/utils'

// ── Toggle helper ─────────────────────────────────────────────
function Toggle({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-muted-foreground/30'} ${disabled ? 'opacity-40' : ''}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function PayslipPage() {
  const router = useRouter()
  const [grossSalary, setGrossSalary] = useState('')
  const [isMarried, setIsMarried] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [employer, setEmployer] = useState('')

  // Toggles
  const [recSalary, setRecSalary] = useState(true)
  const [recEpf, setRecEpf] = useState(true)
  const [recSocso, setRecSocso] = useState(true)
  const [recEis, setRecEis] = useState(true)
  const [recPcb, setRecPcb] = useState(false)
  const [addToKwsp, setAddToKwsp] = useState(true)

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Load accounts
      const { data: accts } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at')
      if (accts?.length) {
        setAccounts(accts as Account[])
        setAccountName(accts[0]!.name)
      }
      // Load profile for marital status
      const { data: profile } = await supabase.from('profiles').select('marital_status').eq('id', user.id).single()
      if ((profile as { marital_status?: string | null })?.marital_status === 'married') setIsMarried(true)
    }
    load()
  }, [])

  const gross = parseFloat(grossSalary) || 0
  const epf = calcEpfSocso(gross)
  const pcb = calcPcb(gross, isMarried)
  const netTakehome = gross - epf.epfEmployee - epf.socsoEmployee - epf.eisEmployee - pcb.monthlyPcb

  async function handleRecord() {
    if (!gross || gross <= 0) { setError('请输入月薪金额'); return }
    if (!accountName) { setError('请选择户口'); return }
    setSaving(true); setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('请重新登录')

      const desc = employer.trim() || '月薪'

      // 1. Record salary income
      if (recSalary) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'income', amount: gross,
          currency: 'MYR', income_category: 'salary',
          merchant_name: desc, description: `月薪 - ${desc}`,
          account_name: accountName, transaction_date: txDate,
          ledger: 'personal', is_tax_deductible: false,
        })
        // Balance handled by DB trigger trg_update_account_balance
      }

      // 2. EPF deduction
      if (recEpf) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: epf.epfEmployee,
          currency: 'MYR', expense_category: 'epf_kwsp',
          merchant_name: 'KWSP/EPF', description: `EPF 雇员 11% - ${desc}`,
          account_name: accountName, transaction_date: txDate,
          ledger: 'personal', is_tax_deductible: false,
        })
      }

      // 3. Add EPF to KWSP-EPF holding
      if (addToKwsp) {
        const { data: existing } = await supabase.from('stock_holdings').select('id, shares').eq('user_id', user.id).eq('ticker', 'KWSP-EPF').maybeSingle()
        if (existing) {
          await supabase.from('stock_holdings').update({ shares: existing.shares + epf.epfEmployee, updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('stock_holdings').insert({
            user_id: user.id, ticker: 'KWSP-EPF',
            company_name: 'Kumpulan Wang Simpanan Pekerja (EPF)',
            asset_type: 'mutual_fund', shares: epf.epfEmployee,
            avg_cost_price: 1.00, currency: 'MYR',
            notes: 'Auto-tracked EPF contributions', is_active: true,
          })
        }
      }

      // 4. SOCSO
      if (recSocso) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: epf.socsoEmployee,
          currency: 'MYR', expense_category: 'socso_perkeso',
          merchant_name: 'PERKESO/SOCSO', description: `SOCSO 0.5% - ${desc}`,
          account_name: accountName, transaction_date: txDate,
          ledger: 'personal', is_tax_deductible: false,
        })
      }

      // 5. EIS
      if (recEis) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: epf.eisEmployee,
          currency: 'MYR', expense_category: 'socso_perkeso',
          merchant_name: 'EIS/PERKESO', description: `EIS 0.2% - ${desc}`,
          account_name: accountName, transaction_date: txDate,
          ledger: 'personal', is_tax_deductible: false,
        })
      }

      // 6. PCB
      if (recPcb && pcb.monthlyPcb > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: pcb.monthlyPcb,
          currency: 'MYR', expense_category: 'income_tax',
          merchant_name: 'LHDN/PCB', description: `PCB 月扣税 - ${desc}`,
          account_name: accountName, transaction_date: txDate,
          ledger: 'personal', is_tax_deductible: false,
        })
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div>
        <PageHeader title="月薪管理" showBack />
        <div className="px-4 py-16 text-center space-y-4">
          <p className="text-6xl">🎉</p>
          <p className="text-xl font-bold">工资记录完成！</p>
          <p className="text-sm text-muted-foreground">所有选定的收支已成功写入账本</p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Button variant="outline" onClick={() => { setSuccess(false); setGrossSalary('') }}>再记一次</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => router.push('/dashboard')}>回到主页</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="月薪管理" showBack />
      <div className="px-4 mt-4 pb-24 space-y-4">

        {/* ── Inputs ── */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">薪资信息</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">月薪（税前，RM） *</p>
              <Input type="number" min="0" step="100" value={grossSalary}
                onChange={e => setGrossSalary(e.target.value)} placeholder="例：5000" className="h-11 text-base" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">日期</p>
              <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className="h-11" />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">雇主名称（可选）</p>
            <Input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="例：Vinus Tech Sdn Bhd" className="h-11" />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">婚姻状态（影响 PCB 计算）</p>
            <div className="flex gap-2">
              {([{ v: false, label: '💙 单身' }, { v: true, label: '💍 已婚' }] as { v: boolean; label: string }[]).map(opt => (
                <button key={String(opt.v)} onClick={() => setIsMarried(opt.v)}
                  className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                    isMarried === opt.v ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-muted text-muted-foreground')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">入账户口</p>
            <div className="flex flex-wrap gap-2">
              {accounts.map(a => (
                <button key={a.id} onClick={() => setAccountName(a.name)}
                  className={cn('px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors',
                    accountName === a.name ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:bg-muted text-muted-foreground')}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Breakdown (only when salary entered) ── */}
        {gross > 0 && (
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏦 薪资明细</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {/* Left column */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">月薪（税前）</span>
                  <span className="font-medium">RM {epf.grossWage.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EPF 雇员 (11%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.epfEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SOCSO (0.5%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.socsoEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EIS (0.2%)</span>
                  <span className="font-medium text-blue-600">−RM {epf.eisEmployee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PCB 月扣税</span>
                  <span className="font-medium text-orange-500">
                    {pcb.monthlyPcb > 0 ? `−RM ${pcb.monthlyPcb.toFixed(2)}` : 'RM 0'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1.5 mt-1">
                  <span className="font-semibold">到手工资</span>
                  <span className="font-bold text-emerald-600">RM {netTakehome.toFixed(2)}</span>
                </div>
              </div>
              {/* Right column */}
              <div className="space-y-1.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>雇主 EPF (13%)</span>
                  <span>+RM {epf.epfEmployer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>EPF 合计</span>
                  <span>RM {(epf.epfEmployee + epf.epfEmployer).toFixed(2)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                  <p className="font-medium">PCB 估算依据</p>
                  <div className="flex justify-between"><span>年收入</span><span>RM {pcb.annualGross.toLocaleString('en-MY')}</span></div>
                  <div className="flex justify-between"><span>应税收入</span><span>RM {pcb.chargeableIncome.toLocaleString('en-MY')}</span></div>
                  <div className="flex justify-between font-medium text-orange-500"><span>年税额</span><span>RM {pcb.annualTax.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            {/* ── Record toggles ── */}
            <div className="space-y-2 border-t border-blue-200 pt-3">
              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">选择要记录的项目</p>
              {[
                { label: '💰 记录工资收入', sub: `+RM ${gross.toFixed(2)} → ${accountName || '户口'}`, active: recSalary, toggle: () => setRecSalary(v => !v) },
                { label: '📈 EPF 记入投资组合', sub: `RM ${epf.epfEmployee.toFixed(2)} → KWSP-EPF 持仓`, active: addToKwsp, toggle: () => setAddToKwsp(v => !v) },
                { label: '🏦 EPF 记为支出', sub: `−RM ${epf.epfEmployee.toFixed(2)} 从 ${accountName || '户口'}`, active: recEpf, toggle: () => setRecEpf(v => !v) },
                { label: '🛡️ SOCSO 记为支出', sub: `−RM ${epf.socsoEmployee.toFixed(2)}`, active: recSocso, toggle: () => setRecSocso(v => !v) },
                { label: '📋 EIS 记为支出', sub: `−RM ${epf.eisEmployee.toFixed(2)}`, active: recEis, toggle: () => setRecEis(v => !v) },
                { label: '🏛️ PCB 月扣税记为支出', sub: pcb.monthlyPcb > 0 ? `−RM ${pcb.monthlyPcb.toFixed(2)}` : '月薪未达扣税门槛', active: recPcb, toggle: () => setRecPcb(v => !v), disabled: pcb.monthlyPcb === 0 },
              ].map(item => (
                <label key={item.label} className={`flex items-center justify-between cursor-pointer ${item.disabled ? 'opacity-40' : ''}`}>
                  <div>
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                  </div>
                  <Toggle active={item.active} onClick={item.toggle} disabled={item.disabled} />
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <Button
          onClick={handleRecord}
          disabled={saving || gross <= 0}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
        >
          {saving ? '⏳ 记录中...' : '💾 一键记录本月工资'}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground">
          记录后将在「交易记录」和「投资」中看到对应条目
        </p>
      </div>
    </div>
  )
}
