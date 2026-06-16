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
import type { TickerPoint } from './lib/types'
import { TICKERS, type TickerSymbol } from './lib/tickers'

interface SignalResponse {
  points: TickerPoint[]
  summary: string
  overall_sentiment: number
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
    setLoading(true); setData(null)
    try {
      const res = await fetch(`/api/signal?ticker=${encodeURIComponent(t)}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json: SignalResponse = await res.json()
      sessionCache.current.set(t, json)
      writeCache(t, json)
      localStorage.setItem('signal:last', t)
      const ts = Date.now()
      setCachedAt(ts)
      setData(json); setActiveTicker(t)
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
                    domain={([min, max]: [number, number]) => {
                      const pad = (max - min) * 0.1 || 1
                      return [Math.floor(min - pad), Math.ceil(max + pad)]
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
