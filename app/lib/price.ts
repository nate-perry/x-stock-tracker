import type { TickerPoint } from './types'

interface TwelveDataBar {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

interface TwelveDataResponse {
  meta: { symbol: string; interval: string; exchange_timezone: string }
  values: TwelveDataBar[]
  status: string
}

export async function fetchPrices(ticker: string): Promise<TwelveDataBar[]> {
  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', ticker)
  url.searchParams.set('interval', '1h')
  url.searchParams.set('outputsize', '24')
  url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Twelve Data error: ${res.status}`)

  const data: TwelveDataResponse = await res.json()
  if (data.status !== 'ok') throw new Error(`Twelve Data: ${JSON.stringify(data)}`)

  return data.values
}

// Twelve Data datetimes are Eastern (EDT = UTC-4). No tz marker in the string.
export function mergePrices(points: TickerPoint[], prices: TwelveDataBar[]): TickerPoint[] {
  const EDT_OFFSET_MS = 4 * 60 * 60 * 1000

  // { key, price }
  const sortedBars = prices
    .map(bar => {
      const easternMs = new Date(bar.datetime.replace(' ', 'T') + 'Z').getTime()
      const utcHour = new Date(easternMs + EDT_OFFSET_MS)
      utcHour.setUTCMinutes(0, 0, 0)
      return { key: utcHour.toISOString().slice(0, 19) + 'Z', price: parseFloat(bar.close) }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  const priceByHour = new Map(sortedBars.map(b => [b.key, b.price]))

  function lastKnownPrice(hour: string): number | null {
    if (priceByHour.has(hour)) return priceByHour.get(hour)!
    const prev = sortedBars.filter(b => b.key <= hour).at(-1)
    return prev?.price ?? null
  }

  return points.map(p => ({
    ...p,
    price: lastKnownPrice(p.hour),
  }))
}
