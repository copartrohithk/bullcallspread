function BacktestResults({ results, loading, error }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Running backtest… this may take a few minutes</span>
      </div>
    );
  }

  if (error) return <div className="error">❌ {error}</div>;

  if (!results) {
    return (
      <div className="empty">
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔬</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Backtest Run Yet</div>
        <div style={{ color: 'var(--text-muted)' }}>
          Configure your parameters in the sidebar and click &quot;Run Backtest&quot;
        </div>
      </div>
    );
  }

  const { trades, totalTrades, winners, winRate, totalReturn, totalPnL, finalCapital, initialCapital } = results;
  const isProfit = totalReturn >= 0;

  return (
    <div>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="section-heading">📊 Backtest Results</div>
        <span className="badge">{totalTrades} trades</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className={`stat-value ${isProfit ? 'change-positive' : 'change-negative'}`}>
            {isProfit ? '+' : ''}{totalReturn}%
          </div>
          <div className="stat-label">Total Return</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${totalPnL >= 0 ? 'change-positive' : 'change-negative'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
          </div>
          <div className="stat-label">Total P&amp;L</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{winRate}%</div>
          <div className="stat-label">Win Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalTrades}</div>
          <div className="stat-label">Total Trades</div>
        </div>
        <div className="stat-card">
          <div className="stat-value change-positive">{winners}</div>
          <div className="stat-label">Winners</div>
        </div>
        <div className="stat-card">
          <div className="stat-value change-negative">{totalTrades - winners}</div>
          <div className="stat-label">Losers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${finalCapital?.toLocaleString()}</div>
          <div className="stat-label">Final Capital</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${initialCapital?.toLocaleString()}</div>
          <div className="stat-label">Initial Capital</div>
        </div>
      </div>

      {trades?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Trade Log</div>
            <span className="badge">{trades.length} trades</span>
          </div>
          <div className="table-wrapper" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Drop Date</th>
                  <th>Drop %</th>
                  <th>Buy Date</th>
                  <th>Buy Price</th>
                  <th>Sell Price</th>
                  <th>Return %</th>
                  <th>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i}>
                    <td><strong>{t.symbol}</strong></td>
                    <td>{t.dropDate}</td>
                    <td className="change-negative">{t.dropPercent}%</td>
                    <td>{t.buyDate}</td>
                    <td>${t.buyPrice}</td>
                    <td>${t.sellPrice}</td>
                    <td className={t.returnPercent >= 0 ? 'change-positive' : 'change-negative'}>
                      {t.returnPercent >= 0 ? '+' : ''}{t.returnPercent}%
                    </td>
                    <td className={t.pnl >= 0 ? 'change-positive' : 'change-negative'}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl}
                    </td>
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

export default BacktestResults;
