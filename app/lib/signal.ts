import { fetchPosts, fetchMentionCounts, bucketPostsHourly } from './x'
import { fetchPrices, mergePrices } from './price'
import { analyzeTicker } from './grok'

export interface SignalData {
  points: ReturnType<typeof mergePrices>
  summary: string
  overall_sentiment: number
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

  return {
    points: mergePrices(rawPoints, prices),
    summary: grokResult.summary,
    overall_sentiment: grokResult.overall_sentiment,
  }
}
