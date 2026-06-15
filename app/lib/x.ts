import type { TickerPoint, XPost, XResponse } from './types'

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
