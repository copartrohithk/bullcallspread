# BullCallSpread — Stock Drop Backtester

A full-stack backtesting UI for the **"buy the dip"** trading strategy:
> If a stock falls ≥ X% on day D, buy at the open of day D+1 and sell at the close of day D+1.

## Features

- **Real-time stock screener** — scans 150 major US stocks using the free Yahoo Finance API (no API key required)
- **Configurable drop threshold** — 2 %, 5 %, 10 %, 15 % quick-select buttons or any custom value
- **Date range picker** — set screener date plus backtest start/end date independently
- **Candlestick charts** — top 5 dropped stocks shown with interactive OHLC charts (click to expand)
- **Volume charts** — green/red histogram below each candlestick chart
- **Chart time precision** — switch between **Day / Hour / 5-Min** intervals
- **Symbol search** — type any ticker to instantly load its chart for the selected date range
- **Remaining stocks list** — stocks beyond the top 5 are shown in a table
- **One-click backtest** — runs the strategy over any date range and returns a full trade log
- **Backtest dashboard** — total return %, total P&L, win rate, winners/losers, final capital

## Architecture

```
bullcallspread/
├── backend/           Node.js + Express  (port 3001)
│   ├── server.js      API — uses Yahoo Finance v8/v10 HTTP API directly
│   └── stocks-list.js 150 curated US tickers
└── frontend/          React + Vite        (port 5173)
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/
            ├── Controls.jsx          sidebar controls
            ├── StockScreener.jsx     screener + charts
            ├── CandlestickChart.jsx  lightweight-charts OHLC
            ├── VolumeChart.jsx       volume histogram
            └── BacktestResults.jsx   stats grid + trade log
```

## Quick Start

### Prerequisites
- Node.js 18+

### Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Run

```bash
# Terminal 1 — backend API
cd backend && npm start

# Terminal 2 — frontend dev server
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stocks/screener?threshold=10&date=YYYY-MM-DD` | Stocks that dropped ≥ threshold% on given date |
| GET | `/api/stocks/:symbol/history?from=&to=&interval=` | OHLCV history (`1d`, `1h`, `5m`) |
| POST | `/api/stocks/backtest` | Run buy-the-dip backtest over a date range |
| GET | `/api/stocks/quote?symbols=AAPL,MSFT` | Real-time quotes |
| GET | `/api/health` | Server health check |

## Backtest Strategy

- **Entry**: buy at open the day after the stock drops ≥ threshold%
- **Exit**: sell at close the same day
- **Position sizing**: 10 % of current capital per trade
- **Scope**: 50 of the 150 tracked stocks by default
