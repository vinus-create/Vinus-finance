import { NextRequest, NextResponse } from 'next/server'

interface YahooMeta {
  regularMarketPrice: number
  previousClose?: number
  chartPreviousClose?: number
  currency?: string
  shortName?: string
  longName?: string
}

export async function GET(request: NextRequest) {
  const tickers = request.nextUrl.searchParams.get('tickers')
  if (!tickers) {
    return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
  }

  const tickerList = tickers.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20)

  const results: Record<string, {
    price: number
    prevClose: number
    name: string
    currency: string
  } | null> = {}

  await Promise.all(tickerList.map(async (ticker) => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinusFinance/1.0)' },
          next: { revalidate: 60 },
        }
      )
      if (!res.ok) { results[ticker] = null; return }
      const data = await res.json()
      const meta: YahooMeta | undefined = data?.chart?.result?.[0]?.meta
      if (meta?.regularMarketPrice) {
        results[ticker] = {
          price: meta.regularMarketPrice,
          prevClose: meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice,
          name: meta.shortName ?? meta.longName ?? ticker,
          currency: meta.currency ?? 'USD',
        }
      } else {
        results[ticker] = null
      }
    } catch {
      results[ticker] = null
    }
  }))

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
