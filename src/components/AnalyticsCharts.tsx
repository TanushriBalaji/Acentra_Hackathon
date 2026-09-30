import React from 'react';
import { MetricsState } from '../cache-engine/types';

interface AnalyticsChartsProps {
  metrics: MetricsState;
  history: Array<{ time: string; hitRate: number; requests: number }>;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ metrics, history }) => {
  const total = metrics.hits + metrics.misses;
  const hitAngle = total === 0 ? 0 : (metrics.hits / total) * 360;

  // Donut chart path calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const hitOffset = circumference - (metrics.hitRate / 100) * circumference;

  // Sparkline points for hit rate history
  const points = history.length > 1
    ? history.map((h, i) => {
        const x = (i / (history.length - 1)) * 280;
        const y = 80 - (h.hitRate / 100) * 70; // 10 to 80 range
        return `${x},${y}`;
      }).join(' ')
    : '0,40 280,40';

  const areaPoints = history.length > 1
    ? `0,80 ${points} 280,80`
    : '0,80 0,40 280,40 280,80';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Hit vs Miss Performance Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Read Traffic Distribution (Hits vs. Misses)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {metrics.totalRequests} Total Read Ops
          </span>
        </div>

        <div className="flex items-center justify-center gap-8 py-2">
          {/* Donut Chart */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle (Misses) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-rose-500"
                strokeWidth="12"
                fill="transparent"
              />
              {/* Hit segment */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-emerald-400 transition-all duration-500"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={hitOffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black font-mono text-emerald-400">
                {metrics.hitRate.toFixed(1)}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">
                Hit Ratio
              </span>
            </div>
          </div>

          {/* Legend and numerical breakdown */}
          <div className="space-y-3 font-mono text-xs flex-1">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Hits (Found)</span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold">{metrics.hits}</span>
                <span className="text-[10px] text-slate-500 ml-1.5">({metrics.hitRate.toFixed(1)}%)</span>
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-300">Misses (Not Found)</span>
              </div>
              <div className="text-right">
                <span className="text-rose-400 font-bold">{metrics.misses}</span>
                <span className="text-[10px] text-slate-500 ml-1.5">({metrics.missRate.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hit-Rate % Time-Series Sparkline Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Real-Time Hit Rate Efficiency Trend
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Live Stream
          </span>
        </div>

        <div className="py-1">
          <div className="h-28 w-full bg-slate-950 rounded-xl border border-slate-800 p-2 relative overflow-hidden flex flex-col justify-between">
            {/* Grid background lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
              <div className="border-b border-dashed border-slate-700 w-full text-[9px] font-mono text-slate-500">100%</div>
              <div className="border-b border-dashed border-slate-700 w-full text-[9px] font-mono text-slate-500">50%</div>
              <div className="border-b border-dashed border-slate-700 w-full text-[9px] font-mono text-slate-500">0%</div>
            </div>

            {/* SVG Sparkline Area */}
            <svg className="w-full h-full" viewBox="0 0 280 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hitRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon points={areaPoints} fill="url(#hitRateGrad)" />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>Historical Requests</span>
            <span className="text-emerald-400 font-bold">Latest: {metrics.hitRate.toFixed(1)}%</span>
            <span>Current Realtime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
