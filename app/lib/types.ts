export interface TickerPoint {
    hour: string
    mentions: number
    sentiment: number
    price: number | null
}

export interface XPost {
    id: string
    text: string
    created_at: string
    edit_history_tweet_ids: string[]
}

export interface XResponse {
    data: XPost[]
    meta: {
        newest_id: string
        oldest_id: string
        result_count: number
        next_token?: string
    }
}