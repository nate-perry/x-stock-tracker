export const TICKERS = {
  NVDA: { name: 'NVIDIA', handle: 'nvidia' },
  TSLA: { name: 'Tesla', handle: 'Tesla' },
  AAPL: { name: 'Apple', handle: 'Apple' },
  AMZN: { name: 'Amazon', handle: 'amazon' },
  GME:  { name: 'GameStop', handle: 'GameStop' },
  SPCX: { name: 'SpaceX', handle: 'SpaceX' },
} as const

export type TickerSymbol = keyof typeof TICKERS
