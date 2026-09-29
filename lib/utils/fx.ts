// Spot FX → MYR via the same Yahoo chart endpoint the stocks page uses.
// ponytail: per-instance in-memory cache (12h). Ceiling: each serverless
// instance fetches its own copy; move to an app_config row if Yahoo rate-limits.

const TTL_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { rate: number; at: number }>()

/** How many MYR one unit of `currency` is worth, or null if unavailable. */
export async function rateToMYR(currency: string): Promise<number | null> {
  const cur = currency.trim().toUpperCase()
  if (cur === 'MYR' || cur === 'RM') return 1
  if (!/^[A-Z]{3}$/.test(cur)) return null

  const hit = cache.get(cur)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rate

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${cur}MYR=X?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinusFinance/1.0)' }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (typeof rate !== 'number' || !(rate > 0)) return null
    cache.set(cur, { rate, at: Date.now() })
    return rate
  } catch {
    return null
  }
}
