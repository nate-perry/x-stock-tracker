import type { TickerPoint } from './types'

interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GrokResponse {
  choices: { message: { content: string } }[]
}

export async function summarizeTicker(
  ticker: string,
  points: TickerPoint[],
  samplePosts: string[],
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('Missing XAI_API_KEY')

  const messages: GrokMessage[] = buildPrompt(ticker, points, samplePosts)

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      messages,
      temperature: 0.3,
    }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Grok API ${res.status}: ${await res.text()}`)

  const data: GrokResponse = await res.json()
  return data.choices[0].message.content
}


function buildPrompt(
  ticker: string,
  points: TickerPoint[],
  samplePosts: string[],
): GrokMessage[] {
  return [
    {
      role: 'system', content: ` You are a financial analyst specializing in social sentiment. Respond in 2-3 sentences explaining what the X conversation around this
  ticker looks like and whether it appears to be influencing price movement. Be direct and specific. Do not hedge excessively.\nYou have access to real-time X data. Use both the provided
  posts and your own knowledge of recent X activity around this ticker to inform your analysis.` },
    {
      role: 'user', content: `Ticker: $${ticker}\n\nHourly data:\n${JSON.stringify(points, null, 2)}\n\nSample
  posts:\n${samplePosts.join('\n')}\n\nWhat is driving activity around this ticker? Please note any significant changes
  in mention volume over the time range provided.`
    },
  ]
}
