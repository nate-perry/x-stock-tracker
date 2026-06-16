import type { NextRequest } from 'next/server'
import { computeSignal, type SignalData } from '@/app/lib/signal'
import { TICKERS, type TickerSymbol } from '@/app/lib/tickers'

const KV_TTL_S = 5 * 60
const localCache = new Map<string, { data: SignalData; expiresAt: number }>()

async function cacheGet(key: string): Promise<SignalData | null> {
  if (!process.env.KV_REST_API_URL) {
    const entry = localCache.get(key)
    return entry && entry.expiresAt > Date.now() ? entry.data : null
  }
  const { kv } = await import('@vercel/kv')
  return kv.get<SignalData>(key)
}

async function cacheSet(key: string, data: SignalData) {
  if (!process.env.KV_REST_API_URL) {
    localCache.set(key, { data, expiresAt: Date.now() + KV_TTL_S * 1000 })
    return
  }
  const { kv } = await import('@vercel/kv')
  await kv.set(key, data, { ex: KV_TTL_S })
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker || !(ticker in TICKERS)) {
    return Response.json({ error: 'invalid ticker' }, { status: 400 })
  }

  const force = request.nextUrl.searchParams.get('force') === 'true'

  if (!force) {
    const cached = await cacheGet(ticker)
    if (cached) return Response.json(cached)
  }

  const data = await computeSignal(ticker as TickerSymbol)
  await cacheSet(ticker, data)

  return Response.json(data)
}
