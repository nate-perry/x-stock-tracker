import { kv } from '@vercel/kv'
import { computeSignal } from '@/app/lib/signal'
import { TICKERS, type TickerSymbol } from '@/app/lib/tickers'

const KV_TTL_S = 5 * 60

// Called by Vercel cron — pre-warms KV cache for all tickers
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results = await Promise.allSettled(
    (Object.keys(TICKERS) as TickerSymbol[]).map(async ticker => {
      const data = await computeSignal(ticker)
      await kv.set(ticker, data, { ex: KV_TTL_S })
      return ticker
    })
  )

  const warmed = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value)
  const failed = results.filter(r => r.status === 'rejected').length

  return Response.json({ warmed, failed })
}
