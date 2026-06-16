'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TickerPoint, XPost } from './lib/types'
import { TICKERS, type TickerSymbol } from './lib/tickers'
import type { XProfile } from './api/profile/route'

interface SignalResponse {
  points: TickerPoint[]
  summary: string
  overall_sentiment: number
  topPosts: XPost[]
  stale: boolean
}

export default function Home() {
  const CACHE_TTL_MS = 15 * 60 * 1000

  function readCache(t: string): SignalResponse | null {
    try {
      const raw = localStorage.getItem(`signal:${t}`)
      if (!raw) return null
      const { data, ts } = JSON.parse(raw)
      if (Date.now() - ts > CACHE_TTL_MS) return null
      return data
    } catch { return null }
  }

  function writeCache(t: string, data: SignalResponse) {
    try { localStorage.setItem(`signal:${t}`, JSON.stringify({ data, ts: Date.now() })) }
    catch { /* storage full — silent fail */ }
  }

  const [ticker, setTicker] = useState<TickerSymbol>('NVDA')
  const [activeTicker, setActiveTicker] = useState('')
  const [data, setData] = useState<SignalResponse | null>(null)
  const [profile, setProfile] = useState<XProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const sessionCache = useRef<Map<string, SignalResponse>>(new Map())

  useEffect(() => {
    const last = localStorage.getItem('signal:last')
    if (!last) return
    const cached = readCache(last)
    if (cached) { setData(cached); setActiveTicker(last); setCachedAt(JSON.parse(localStorage.getItem(`signal:${last}`)!).ts) }
  }, [])

  async function loadTicker(t: string, force = false) {
    setError(null)
    if (!force) {
      if (sessionCache.current.has(t)) { setData(sessionCache.current.get(t)!); setActiveTicker(t); return }
      const cached = readCache(t)
      if (cached) {
        sessionCache.current.set(t, cached)
        setData(cached); setActiveTicker(t)
        setCachedAt(JSON.parse(localStorage.getItem(`signal:${t}`)!).ts)
        return
      }
    }
    setLoading(true); setData(null); setProfile(null)
    try {
      const [signalRes, profileRes] = await Promise.all([
        fetch(`/api/signal?ticker=${encodeURIComponent(t)}${force ? '&force=true' : ''}`),
        fetch(`/api/profile?ticker=${encodeURIComponent(t)}`),
      ])
      if (!signalRes.ok) throw new Error(`Error ${signalRes.status}`)
      let json: SignalResponse = await signalRes.json()
      if (!json.topPosts && !force) {
        const fresh = await fetch(`/api/signal?ticker=${encodeURIComponent(t)}&force=true`)
        if (fresh.ok) json = await fresh.json()
      }
      sessionCache.current.set(t, json)
      writeCache(t, json)
      localStorage.setItem('signal:last', t)
      setCachedAt(Date.now())
      setData(json); setActiveTicker(t)
      if (profileRes.ok) setProfile(await profileRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }


  const sentimentLabel = (s: number) => s > 0.2 ? 'Bullish' : s < -0.2 ? 'Bearish' : 'Neutral'
  const sentimentColor = (s: number) => s > 0.2 ? 'text-green-400' : s < -0.2 ? 'text-red-400' : 'text-zinc-400'

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">SIGNAL</span>
          <span className="text-zinc-600 text-xs">|</span>
          <span className="text-zinc-500 text-xs">X sentiment × price</span>
        </div>
        {activeTicker && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">
              ${activeTicker}
            </span>
            {cachedAt && (
              <span className="text-xs text-zinc-600">
                cached {Math.round((Date.now() - cachedAt) / 60000)}m ago
              </span>
            )}
            {data?.stale && (
              <span className="text-xs text-amber-500 animate-pulse">↻ refreshing</span>
            )}
            <button
              onClick={() => loadTicker(activeTicker, true)}
              disabled={loading}
              className="text-xs text-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-10">
          {(Object.keys(TICKERS) as TickerSymbol[]).map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); loadTicker(t) }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                activeTicker === t
                  ? 'bg-white text-zinc-950'
                  : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              <span className="font-mono">{t}</span>
              <span className="text-xs ml-2 opacity-60">{TICKERS[t].name}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm mb-8">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-zinc-500 text-sm">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            Fetching posts, prices, and generating Grok analysis…
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                <p className="text-zinc-500 text-xs mb-1">Total Mentions</p>
                <p className="text-2xl font-semibold">{data.points.reduce((s, p) => s + p.mentions, 0).toLocaleString()}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                <p className="text-zinc-500 text-xs mb-1">Overall Sentiment</p>
                <p className={`text-2xl font-semibold ${sentimentColor(data.overall_sentiment)}`}>
                  {sentimentLabel(data.overall_sentiment)}
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                <p className="text-zinc-500 text-xs mb-1">Sentiment Score</p>
                <p className="text-2xl font-semibold">{data.overall_sentiment.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                <p className="text-zinc-500 text-xs mb-1">Latest Price</p>
                <p className="text-2xl font-semibold">
                  {data.points.at(-1)?.price != null ? `$${data.points.at(-1)!.price!.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-widest">24h Overview (EDT)</p>
                <div className="group relative">
                  <span className="w-4 h-4 rounded-full border border-zinc-600 text-zinc-500 text-xs flex items-center justify-center cursor-default select-none">i</span>
                  <div className="absolute right-0 top-6 w-72 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 leading-5 hidden group-hover:block z-10 shadow-xl">
                    <p className="mb-2"><span className="text-green-400 font-medium">Green line</span> — share price (right axis, scaled to actual range)</p>
                    <p className="mb-2"><span className="text-blue-400 font-medium">Blue dashed line</span> — hourly sentiment scored by Grok (-1 bearish → +1 bullish)</p>
                    <p><span className="text-zinc-400 font-medium">Grey bars</span> — total X mention volume per hour (left axis)</p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.points} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={h => new Date(h).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York', hour12: false })}
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={{ stroke: '#3f3f46' }}
                    tickLine={false}
                  />
                  <YAxis yAxisId="price" orientation="right" tick={{ fill: '#52525b', fontSize: 11 }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false}
                    domain={([min, max]: readonly [number, number]) => {
                      const pad = (max - min) * 0.1 || 1
                      return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number]
                    }}
                  />
                  <YAxis yAxisId="mentions" orientation="left" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="sentiment" orientation="right" domain={[-1, 1]} hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={h => new Date(h).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' EDT'}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                  <Bar yAxisId="mentions" dataKey="mentions" fill="#3f3f46" name="Mentions" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#22c55e" dot={false} name="Price" strokeWidth={2} />
                  <Line yAxisId="sentiment" type="monotone" dataKey="sentiment" stroke="#60a5fa" dot={false} name="Sentiment" strokeWidth={1.5} strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {(profile || data.topPosts?.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {profile && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">Company Profile</p>
                    <div className="flex items-start gap-4">
                      {profile.profile_image_url && (
                        <img
                          src={profile.profile_image_url.replace('_normal', '_bigger')}
                          alt={profile.name}
                          className="w-14 h-14 rounded-full border border-zinc-700 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-white">{profile.name}</span>
                          {profile.verified && (
                            <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.88 9.33 2 10.57 2 12s.88 2.67 2.19 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.92.81C9.33 21.12 10.57 22 12 22s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91C21.37 14.67 22.25 13.43 22.25 12zm-6.16-1.96l-4.5 6a.75.75 0 01-1.11.1l-2.5-2.5a.75.75 0 011.06-1.06l1.9 1.9 3.99-5.31a.75.75 0 011.16.94z"/>
                            </svg>
                          )}
                        </div>
                        <p className="text-zinc-500 text-sm mb-2">@{profile.username}</p>
                        {profile.description && (
                          <p className="text-zinc-300 text-sm leading-6 mb-3">{profile.description}</p>
                        )}
                        <div className="flex gap-5 text-xs text-zinc-500">
                          <span><span className="text-zinc-200 font-medium">{profile.public_metrics.followers_count.toLocaleString()}</span> followers</span>
                          <span><span className="text-zinc-200 font-medium">{profile.public_metrics.tweet_count.toLocaleString()}</span> posts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {data.topPosts?.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">Top Mentions</p>
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-64 pr-1">
                      {data.topPosts.map(post => {
                        const engagement = post.public_metrics.like_count + post.public_metrics.retweet_count
                        return (
                          <a
                            key={post.id}
                            href={`https://x.com/i/web/status/${post.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-lg p-3 transition-colors group"
                          >
                            <p className="text-sm text-zinc-200 leading-5 mb-2 line-clamp-3">{post.text}</p>
                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>
                                {post.public_metrics.like_count.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                                {post.public_metrics.retweet_count.toLocaleString()}
                              </span>
                              <span className="ml-auto text-zinc-600 text-xs group-hover:text-zinc-400 transition-colors">
                                {engagement.toLocaleString()} eng ↗
                              </span>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Grok Analysis</p>
              <p className="text-sm text-zinc-200 leading-7">{data.summary}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
