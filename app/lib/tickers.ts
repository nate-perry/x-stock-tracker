export const TICKERS = {
  SPCX: { name: 'SpaceX', handle: 'SpaceX' },
  TSLA: { name: 'Tesla', handle: 'Tesla' },
  NVDA: { name: 'NVIDIA', handle: 'nvidia' },
  AAPL: { name: 'Apple', handle: 'Apple' },
  AMZN: { name: 'Amazon', handle: 'amazon' },
  GME:  { name: 'GameStop', handle: 'GameStop' },
} as const

export type TickerSymbol = keyof typeof TICKERS
