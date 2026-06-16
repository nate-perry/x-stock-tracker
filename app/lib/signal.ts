import { fetchPosts, fetchMentionCounts, bucketPostsHourly } from './x'
import { fetchPrices, mergePrices } from './price'
import { analyzeTicker } from './grok'

import type { XPost } from './types'

export interface SignalData {
  points: ReturnType<typeof mergePrices>
  summary: string
  overall_sentiment: number
  topPosts: XPost[]
}

export async function computeSignal(ticker: string): Promise<SignalData> {
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

  const topPosts = [...posts]
    .sort((a, b) =>
      (b.public_metrics.like_count + b.public_metrics.retweet_count) -
      (a.public_metrics.like_count + a.public_metrics.retweet_count)
    )
    .slice(0, 15)

  return {
    points: mergePrices(rawPoints, prices),
    summary: grokResult.summary,
    overall_sentiment: grokResult.overall_sentiment,
    topPosts,
  }
}
