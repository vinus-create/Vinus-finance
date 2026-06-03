'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Malaysian states ──────────────────────────────────────────
const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya',
]

const TOTAL_STEPS = 4

interface StepInfo {
  emoji: string
  title: string
  subtitle: string
  features: string[]
}

const STEP_INFO: StepInfo[] = [
  {
    emoji: '👋',
    title: '认识你一下',
    subtitle: '基本个人资料',
    features: ['🔮 财运分析（生肖/星座）', '📊 年龄段收入对比', '💰 EPF退休规划推算'],
  },
  {
    emoji: '📍',
    title: '工作与收入',
    subtitle: '地区、职业和月收入',
    features: ['📊 槟城/马来西亚本地收入对比', '💼 职业相符度分析', '📈 财务健康评分'],
  },
  {
    emoji: '👨‍👩‍👧',
    title: '家庭状况',
    subtitle: '婚姻与子女',
    features: ['🏛️ PCB月扣税精确计算', '📋 LHDN税务减免优化', '💡 家庭财务规划建议'],
  },
  {
    emoji: '📱',
    title: '联系方式',
    subtitle: '方便接收提醒（选填）',
    features: ['🤖 Telegram 财务机器人', '📬 Telegram 消费提醒', '🔔 账单到期推送通知'],
  },
]

// ── Toggle button helper ──────────────────────────────────────
function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-border hover:bg-muted text-muted-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  // Step 1
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null)

  // Step 2
  const [state, setState] = useState('')
  const [occupation, setOccupation] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')

  // Step 3
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married' | 'divorced' | 'widowed' | null>(null)
  const [childrenCount, setChildrenCount] = useState(0)

  // Step 4
  const [phone, setPhone] = useState('')
  const [telegramId, setTelegramId] = useState('')

  async function saveAndFinish(skipAll = false) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Build update object — only include fields that have values
      // (avoids failing if new DB columns haven't been added yet)
      const updates: Record<string, unknown> = {
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      }
      if (fullName.trim())      updates.full_name      = fullName.trim()
      if (dob)                  updates.date_of_birth  = dob
      if (gender)               updates.gender         = gender
      if (state)                updates.state          = state
      if (occupation.trim())    updates.occupation     = occupation.trim()
      if (monthlyIncome)        updates.monthly_income = parseFloat(monthlyIncome)
      if (maritalStatus)        updates.marital_status = maritalStatus
      if (childrenCount > 0)    updates.children_count = childrenCount
      if (phone.trim())         updates.phone_number   = phone.trim()
      if (telegramId.trim())    updates.telegram_id    = parseInt(telegramId) || null

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

      if (error) {
        // New columns may not exist yet — fall back to only setting onboarding_done
        await supabase.from('profiles')
          .update({ onboarding_done: true, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      }

      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  function nextStep() {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else saveAndFinish()
  }

  const info = STEP_INFO[step - 1]!
  const pct = Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i + 1 < step ? 'w-6 bg-emerald-500' :
                  i + 1 === step ? 'w-8 bg-emerald-500' :
                  'w-2 bg-muted'
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{step} / {TOTAL_STEPS}</span>
        </div>

        {/* Step header */}
        <div className="mb-8">
          <div className="text-5xl mb-3">{info.emoji}</div>
          <h1 className="text-2xl font-bold">{info.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{info.subtitle}</p>

          {/* Feature unlock hint */}
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">填写后解锁</p>
            {info.features.map(f => (
              <p key={f} className="text-xs text-emerald-700 dark:text-emerald-400">{f}</p>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 space-y-5">

          {step === 1 && (
            <>
              <div>
                <p className="text-sm font-medium mb-1.5">姓名 <span className="text-red-400">*</span></p>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="你的名字"
                  className="h-12 text-base"
                  autoFocus
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">出生日期</p>
                <Input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground mt-1">用于财运分析、年龄段对比、EPF退休规划</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">性别</p>
                <ToggleGroup
                  options={[
                    { value: 'male', label: '👨 男' },
                    { value: 'female', label: '👩 女' },
                    { value: 'other', label: '🙅 不透露' },
                  ]}
                  value={gender}
                  onChange={setGender}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-sm font-medium mb-1.5">所在州属</p>
                <div className="flex flex-wrap gap-2">
                  {MY_STATES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setState(s)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors',
                        state === s
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">职业 / 行业</p>
                <Input
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  placeholder="例：IT工程师、销售经理、自雇"
                  className="h-12 text-base"
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">月收入（税前，RM）</p>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={monthlyIncome}
                  onChange={e => setMonthlyIncome(e.target.value)}
                  placeholder="例：5000"
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground mt-1">仅用于 AI 财务评估，数据储存在您的账号中</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">婚姻状态</p>
                <ToggleGroup
                  options={[
                    { value: 'single',   label: '💙 单身' },
                    { value: 'married',  label: '💍 已婚' },
                    { value: 'divorced', label: '📄 离婚' },
                    { value: 'widowed',  label: '🕊️ 丧偶' },
                  ]}
                  value={maritalStatus}
                  onChange={setMaritalStatus}
                />
                <p className="text-xs text-muted-foreground mt-2">影响 PCB 月扣税计算（已婚多 RM4,000 配偶减免）</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">子女人数</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setChildrenCount(c => Math.max(0, c - 1))}
                    className="w-10 h-10 rounded-full border border-border hover:bg-muted text-xl font-bold flex items-center justify-center"
                  >−</button>
                  <span className="text-2xl font-bold w-8 text-center">{childrenCount}</span>
                  <button
                    type="button"
                    onClick={() => setChildrenCount(c => Math.min(10, c + 1))}
                    className="w-10 h-10 rounded-full border border-border hover:bg-muted text-xl font-bold flex items-center justify-center"
                  >+</button>
                  <span className="text-sm text-muted-foreground">人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">影响税务减免（每位子女 RM2,000 ~ RM8,000）</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <p className="text-sm font-medium mb-1.5">手机号码（含国码，不含 +）</p>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="例：60123456789"
                  inputMode="tel"
                  className="h-12 text-base font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">用于账单到期推送通知</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-medium">Telegram ID</p>
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">推荐</span>
                </div>
                <Input
                  value={telegramId}
                  onChange={e => setTelegramId(e.target.value)}
                  placeholder="例：123456789"
                  inputMode="numeric"
                  className="h-12 text-base font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  发送 /start 给 <strong>@VinusFinance_Bot</strong> 获取你的 Telegram ID
                </p>
              </div>

              {/* Final skip warning */}
              {showSkipWarning && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 space-y-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">⚠️ 跳过后部分功能受限</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    没有个人信息，以下功能将无法使用：财运分析、个人财务评估、PCB精确计算、Telegram通知。
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    你可以随时在 <strong>设置 → 个人资料</strong> 补填信息。
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-8 space-y-3">
          <Button
            onClick={nextStep}
            disabled={saving || (step === 1 && !fullName.trim())}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold"
          >
            {saving ? '保存中...' : step === TOTAL_STEPS ? '🎉 完成设置' : '下一步 →'}
          </Button>

          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回上一步
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (step === TOTAL_STEPS) {
                if (!showSkipWarning) { setShowSkipWarning(true); return }
                saveAndFinish(true)
              } else {
                setStep(s => s + 1)
              }
            }}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === TOTAL_STEPS
              ? showSkipWarning ? '我了解，跳过并进入 App →' : '跳过此步骤'
              : '跳过此步骤 →'
            }
          </button>
        </div>

        {/* Global skip (step 1 only) */}
        {step === 1 && (
          <button
            type="button"
            onClick={() => saveAndFinish(true)}
            className="mt-2 w-full py-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            跳过全部，直接进入 App（部分功能无法使用）
          </button>
        )}
      </div>
    </div>
  )
}
