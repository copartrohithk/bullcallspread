import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

function CandlestickChart({ data, height = 250 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1e2130' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#2d3148' },
        horzLines: { color: '#2d3148' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2d3148' },
      timeScale: { borderColor: '#2d3148', timeVisible: true },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    const candles = data
      .map(d => ({
        time: d.date.split('T')[0],
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      .filter(d => d.open && d.high && d.low && d.close);

    series.setData(candles);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}

export default CandlestickChart;
