// Malaysia calendar helpers. Never derive "today" from toISOString() or from
// getFullYear()/getMonth()/getDate() on the server: both are UTC there (Vercel),
// and toISOString() is UTC on the phone too — so between 00:00 and 07:59 MYT
// they yield YESTERDAY (and on the 1st, LAST MONTH). Malaysia has no DST, so
// plain day arithmetic on a fixed zone is safe.

export const MY_TZ = 'Asia/Kuala_Lumpur'

/** YYYY-MM-DD in Malaysia time, `offsetDays` from today (e.g. -1 = yesterday). */
export function todayMY(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: MY_TZ })
}

/** Current Malaysia calendar date as numbers (month is 1–12). */
export function nowMY(): { year: number; month: number; day: number } {
  const [year, month, day] = todayMY().split('-').map(Number)
  return { year, month, day }
}
