import type { NextRequest } from 'next/server'
import { fetchPosts } from '@/app/lib/x'

export async function GET(request: NextRequest) {
    const ticker = request.nextUrl.searchParams.get('ticker')
    if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

    const prices = await fetchPosts(ticker)
    return Response.json({ prices })
}