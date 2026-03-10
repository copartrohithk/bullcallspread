const THRESHOLD_OPTIONS = [2, 5, 10, 15];

function Controls({
  threshold, setThreshold,
  startDate, setStartDate,
  endDate, setEndDate,
  searchSymbol, setSearchSymbol,
  screenerDate, setScreenerDate,
  onBacktest, backtestLoading,
}) {
  return (
    <>
      <div className="control-group">
        <div className="section-title">Stock Screener</div>
        <label className="label">Screener Date</label>
        <input
          type="date"
          className="input"
          value={screenerDate}
          onChange={e => setScreenerDate(e.target.value)}
        />
        <label className="label">Search Symbol</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. AAPL"
          value={searchSymbol}
          onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
        />
      </div>

      <hr className="divider" />

      <div className="control-group">
        <div className="section-title">Drop Threshold</div>
        <div className="threshold-pills">
          {THRESHOLD_OPTIONS.map(t => (
            <button
              key={t}
              className={`pill ${threshold === t ? 'active' : ''}`}
              onClick={() => setThreshold(t)}
            >
              {t}%
            </button>
          ))}
        </div>
        <label className="label" style={{ marginTop: 6 }}>Custom %</label>
        <input
          type="number"
          className="input"
          placeholder="e.g. 7"
          min="0.1"
          max="100"
          step="0.1"
          value={THRESHOLD_OPTIONS.includes(threshold) ? '' : threshold}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) setThreshold(v);
          }}
        />
      </div>

      <hr className="divider" />

      <div className="control-group">
        <div className="section-title">Backtest Range</div>
        <label className="label">Start Date</label>
        <input
          type="date"
          className="input"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <label className="label">End Date</label>
        <input
          type="date"
          className="input"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={onBacktest}
        disabled={backtestLoading}
      >
        {backtestLoading ? '⏳ Running...' : '🔬 Run Backtest'}
      </button>
    </>
  );
}

export default Controls;
