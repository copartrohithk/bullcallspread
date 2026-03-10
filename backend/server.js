import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Load static stock data ───────────────────────────────────────────────────
const stockDataPath = path.join(__dirname, 'stock-data.json');
let STOCK_DATA = { symbols: [], stockInfo: {}, data: {} };

try {
  const rawData = fs.readFileSync(stockDataPath, 'utf8');
  STOCK_DATA = JSON.parse(rawData);
  console.log(`Loaded stock data for ${STOCK_DATA.symbols.length} symbols: ${STOCK_DATA.symbols.join(', ')}`);
  console.log(`Data range: ${STOCK_DATA.fromDate} to ${STOCK_DATA.toDate}`);
} catch (err) {
  console.error('Failed to load stock-data.json:', err.message);
}

// Use the symbols from the static data file
const STOCK_LIST = STOCK_DATA.symbols;

// ─── Simple in-memory cache ───────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Get chart data from static data file.
 * Filters by date range and returns data for the given symbol.
 * interval: only '1d' is supported with static data
 */
function getChartFromStaticData(symbol, from, to, interval = '1d') {
  const symbolData = STOCK_DATA.data[symbol.toUpperCase()];
  if (!symbolData || symbolData.length === 0) {
    throw new Error(`No chart data for ${symbol}`);
  }

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate = new Date(to + 'T23:59:59Z');

  // Filter data within the requested date range
  const filteredData = symbolData.filter(d => {
    const date = new Date(d.date);
    return date >= fromDate && date <= toDate;
  });

  if (filteredData.length === 0) {
    throw new Error(`No chart data for ${symbol} in the specified date range`);
  }

  return filteredData;
}

/**
 * Get quote data from static data file (using the most recent data point).
 */
function getQuoteFromStaticData(symbol) {
  const symbolData = STOCK_DATA.data[symbol.toUpperCase()];
  const stockInfo = STOCK_DATA.stockInfo[symbol.toUpperCase()];
  
  if (!symbolData || symbolData.length < 2) {
    throw new Error(`No quote data for ${symbol}`);
  }

  // Get the last two data points to calculate change
  const sorted = [...symbolData].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  
  const change = latest.close - previous.close;
  const changePercent = (change / previous.close) * 100;

  return {
    symbol: symbol.toUpperCase(),
    name: stockInfo?.name || symbol.toUpperCase(),
    price: latest.close,
    change: +change.toFixed(4),
    changePercent: +changePercent.toFixed(2),
    volume: latest.volume,
    marketCap: null, // Not available in static data
    prevClose: previous.close,
  };
}

// ─── Screener helper ──────────────────────────────────────────────────────────
function getDroppedStocks(threshold, date) {
  const results = [];

  // Get data for each symbol and find the change for the requested date
  for (const symbol of STOCK_LIST) {
    try {
      const symbolData = STOCK_DATA.data[symbol];
      if (!symbolData || symbolData.length < 2) continue;

      // Sort by date
      const sorted = [...symbolData].sort((a, b) => a.date.localeCompare(b.date));
      
      // Find the bar for the requested date or the closest prior trading day
      const targetDate = new Date(date + 'T23:59:59Z');
      let currIndex = -1;
      
      for (let i = sorted.length - 1; i >= 0; i--) {
        const barDate = new Date(sorted[i].date);
        if (barDate <= targetDate) {
          currIndex = i;
          break;
        }
      }
      
      // Need at least 2 bars (current + previous)
      if (currIndex < 1) continue;
      
      const curr = sorted[currIndex];
      const prev = sorted[currIndex - 1];
      const changePct = ((curr.close - prev.close) / prev.close) * 100;
      
      results.push({
        symbol,
        close: +curr.close.toFixed(4),
        open: +curr.open.toFixed(4),
        high: +curr.high.toFixed(4),
        low: +curr.low.toFixed(4),
        volume: curr.volume,
        prevClose: +prev.close.toFixed(4),
        changePercent: +changePct.toFixed(2),
        date: curr.date.split('T')[0],
      });
    } catch {
      // Skip symbols with errors
    }
  }

  return results
    .filter(s => s.changePercent <= -threshold)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 20);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/stocks/screener?threshold=10&date=YYYY-MM-DD
app.get('/api/stocks/screener', (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 10;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const key = `screener:${threshold}:${date}`;
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const dropped = getDroppedStocks(threshold, date);
    setCache(key, dropped);
    res.json(dropped);
  } catch (err) {
    console.error('Screener error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stocks/:symbol/history?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=1d
app.get('/api/stocks/:symbol/history', (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to, interval = '1d' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    const key = `history:${symbol}:${from}:${to}:${interval}`;
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const data = getChartFromStaticData(symbol, from, to, interval);
    setCache(key, data);
    res.json(data);
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stocks/backtest
// body: { symbols?, startDate, endDate, threshold, initialCapital, positionSizePct }
app.post('/api/stocks/backtest', (req, res) => {
  try {
    const {
      symbols,
      startDate,
      endDate,
      threshold = 10,
      initialCapital = 10000,
      positionSizePct = 10, // % of capital to allocate per trade (1–100)
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const positionFraction = Math.min(Math.max(parseFloat(positionSizePct) || 10, 1), 100) / 100;
    const symbolList = symbols?.length ? symbols : STOCK_LIST;
    let capital = initialCapital;
    const trades = [];

    // Get data from static storage for all symbols
    const allData = {};
    for (const sym of symbolList) {
      try {
        const data = STOCK_DATA.data[sym];
        if (data) {
          allData[sym] = [...data].sort((a, b) => a.date.localeCompare(b.date));
        }
      } catch {
        // Skip symbols with errors
      }
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    for (const sym of symbolList) {
      const prices = allData[sym];
      if (!prices || prices.length < 3) continue;

      for (let i = 1; i < prices.length - 1; i++) {
        const prevDay = prices[i - 1];
        const dropDay = prices[i];
        const buyDay = prices[i + 1];

        const dropDt = new Date(dropDay.date);
        if (dropDt < start || dropDt > end) continue;

        const changePct = ((dropDay.close - prevDay.close) / prevDay.close) * 100;
        if (changePct > -threshold) continue;

        const buyPrice = buyDay.open;
        const sellPrice = buyDay.close;
        if (!buyPrice || !sellPrice) continue;

        const returnPct = ((sellPrice - buyPrice) / buyPrice) * 100;
        const positionSize = capital * positionFraction;
        const pnl = positionSize * (returnPct / 100);
        capital += pnl;

        trades.push({
          symbol: sym,
          dropDate: dropDay.date.split('T')[0],
          buyDate: buyDay.date.split('T')[0],
          dropPercent: +changePct.toFixed(2),
          buyPrice: +buyPrice.toFixed(2),
          sellPrice: +sellPrice.toFixed(2),
          returnPercent: +returnPct.toFixed(2),
          pnl: +pnl.toFixed(2),
        });
      }
    }

    trades.sort((a, b) => a.buyDate.localeCompare(b.buyDate));

    const totalTrades = trades.length;
    const winners = trades.filter(t => t.returnPercent > 0).length;
    const winRate = totalTrades > 0 ? +((winners / totalTrades) * 100).toFixed(1) : 0;
    const totalReturn = +(((capital - initialCapital) / initialCapital) * 100).toFixed(2);
    const totalPnL = +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2);

    res.json({
      trades,
      totalTrades,
      winners,
      winRate,
      totalReturn,
      totalPnL,
      finalCapital: +capital.toFixed(2),
      initialCapital,
      positionSizePct: +(positionFraction * 100).toFixed(1),
    });
  } catch (err) {
    console.error('Backtest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stocks/quote?symbols=AAPL,MSFT
app.get('/api/stocks/quote', (req, res) => {
  try {
    const syms = (req.query.symbols || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!syms.length) return res.status(400).json({ error: 'symbols required' });
    const results = syms.map(s => {
      try {
        return getQuoteFromStaticData(s);
      } catch {
        return null;
      }
    }).filter(Boolean);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', tickers: STOCK_LIST.length }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
