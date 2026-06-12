// ─────────────────────────────────────────────────────────────
// Account alias resolution — maps how Malaysians *say* an account
// ("tng", "mbb", "现金", "public") to the user's actual account rows,
// so parsed transactions land in the right 户口 without manual fixing.
// ─────────────────────────────────────────────────────────────

export interface AccountLite {
  id: string
  name: string
  institution: string | null
  account_type: string
}

// Each group is a set of equivalent spellings. First entry is the canonical hint.
const ALIAS_GROUPS: string[][] = [
  ['touch n go', 'tng', 'tngo', 'touchngo', 'tng ewallet', 'touch and go', 'tngd', '一卡通'],
  ['grabpay', 'grab pay', 'grab wallet'],
  ['shopeepay', 'shopee pay', 'spay'],
  ['boost'],
  ['bigpay', 'big pay'],
  ['mae', 'mae wallet'],
  ['maybank', 'mbb', 'may bank', 'maybank2u', 'm2u', 'maybank islamic'],
  ['cimb', 'cimb bank', 'cimb islamic', 'cimb octo', 'octo'],
  ['public bank', 'pbb', 'pbe', 'public islamic', 'publicbank'],
  ['rhb', 'rhb bank', 'rhb islamic'],
  ['hong leong', 'hlb', 'hlbb', 'hong leong bank'],
  ['ambank', 'am bank', 'ambank islamic'],
  ['bank islam', 'bimb'],
  ['bsn', 'bank simpanan nasional'],
  ['affin', 'affin bank'],
  ['agrobank', 'agro bank'],
  ['alliance', 'alliance bank'],
  ['ocbc'],
  ['uob'],
  ['hsbc'],
  ['standard chartered', 'scb', 'stanchart'],
  ['cash', 'tunai', 'duit', '现金'],
  ['credit card', 'kad kredit', '信用卡'],
]

/** lowercase + strip everything except latin letters, digits and CJK */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '')
}

function accountHaystack(a: AccountLite): string {
  return norm(`${a.name} ${a.institution ?? ''}`)
}

/**
 * Resolve a parsed/spoken account name against the user's real accounts.
 * Returns the matched account, or null when nothing matches confidently.
 */
export function resolveAccount(parsedName: string, accounts: AccountLite[]): AccountLite | null {
  if (!parsedName || accounts.length === 0) return null
  const p = norm(parsedName)
  if (p.length === 0) return null

  // 1. Exact (normalized) name match
  const exact = accounts.find(a => norm(a.name) === p)
  if (exact) return exact

  // 2. Alias-group match: parsed name hits a group → match accounts on any term in that group
  for (const group of ALIAS_GROUPS) {
    const groupNorm = group.map(norm)
    const parsedHitsGroup = groupNorm.some(g => p === g || (g.length >= 3 && (p.includes(g) || g.includes(p))))
    if (!parsedHitsGroup) continue
    const hit = accounts.find(a => {
      const hay = accountHaystack(a)
      return groupNorm.some(g => g.length >= 3 ? hay.includes(g) : hay === g)
    })
    if (hit) return hit
  }

  // 3. Loose substring match (≥3 chars either direction)
  if (p.length >= 3) {
    const loose = accounts.find(a => {
      const hay = accountHaystack(a)
      return hay.includes(p) || norm(a.name).length >= 3 && p.includes(norm(a.name))
    })
    if (loose) return loose
  }

  return null
}

/**
 * Convenience: returns the user's real account name when resolvable,
 * otherwise the original parsed name unchanged.
 */
export function resolveAccountName(parsedName: string, accounts: AccountLite[]): string {
  return resolveAccount(parsedName, accounts)?.name ?? parsedName
}
