// Supabase (PostgREST) returns at most 1000 rows per request and does it
// silently — a query past that just yields a smaller, wrong total. Anything
// that can exceed 1000 rows must page through with a stable order.

const PAGE = 1000

/**
 * Fetch every row: `page(from, to)` must return the query with `.range(from, to)`
 * and a deterministic `.order(...)` applied.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}
