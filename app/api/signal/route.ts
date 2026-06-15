import type { NextRequest } from 'next/server'
import { fetchPosts, bucketPostsHourly } from '@/app/lib/x'
import { fetchPrices, mergePrices } from '@/app/lib/price'
import { summarizeTicker } from '@/app/lib/grok'

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const [posts, prices] = await Promise.all([
    fetchPosts(ticker),
    fetchPrices(ticker),
  ])

  const rawPoints = bucketPostsHourly(posts)
  const points = mergePrices(rawPoints, prices)

  const samplePosts = posts.slice(0, 10).map(p => p.text)
  const summary = await summarizeTicker(ticker, points, samplePosts)

  return Response.json({ points, summary })
}
