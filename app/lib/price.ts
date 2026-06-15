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

export function mergePrices(points: TickerPoint[], prices: TwelveDataBar[]): TickerPoint[] {
  throw new Error('implement me')
}
