import { useState } from 'react';
import Controls from './components/Controls.jsx';
import StockScreener from './components/StockScreener.jsx';
import BacktestResults from './components/BacktestResults.jsx';
import { runBacktest } from './api.js';

function App() {
  // Use static data date range: 2025-12-10 to 2026-03-06
  // Set default screener date to last trading day in data (2026-03-06)
  const defaultScreenerDate = '2026-03-06';
  const defaultStartDate = '2026-02-06';
  const defaultEndDate = '2026-03-06';

  const [activeTab, setActiveTab] = useState('screener');
  const [threshold, setThreshold] = useState(1); // Default to 1% for more results
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [screenerDate, setScreenerDate] = useState(defaultScreenerDate);
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
