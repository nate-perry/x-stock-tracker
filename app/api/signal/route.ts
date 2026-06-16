import type { NextRequest } from 'next/server'
import { computeSignal, type SignalData } from '@/app/lib/signal'
import { TICKERS, type TickerSymbol } from '@/app/lib/tickers'

const FRESH_TTL_S = 5 * 60
const STALE_TTL_S = 60 * 60
const localCache = new Map<string, { data: SignalData; cachedAt: number }>()

async function cacheGet(key: string): Promise<{ data: SignalData; cachedAt: number } | null> {
  if (!process.env.KV_REST_API_URL) {
    return localCache.get(key) ?? null
  }
  const { kv } = await import('@vercel/kv')
  const entry = await kv.get<{ data: SignalData; cachedAt: number }>(key)
  return entry ?? null
}

async function cacheSet(key: string, data: SignalData) {
  const entry = { data, cachedAt: Date.now() }
  if (!process.env.KV_REST_API_URL) {
    localCache.set(key, entry)
    return
  }
  const { kv } = await import('@vercel/kv')
  await kv.set(key, entry, { ex: STALE_TTL_S })
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker || !(ticker in TICKERS)) {
    return Response.json({ error: 'invalid ticker' }, { status: 400 })
  }

  const force = request.nextUrl.searchParams.get('force') === 'true'
  const entry = force ? null : await cacheGet(ticker)
  const ageS = entry ? (Date.now() - entry.cachedAt) / 1000 : Infinity

  if (entry && ageS < FRESH_TTL_S) {
    return Response.json({ ...entry.data, stale: false })
  }

  if (entry && ageS < STALE_TTL_S) {
    computeSignal(ticker as TickerSymbol).then(fresh => cacheSet(ticker, fresh)).catch(() => {})
    return Response.json({ ...entry.data, stale: true })
  }

  // cache miss or force — fetch fresh and block
  const data = await computeSignal(ticker as TickerSymbol)
  await cacheSet(ticker, data)
  return Response.json({ ...data, stale: false })
}
