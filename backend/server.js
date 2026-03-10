import express from 'express';
import cors from 'cors';
import { STOCK_LIST } from './stocks-list.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

// ─── Yahoo Finance HTTP helpers ───────────────────────────────────────────────
const YF_BASE = 'https://query1.finance.yahoo.com';
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BullCallSpread/1.0)',
  Accept: 'application/json',
};

/**
 * Fetch OHLCV chart bars from Yahoo Finance v8 chart API.
 * interval: 1d | 1h | 5m | 1m
 */
async function fetchChart(symbol, from, to, interval = '1d') {
  const p1 = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
  const p2 = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000);
  const url =
    `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${p1}&period2=${p2}&interval=${interval}&includePrePost=false`;

  let resp;
  try {
    resp = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(10000) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`Request timed out fetching data for ${symbol} — Yahoo Finance may be slow`);
    }
    throw err;
  }
  if (!resp.ok) throw new Error(`YF HTTP ${resp.status} for ${symbol}`);

  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};

  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString(),
      open: q.open?.[i] ?? null,
      high: q.high?.[i] ?? null,
      low: q.low?.[i] ?? null,
      close: q.close?.[i] ?? null,
      volume: q.volume?.[i] ?? null,
    }))
    .filter(d => d.open != null && d.close != null);
}

/**
 * Real-time quote via Yahoo Finance v10 quoteSummary.
 */
async function fetchQuote(symbol) {
  const url = `${YF_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price`;
  const resp = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`YF HTTP ${resp.status} for ${symbol}`);
  const json = await resp.json();
  const price = json?.quoteSummary?.result?.[0]?.price;
  if (!price) throw new Error(`No quote data for ${symbol}`);
  return {
    symbol,
    name: price.shortName || price.longName || symbol,
    price: price.regularMarketPrice?.raw ?? null,
    change: price.regularMarketChange?.raw ?? null,
    changePercent: price.regularMarketChangePercent?.raw ?? null,
    volume: price.regularMarketVolume?.raw ?? null,
    marketCap: price.marketCap?.raw ?? null,
    prevClose: price.regularMarketPreviousClose?.raw ?? null,
  };
}

// ─── Screener helper ──────────────────────────────────────────────────────────
async function fetchDroppedStocks(threshold, date) {
  // Fetch the last 10 days so we always have a prior close even over weekends
  const fromDate = new Date(date + 'T00:00:00Z');
  fromDate.setUTCDate(fromDate.getUTCDate() - 10);
  const fromStr = fromDate.toISOString().split('T')[0];

  const CHUNK = 20;
  const results = [];

  for (let i = 0; i < STOCK_LIST.length; i += CHUNK) {
    const chunk = STOCK_LIST.slice(i, i + CHUNK);
    const chunkResults = await Promise.all(
      chunk.map(async symbol => {
        try {
          const bars = await fetchChart(symbol, fromStr, date, '1d');
          if (bars.length < 2) return null;
          const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
          const prev = sorted[sorted.length - 2];
          const curr = sorted[sorted.length - 1];
          const changePct = ((curr.close - prev.close) / prev.close) * 100;
          return {
            symbol,
            close: +curr.close.toFixed(4),
            open: +curr.open.toFixed(4),
            high: +curr.high.toFixed(4),
            low: +curr.low.toFixed(4),
            volume: curr.volume,
            prevClose: +prev.close.toFixed(4),
            changePercent: +changePct.toFixed(2),
            date: curr.date.split('T')[0],
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...chunkResults.filter(Boolean));
    if (i + CHUNK < STOCK_LIST.length) {
      await new Promise(r => setTimeout(r, 120)); // throttle
    }
  }

  return results
    .filter(s => s.changePercent <= -threshold)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 20);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/stocks/screener?threshold=10&date=YYYY-MM-DD
app.get('/api/stocks/screener', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 10;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const key = `screener:${threshold}:${date}`;
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const dropped = await fetchDroppedStocks(threshold, date);
    setCache(key, dropped);
    res.json(dropped);
  } catch (err) {
    console.error('Screener error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stocks/:symbol/history?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=1d
app.get('/api/stocks/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to, interval = '1d' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    const key = `history:${symbol}:${from}:${to}:${interval}`;
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const data = await fetchChart(symbol, from, to, interval);
    setCache(key, data);
    res.json(data);
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stocks/backtest
// body: { symbols?, startDate, endDate, threshold, initialCapital, positionSizePct }
app.post('/api/stocks/backtest', async (req, res) => {
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
    const symbolList = symbols?.length ? symbols : STOCK_LIST.slice(0, 50);
    let capital = initialCapital;
    const trades = [];

    // Pull a few extra days before startDate for the lookback
    const fromDate = new Date(startDate + 'T00:00:00Z');
    fromDate.setUTCDate(fromDate.getUTCDate() - 5);
    const fromStr = fromDate.toISOString().split('T')[0];

    // Fetch all daily bars in chunks
    const allData = {};
    const CHUNK = 10;
    for (let i = 0; i < symbolList.length; i += CHUNK) {
      const chunk = symbolList.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async sym => {
          try {
            const data = await fetchChart(sym, fromStr, endDate, '1d');
            return { sym, data };
          } catch {
            return { sym, data: [] };
          }
        })
      );
      for (const { sym, data } of results) {
        allData[sym] = [...data].sort((a, b) => a.date.localeCompare(b.date));
      }
      if (i + CHUNK < symbolList.length) await new Promise(r => setTimeout(r, 120));
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
app.get('/api/stocks/quote', async (req, res) => {
  try {
    const syms = (req.query.symbols || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!syms.length) return res.status(400).json({ error: 'symbols required' });
    const results = await Promise.all(syms.map(s => fetchQuote(s).catch(() => null)));
    res.json(results.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', tickers: STOCK_LIST.length }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
