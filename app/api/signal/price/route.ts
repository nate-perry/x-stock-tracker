import type { NextRequest } from 'next/server'
import { fetchPrices } from '@/app/lib/price'

export async function GET(request: NextRequest) {
    const ticker = request.nextUrl.searchParams.get('ticker')
    if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

    const prices = await fetchPrices(ticker)
    return Response.json({ prices })
}