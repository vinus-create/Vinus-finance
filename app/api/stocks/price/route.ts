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

  // Separate special tickers from regular Yahoo Finance tickers
  const SPECIAL_TICKERS = new Set(['GOLD-MYR-GRAM'])
  const regularTickers = tickerList.filter(t => !SPECIAL_TICKERS.has(t))
  const specialTickers = tickerList.filter(t => SPECIAL_TICKERS.has(t))

  async function fetchYahoo(ticker: string): Promise<{ price: number; prevClose: number; name: string; currency: string } | null> {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinusFinance/1.0)' },
          next: { revalidate: 60 },
        }
      )
      if (!res.ok) return null
      const data = await res.json()
      const meta: YahooMeta | undefined = data?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      return {
        price: meta.regularMarketPrice,
        prevClose: meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice,
        name: meta.shortName ?? meta.longName ?? ticker,
        currency: meta.currency ?? 'USD',
      }
    } catch {
      return null
    }
  }

  await Promise.all(regularTickers.map(async (ticker) => {
    results[ticker] = await fetchYahoo(ticker)
  }))

  // GOLD-MYR-GRAM: XAU/USD spot ÷ 31.1035 troy oz/gram × USD/MYR = RM per gram
  if (specialTickers.includes('GOLD-MYR-GRAM')) {
    try {
      const [xau, usdmyr] = await Promise.all([
        fetchYahoo('XAUUSD=X'),
        fetchYahoo('USDMYR=X'),
      ])
      if (xau && usdmyr) {
        const TROY_OZ_PER_GRAM = 31.1035
        const priceRmGram = (xau.price / TROY_OZ_PER_GRAM) * usdmyr.price
        const prevRmGram = (xau.prevClose / TROY_OZ_PER_GRAM) * usdmyr.price
        results['GOLD-MYR-GRAM'] = {
          price: parseFloat(priceRmGram.toFixed(2)),
          prevClose: parseFloat(prevRmGram.toFixed(2)),
          name: 'Gold (RM/gram)',
          currency: 'MYR',
        }
      } else {
        results['GOLD-MYR-GRAM'] = null
      }
    } catch {
      results['GOLD-MYR-GRAM'] = null
    }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
