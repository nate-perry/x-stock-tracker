import Sentiment from 'sentiment'

import type { TickerPoint, XPost, XResponse } from './types'

const sentiment = new Sentiment()

export async function fetchPosts(ticker: string): Promise<XPost[]> {
  const token = process.env.X_BEARER_TOKEN
  if (!token) throw new Error('Missing X_BEARER_TOKEN')

  const url = new URL('https://api.twitter.com/2/tweets/search/recent')
  url.searchParams.set('query', `$${ticker}`)
  url.searchParams.set('max_results', '100')
  url.searchParams.set('tweet.fields', 'created_at,text')
  url.searchParams.set('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`)

  const data: XResponse = await res.json()
  return data.data ?? []
}


export function scorePost(text: string): number {
  const result = sentiment.analyze(text)
  return result.comparative
}

export function bucketPostsHourly(posts: XPost[]): TickerPoint[] {
  const buckets = new Map<string, XPost[]>()

  for (const post of posts) {
    const d = new Date(post.created_at)
    d.setUTCMinutes(0, 0, 0)
    const hour = d.toISOString().slice(0, 19) + 'Z'

    buckets.set(hour, [...(buckets.get(hour) ?? []), post])
  }

  return Array.from(buckets.entries())
    .map(([hour, bucket]) => ({
      hour,
      mentions: bucket.length,
      sentiment: bucket.reduce((sum, p) => sum + scorePost(p.text), 0) / bucket.length,
      price: null,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour))
}