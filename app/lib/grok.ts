import type { XPost } from './types'

interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GrokApiResponse {
  choices: { message: { content: string } }[]
}

export interface HourlySentiment {
  hour: string
  sentiment: number
  confidence: number
}

export interface GrokSentimentResult {
  hourly: HourlySentiment[]
  summary: string
  overall_sentiment: number
}

export async function analyzeTicker(
  ticker: string,
  posts: XPost[],
): Promise<GrokSentimentResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('Missing XAI_API_KEY')

  const messages: GrokMessage[] = buildPrompt(ticker, posts)

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Grok API ${res.status}: ${await res.text()}`)

  const raw: GrokApiResponse = await res.json()
  const content = raw.choices[0].message.content

  return parseResult(content)
}

function parseResult(content: string): GrokSentimentResult {
  try {
    const parsed = JSON.parse(content)
    return {
      hourly: Array.isArray(parsed.hourly) ? parsed.hourly.map((h: HourlySentiment) => ({
        hour: String(h.hour),
        sentiment: Math.max(-1, Math.min(1, Number(h.sentiment))),
        confidence: Math.max(0, Math.min(1, Number(h.confidence))),
      })) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      overall_sentiment: Math.max(-1, Math.min(1, Number(parsed.overall_sentiment ?? 0))),
    }
  } catch {
    return { hourly: [], summary: content, overall_sentiment: 0 }
  }
}

function buildPrompt(ticker: string, posts: XPost[]): GrokMessage[] {
  const byHour: Record<string, XPost[]> = {}
  for (const post of posts) {
    const d = new Date(post.created_at)
    d.setUTCMinutes(0, 0, 0)
    const hour = d.toISOString().slice(0, 19) + 'Z'
    byHour[hour] = [...(byHour[hour] ?? []), post]
  }

  const hourBlocks = Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, ps]) => {
      const lines = ps.map(p =>
        `[likes:${p.public_metrics.like_count} rt:${p.public_metrics.retweet_count}] ${p.text}`
      ).join('\n')
      return `HOUR ${hour}:\n${lines}`
    }).join('\n\n')

  return [
    {
      role: 'system',
      content: `You are a financial sentiment analyst. You will be given X (Twitter) posts about a stock ticker grouped by UTC hour. Score the sentiment of each hour and write a brief narrative summary.

Respond ONLY with valid JSON matching this exact schema — no prose outside the JSON:
{
  "hourly": [{ "hour": "<ISO hour string>", "sentiment": <-1.0 to 1.0>, "confidence": <0.0 to 1.0> }],
  "summary": "<2-3 sentence narrative>",
  "overall_sentiment": <-1.0 to 1.0>
}

Sentiment scale — use the FULL range, do not hedge toward 0:
  +1.0 = euphoric: crushed earnings, ripping, moon, massive beat
  +0.5 = bullish: upgrade, strong buy, price target raised
   0.0 = neutral: informational, watchlist mentions, no clear lean
  -0.5 = bearish: downgrade, weak guidance, disappointing
  -1.0 = panic: dumping, rug, crash, catastrophic miss

Rules:
- Score ONLY from the provided posts. Do not use outside knowledge for sentiment scores.
- Weight high-engagement posts (likes + retweets) more heavily than low-engagement noise.
- confidence reflects how clear the signal is (low if posts are sparse or contradictory).
- summary may reference your broader knowledge of $${ticker} for context.`,
    },
    {
      role: 'user',
      content: `Ticker: $${ticker}\n\nPosts by hour:\n\n${hourBlocks}`,
    },
  ]
}
