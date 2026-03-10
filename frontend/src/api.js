import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 90000,
});

export const getScreener = (threshold = 10, date) => {
  const params = { threshold };
  if (date) params.date = date;
  return api.get('/stocks/screener', { params });
};

export const getHistory = (symbol, from, to, interval = '1d') =>
  api.get(`/stocks/${encodeURIComponent(symbol)}/history`, {
    params: { from, to, interval },
  });

export const runBacktest = body => api.post('/stocks/backtest', body);

export const getQuote = symbols =>
  api.get('/stocks/quote', { params: { symbols: symbols.join(',') } });

export default api;
