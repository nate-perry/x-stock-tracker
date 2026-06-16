import type { NextRequest } from 'next/server'
import { fetchPosts, fetchMentionCounts, bucketPostsHourly } from '@/app/lib/x'
import { fetchPrices, mergePrices } from '@/app/lib/price'
import { analyzeTicker } from '@/app/lib/grok'

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { data: unknown; expiresAt: number }>()

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const cached = cache.get(ticker)
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.data)
  }

  const [posts, prices, mentionCounts] = await Promise.all([
    fetchPosts(ticker),
    fetchPrices(ticker),
    fetchMentionCounts(ticker),
  ])

  const grokResult = await analyzeTicker(ticker, posts)

  const sentimentByHour = new Map(grokResult.hourly.map(h => [h.hour, h.sentiment]))

  const rawPoints = bucketPostsHourly(posts).map(p => ({
    ...p,
    mentions: mentionCounts.get(p.hour) ?? p.mentions,
    sentiment: sentimentByHour.get(p.hour) ?? p.sentiment,
  }))
  const points = mergePrices(rawPoints, prices)

  const data = { points, summary: grokResult.summary, overall_sentiment: grokResult.overall_sentiment }
  cache.set(ticker, { data, expiresAt: Date.now() + TTL_MS })

  return Response.json(data)
}
