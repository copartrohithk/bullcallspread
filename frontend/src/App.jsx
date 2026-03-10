import { useState } from 'react';
import Controls from './components/Controls.jsx';
import StockScreener from './components/StockScreener.jsx';
import BacktestResults from './components/BacktestResults.jsx';
import { runBacktest } from './api.js';

function App() {
  const today = new Date().toISOString().split('T')[0];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)
    .toISOString()
    .split('T')[0];

  const [activeTab, setActiveTab] = useState('screener');
  const [threshold, setThreshold] = useState(10);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [screenerDate, setScreenerDate] = useState(today);
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState('');

  const handleBacktest = async () => {
    setBacktestLoading(true);
    setBacktestError('');
    setBacktestResults(null);
    setActiveTab('backtest');
    try {
      const res = await runBacktest({ startDate, endDate, threshold, initialCapital: 10000 });
      setBacktestResults(res.data);
    } catch (err) {
      setBacktestError(err.response?.data?.error || err.message);
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <span className="header-logo">📈 BullCallSpread</span>
        <span className="header-subtitle">Stock Drop Backtester</span>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <Controls
            threshold={threshold}
            setThreshold={setThreshold}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            searchSymbol={searchSymbol}
            setSearchSymbol={setSearchSymbol}
            screenerDate={screenerDate}
            setScreenerDate={setScreenerDate}
            onBacktest={handleBacktest}
            backtestLoading={backtestLoading}
          />
        </aside>
        <main className="main-content">
          <div className="tabs-row">
            <button
              className={`main-tab ${activeTab === 'screener' ? 'active' : ''}`}
              onClick={() => setActiveTab('screener')}
            >
              📊 Stock Screener
            </button>
            <button
              className={`main-tab ${activeTab === 'backtest' ? 'active' : ''}`}
              onClick={() => setActiveTab('backtest')}
            >
              🔬 Backtest Results
            </button>
          </div>

          {activeTab === 'screener' && (
            <StockScreener
              threshold={threshold}
              screenerDate={screenerDate}
              searchSymbol={searchSymbol}
              startDate={startDate}
              endDate={endDate}
            />
          )}

          {activeTab === 'backtest' && (
            <BacktestResults
              results={backtestResults}
              loading={backtestLoading}
              error={backtestError}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
