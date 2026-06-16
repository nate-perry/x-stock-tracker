# SIGNAL

Pick a stock ticker, pull the last 24 hours of X posts, sore sentiment using Grok, and overlay everything against price + mention volume so you can actually see how narrative and price move together.

Live deployment: [stock.nrperry.com](https://stock.nrperry.com)

---

## What it does

1. Pulls ~24 hours of X posts for a ticker (`$NVDA`, `$TSLA`, etc.) using 1-hour windows in parallel. This is mainly to get around the 100-post cap in the X recent search API so we don’t just see the latest spike.

2. Pulls real mention counts from the X counts endpoint. This is what drives the hourly volume bars in the chart.

3. Runs sentiment scoring using Grok (`grok-4.3`). Posts are grouped by hour and sent in one structured request. Output is hourly sentiment in `[-1, 1]` plus a short narrative summary.

4. Pulls hourly price candles from Twelve Data and aligns everything to the same timeline so sentiment and price are actually comparable.

5. Pulls basic company profile data from the X user API and surfaces top posts ranked by engagement.


---

## Architecture

```
page.tsx (client)
  └── /api/signal      
        └── computeSignal()   
              ├── fetchPosts()            24x 1 hour windows 
              ├── fetchMentionCounts()    X counts endpoint
              ├── fetchPrices()           Twelve Data OHLC
              └── analyzeTicker()    
  └── /api/profile     X users info
  └── /api/warm        Cron pre-warm endpoint (protected by CRON_SECRET)
```
## Caching

Three layers so this doesn’t fall over under load:

| Layer | Scope | Why it exists |
|------|------|----------------|
| In-memory Map | single server instance | instant reuse during runtime |
| localStorage | browser | avoids refetching same ticker on reload |
| Vercel KV | shared cache | keeps responses warm across users |

KV uses stale-while-revalidate so most requests return instantly even if data is slightly outdated.

There’s also a cron job that hits `/api/warm` at market open to pre-seed common tickers.

---
## Why Grok for sentiment

Financial text is messy.

Things like “beat”, “miss”, “priced in”, “short squeeze”, “cut guidance” don’t behave well with generic sentiment models.

Grok handles that context better than basic sentiment models, so instead of maintaining a lexicon + weighting system, we just send grouped posts and get back:

- hourly sentiment scores (`-1 → 1`)
- a short narrative summary


---
### Given more time

These are features I would prioritize:
- **X Activity API for live company signal**
  -  I evaluated Activity API for use in this project however given its streaming nature it didnt work for my serverless vercel deployment and I did not have enough time to migrate. I think it would be interesting to see if there was any indicator data related to a company's account level updates and how that compares to mentions/stock price/etc
- **Real time updates**
  - Along the same lines as the above for justification it would be nice to implement the filtered stream listener directly to a db and then our frontend could poll that directly, making the caching process a little more straight forward
- **Sentiment vs Price as a quantified signal** 
  - right now the lead/lag is visual, with more time I would compute the cross-correlation, i.e. does sentiment lead price by `n` hours? And attempt to calculate what that looks like 
- **Backtesting**
  - Right now our app only visualizes the last 24 hours, it would be interesting to store historical sentiment over time and price to test whether the lead signal is predictive not just illustrative
- **Sentiment confidence/volume weighting** 
  - Down weight low volume hours where a handful of posts are more likely to swing the score
- **More stock tickers**
  - It would be nice for customers to be able to bring their own stock ticker and we have a system to get the x account from that in an automated fashion so we dont need to hard code the ticker + x account like we are right now

---

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Recharts (dual-axis chart: price, mentions, sentiment)
- X API v2 (search/recent, counts/recent, users/by/username)
- Grok (`grok-4.3`) for sentiment + summarization
- Twelve Data for hourly OHLC candles
- Vercel KV (Upstash Redis) for caching
- Vitest for utility tests


---

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in env vars (see below)
npm run dev
```

### Environment variables

```
X_BEARER_TOKEN=        # X API v2 bearer token
TWELVE_DATA_API_KEY=   # Twelve Data (twelvedata.com)
XAI_API_KEY=           # xAI / Grok (api.x.ai)

KV_REST_API_URL=       # Vercel KV REST URL (optional — falls back to in-memory Map locally)
KV_REST_API_TOKEN=     # Vercel KV REST token
CRON_SECRET=           # Random string to protect /api/warm
```

KV is optional locally, it falls back to an in-memory Map.

### Tests

```bash
npm test
```

---

## Tickers

SPCX · TSLA · NVDA · AAPL · AMZN · GME

Defined in `app/lib/tickers.ts` — add a symbol, display name, and X handle to extend.
