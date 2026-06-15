import type { NextRequest } from 'next/server'
import { fetchPosts, bucketPostsHourly } from '@/app/lib/x'
import { summarizeTicker } from '@/app/lib/grok'

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const posts = await fetchPosts(ticker)
  const points = bucketPostsHourly(posts)

  const samplePosts = posts.slice(0, 10).map(p => p.text)
  const summary = await summarizeTicker(ticker, points, samplePosts)

  return Response.json({ points, summary })
}
