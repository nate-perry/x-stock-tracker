import type { NextRequest } from 'next/server'
import { TICKERS, type TickerSymbol } from '@/app/lib/tickers'

export interface XProfile {
  id: string
  name: string
  username: string
  description: string
  profile_image_url: string
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
  verified: boolean
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker || !(ticker in TICKERS)) {
    return Response.json({ error: 'invalid ticker' }, { status: 400 })
  }

  const token = process.env.X_BEARER_TOKEN
  if (!token) return Response.json({ error: 'missing token' }, { status: 500 })

  const handle = TICKERS[ticker as TickerSymbol].handle
  const url = new URL(`https://api.twitter.com/2/users/by/username/${handle}`)
  url.searchParams.set('user.fields', 'description,profile_image_url,public_metrics,verified')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) return Response.json({ error: `X API ${res.status}` }, { status: res.status })

  const data = await res.json()
  return Response.json(data.data as XProfile)
}
