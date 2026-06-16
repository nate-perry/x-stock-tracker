import type { TickerPoint, XPost, XResponse } from './types'

async function fetchPostsForHour(ticker: string, token: string, start: Date, end: Date): Promise<XPost[]> {
  const url = new URL('https://api.twitter.com/2/tweets/search/recent')
  url.searchParams.set('query', `$${ticker}`)
  url.searchParams.set('max_results', '100')
  url.searchParams.set('tweet.fields', 'created_at,text,public_metrics')
  url.searchParams.set('start_time', start.toISOString())
  url.searchParams.set('end_time', end.toISOString())

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`)

  const data: XResponse = await res.json()
  return data.data ?? []
}

export async function fetchPosts(ticker: string): Promise<XPost[]> {
  const token = process.env.X_BEARER_TOKEN
  if (!token) throw new Error('Missing X_BEARER_TOKEN')

  const now = new Date(Date.now() - 10_000)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const end = new Date(now.getTime() - i * 60 * 60 * 1000)
    const start = new Date(end.getTime() - 60 * 60 * 1000)
    return { start, end }
  })

  const results = await Promise.all(
    hours.map(({ start, end }) => fetchPostsForHour(ticker, token, start, end))
  )

  return results.flat()
}


interface CountsBucket {
  start: string
  end: string
  tweet_count: number
}

interface CountsResponse {
  data: CountsBucket[]
  meta: { total_tweet_count: number }
}

export async function fetchMentionCounts(ticker: string): Promise<Map<string, number>> {
  const token = process.env.X_BEARER_TOKEN
  if (!token) throw new Error('Missing X_BEARER_TOKEN')

  const url = new URL('https://api.twitter.com/2/tweets/counts/recent')
  url.searchParams.set('query', `$${ticker}`)
  url.searchParams.set('granularity', 'hour')
  url.searchParams.set('start_time', new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000).toISOString())

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`X counts API ${res.status}: ${await res.text()}`)

  const data: CountsResponse = await res.json()

  const map = new Map<string, number>()
  for (const bucket of data.data ?? []) {
    const hour = new Date(bucket.start)
    hour.setUTCMinutes(0, 0, 0)
    map.set(hour.toISOString().slice(0, 19) + 'Z', bucket.tweet_count)
  }
  return map
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
      sentiment: 0,
      price: null,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour))
}