import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

function VolumeChart({ data, height = 90 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;

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
      rightPriceScale: { borderColor: '#2d3148' },
      timeScale: { borderColor: '#2d3148', timeVisible: true },
    });

    chartRef.current = chart;

    const volSeries = chart.addHistogramSeries({
      color: '#6366f1',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    const volData = data
      .map(d => ({
        time: d.date.split('T')[0],
        value: d.volume,
        color: d.close >= d.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
      }))
      .filter(d => d.value);

    volSeries.setData(volData);
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

export default VolumeChart;
