import type { AccountType } from '@/lib/types/app.types'

// ─── Account type config ─────────────────────────────────────

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, { emoji: string; color: string }> = {
  bank:        { emoji: '🏦', color: '#3b82f6' },
  ewallet:     { emoji: '💳', color: '#10b981' },
  investment:  { emoji: '📈', color: '#8b5cf6' },
  cash:        { emoji: '💵', color: '#f59e0b' },
  credit_card: { emoji: '💳', color: '#ef4444' },
  other:       { emoji: '🏧', color: '#6b7280' },
}

// ─── Malaysian institution presets ───────────────────────────

export interface Institution {
  name: string
  type: AccountType
  emoji: string
}

export const MY_INSTITUTIONS: Institution[] = [
  // Banks
  { name: 'Maybank',       type: 'bank', emoji: '🟡' },
  { name: 'CIMB',          type: 'bank', emoji: '🔴' },
  { name: 'Public Bank',   type: 'bank', emoji: '🔵' },
  { name: 'RHB',           type: 'bank', emoji: '🟢' },
  { name: 'Hong Leong',    type: 'bank', emoji: '🔵' },
  { name: 'AmBank',        type: 'bank', emoji: '🟣' },
  { name: 'Bank Islam',    type: 'bank', emoji: '🟢' },
  { name: 'BSN',           type: 'bank', emoji: '🔵' },
  { name: 'Affin Bank',    type: 'bank', emoji: '🟠' },
  // E-Wallets
  { name: 'TNG eWallet',   type: 'ewallet', emoji: '💚' },
  { name: 'GrabPay',       type: 'ewallet', emoji: '🟢' },
  { name: 'ShopeePay',     type: 'ewallet', emoji: '🟠' },
  { name: 'Boost',         type: 'ewallet', emoji: '🔴' },
  { name: 'BigPay',        type: 'ewallet', emoji: '🔵' },
  { name: 'MAE',           type: 'ewallet', emoji: '🟡' },
  // Investment
  { name: 'ASNB',          type: 'investment', emoji: '📊' },
  { name: 'Moomoo',        type: 'investment', emoji: '🐄' },
  { name: 'Kenanga',       type: 'investment', emoji: '📈' },
  { name: 'Maybank Trade', type: 'investment', emoji: '📊' },
  { name: 'i-Invest',      type: 'investment', emoji: '💹' },
  { name: 'StashAway',     type: 'investment', emoji: '📈' },
]
