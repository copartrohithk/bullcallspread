import { useState, useEffect, useCallback } from 'react';
import { getScreener, getHistory } from '../api.js';
import CandlestickChart from './CandlestickChart.jsx';
import VolumeChart from './VolumeChart.jsx';

const INTERVALS = ['1d', '1h', '5m'];
const INTERVAL_LABELS = { '1d': 'Day', '1h': 'Hour', '5m': '5 Min' };

// ── Single stock card with expandable chart ────────────────────────────────────
function StockCard({ stock, startDate, endDate }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [interval, setIntervalVal] = useState('1d');
  const [error, setError] = useState('');

  const loadHistory = async (sym, from, to, iv) => {
    setLoading(true);
    setError('');
    try {
      const res = await getHistory(sym, from, to, iv);
      setHistory(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadHistory(stock.symbol, startDate, endDate, interval);
    setExpanded(v => !v);
  };

  const handleInterval = iv => {
    setIntervalVal(iv);
    loadHistory(stock.symbol, startDate, endDate, iv);
  };

  const isPositive = stock.changePercent >= 0;

  return (
    <div className={`stock-card ${expanded ? 'expanded' : ''}`}>
      <div onClick={handleToggle}>
        <div className="stock-header">
          <div>
            <div className="stock-symbol">{stock.symbol}</div>
            <div className="stock-meta">
              <span>Vol: {stock.volume ? (stock.volume / 1e6).toFixed(1) + 'M' : 'N/A'}</span>
              <span>Prev: ${stock.prevClose?.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stock-price">${stock.close?.toFixed(2)}</div>
            <div className={`stock-change ${isPositive ? 'change-positive' : 'change-negative'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(stock.changePercent)}%
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="chart-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <div className="interval-tabs">
              {INTERVALS.map(iv => (
                <button
                  key={iv}
                  className={`tab ${interval === iv ? 'active' : ''}`}
                  onClick={() => handleInterval(iv)}
                >
                  {INTERVAL_LABELS[iv]}
                </button>
              ))}
            </div>
          </div>
          {loading && (
            <div className="loading" style={{ padding: 24 }}>
              <div className="spinner" />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {!loading && !error && history?.length > 0 && (
            <>
              <CandlestickChart data={history} height={220} />
              <VolumeChart data={history} height={80} />
            </>
          )}
          {!loading && !error && history?.length === 0 && (
            <div className="empty" style={{ padding: 16 }}>No chart data available</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main screener component ────────────────────────────────────────────────────
function StockScreener({ threshold, screenerDate, searchSymbol, startDate, endDate }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchInterval, setSearchInterval] = useState('1d');

  const fetchScreener = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getScreener(threshold, screenerDate);
      setStocks(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [threshold, screenerDate]);

  const loadSearchHistory = useCallback(async (sym, iv) => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await getHistory(sym, startDate, endDate, iv);
      setSearchHistory({ symbol: sym, data: res.data });
    } catch (err) {
      setSearchError(err.response?.data?.error || err.message);
      setSearchHistory(null);
    } finally {
      setSearchLoading(false);
    }
  }, [startDate, endDate]);

  // Re-fetch when threshold or date changes
  useEffect(() => { fetchScreener(); }, [fetchScreener]);

  // Load search chart when symbol changes
  useEffect(() => {
    if (searchSymbol && searchSymbol.length >= 2) {
      loadSearchHistory(searchSymbol, searchInterval);
    } else {
      setSearchHistory(null);
    }
  }, [searchSymbol, searchInterval, loadSearchHistory]);

  const topStocks = stocks.slice(0, 5);
  const restStocks = stocks.slice(5);

  return (
    <div>
      {/* ── Search symbol panel ── */}
      {searchSymbol && searchSymbol.length >= 2 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">🔍 {searchSymbol}</div>
            <div className="interval-tabs">
              {INTERVALS.map(iv => (
                <button
                  key={iv}
                  className={`tab ${searchInterval === iv ? 'active' : ''}`}
                  onClick={() => setSearchInterval(iv)}
                >
                  {INTERVAL_LABELS[iv]}
                </button>
              ))}
            </div>
          </div>
          {searchLoading && (
            <div className="loading" style={{ padding: 24 }}>
              <div className="spinner" />
            </div>
          )}
          {searchError && <div className="error">{searchError}</div>}
          {!searchLoading && searchHistory?.data?.length > 0 && (
            <>
              <CandlestickChart data={searchHistory.data} height={240} />
              <VolumeChart data={searchHistory.data} height={80} />
            </>
          )}
        </div>
      )}

      {/* ── Screener header ── */}
      <div className="section-header">
        <div className="section-heading">
          📉 Stocks Down ≥ {threshold}% on {screenerDate}
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '6px 14px' }}
          onClick={fetchScreener}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>Scanning {150} stocks… this may take a minute</span>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {!loading && !error && stocks.length === 0 && (
        <div className="empty">
          No stocks found that dropped ≥ {threshold}% on {screenerDate}
        </div>
      )}

      {/* ── Top 5 cards ── */}
      {!loading && topStocks.length > 0 && (
        <>
          <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
            Top {topStocks.length} drops — click a card to expand the chart
          </div>
          <div className="stock-grid">
            {topStocks.map(stock => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                startDate={startDate}
                endDate={endDate}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Remaining stocks table ── */}
      {!loading && restStocks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">More Drops</div>
            <span className="badge">{restStocks.length} stocks</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Price</th>
                  <th>Change</th>
                  <th>Prev Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {restStocks.map(s => (
                  <tr key={s.symbol}>
                    <td><strong>{s.symbol}</strong></td>
                    <td>${s.close?.toFixed(2)}</td>
                    <td className="change-negative">{s.changePercent}%</td>
                    <td>${s.prevClose?.toFixed(2)}</td>
                    <td>{s.volume ? (s.volume / 1e6).toFixed(2) + 'M' : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockScreener;
