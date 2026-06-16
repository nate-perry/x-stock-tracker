import { describe, it, expect } from 'vitest'
import { bucketPostsHourly } from '../x'
import { mergePrices } from '../price'
import type { XPost } from '../types'

function makePost(created_at: string, text = 'NVDA looks good', likes = 0): XPost {
  return {
    id: created_at,
    text,
    created_at,
    edit_history_tweet_ids: [],
    public_metrics: { like_count: likes, retweet_count: 0, reply_count: 0, impression_count: 0 },
  }
}

// --- bucketPostsHourly ---

describe('bucketPostsHourly', () => {
  it('groups posts in the same hour into one bucket', () => {
    const posts = [
      makePost('2026-06-15T14:10:00.000Z'),
      makePost('2026-06-15T14:45:00.000Z'),
    ]
    const points = bucketPostsHourly(posts)
    expect(points).toHaveLength(1)
    expect(points[0].hour).toBe('2026-06-15T14:00:00Z')
    expect(points[0].mentions).toBe(2)
  })

  it('creates separate buckets for different hours', () => {
    const posts = [
      makePost('2026-06-15T14:30:00.000Z'),
      makePost('2026-06-15T15:30:00.000Z'),
    ]
    const points = bucketPostsHourly(posts)
    expect(points).toHaveLength(2)
  })

  it('returns points sorted by hour ascending', () => {
    const posts = [
      makePost('2026-06-15T16:00:00.000Z'),
      makePost('2026-06-15T14:00:00.000Z'),
      makePost('2026-06-15T15:00:00.000Z'),
    ]
    const points = bucketPostsHourly(posts)
    expect(points.map(p => p.hour)).toEqual([
      '2026-06-15T14:00:00Z',
      '2026-06-15T15:00:00Z',
      '2026-06-15T16:00:00Z',
    ])
  })

  it('sets price to null and sentiment to 0 (Grok fills these in)', () => {
    const points = bucketPostsHourly([makePost('2026-06-15T14:00:00.000Z')])
    expect(points[0].price).toBeNull()
    expect(points[0].sentiment).toBe(0)
  })
})

// --- mergePrices ---

describe('mergePrices', () => {
  it('fills price for exact hour match', () => {
    const points = [{ hour: '2026-06-15T19:00:00Z', mentions: 5, sentiment: 0.1, price: null }]
    const prices = [{ datetime: '2026-06-15 15:00:00', open: '210', high: '215', low: '209', close: '212.46', volume: '1000000' }]
    const merged = mergePrices(points, prices)
    expect(merged[0].price).toBeCloseTo(212.46)
  })

  it('carries forward last known price for after-hours points', () => {
    const points = [{ hour: '2026-06-15T23:00:00Z', mentions: 10, sentiment: 0.2, price: null }]
    const prices = [{ datetime: '2026-06-15 15:30:00', open: '210', high: '215', low: '209', close: '212.46', volume: '1000000' }]
    const merged = mergePrices(points, prices)
    expect(merged[0].price).toBeCloseTo(212.46)
  })

  it('returns null price when no bars exist before the point', () => {
    const points = [{ hour: '2026-06-15T10:00:00Z', mentions: 5, sentiment: 0.0, price: null }]
    const prices = [{ datetime: '2026-06-15 15:00:00', open: '210', high: '215', low: '209', close: '212.46', volume: '1000000' }]
    const merged = mergePrices(points, prices)
    expect(merged[0].price).toBeNull()
  })
})
