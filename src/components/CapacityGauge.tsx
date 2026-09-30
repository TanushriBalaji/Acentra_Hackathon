import React from 'react';

interface CapacityGaugeProps {
  currentSize: number;
  capacity: number;
  lastEvictionTime?: number;
}

export const CapacityGauge: React.FC<CapacityGaugeProps> = ({
  currentSize,
  capacity,
  lastEvictionTime = 0,
}) => {
  const percentage = Math.min(100, Math.round((currentSize / Math.max(1, capacity)) * 100));
  const isFull = currentSize >= capacity;
  const isRecentEviction = Date.now() - lastEvictionTime < 2500;

  // Arc gauge calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let gaugeColor = 'stroke-emerald-400 text-emerald-400';
  let badgeBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
  let statusText = 'Optimal Load';

  if (isRecentEviction) {
    gaugeColor = 'stroke-rose-500 text-rose-500';
    badgeBg = 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse';
    statusText = 'Eviction Triggered!';
  } else if (isFull) {
    gaugeColor = 'stroke-amber-400 text-amber-400';
    badgeBg = 'bg-amber-500/20 border-amber-500/30 text-amber-300';
    statusText = 'At Full Capacity (100%)';
  } else if (percentage > 70) {
    gaugeColor = 'stroke-orange-400 text-orange-400';
    badgeBg = 'bg-orange-500/15 border-orange-500/30 text-orange-300';
    statusText = 'Heavy Allocation';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow when eviction happens */}
      {isRecentEviction && (
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Memory Slot Capacity
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeBg}`}>
          {statusText}
        </span>
      </div>

      <div className="flex items-center justify-around gap-4 py-2">
        {/* Radial SVG Gauge */}
        <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-slate-800"
              strokeWidth="9"
              fill="transparent"
            />
            {/* Value stroke */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={`${gaugeColor} transition-all duration-500 ease-out`}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          {/* Inner Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black font-mono text-white tracking-tighter">
              {percentage}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {currentSize}/{capacity} slots
            </span>
          </div>
        </div>

        {/* Visual Slots Representation */}
        <div className="flex-1 space-y-2">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>In-Memory Blocks:</span>
            <span className="font-mono text-slate-200 font-bold">{capacity - currentSize} free</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: capacity }).map((_, i) => {
              const isOccupied = i < currentSize;
              return (
                <div
                  key={i}
                  className={`h-7 rounded-lg border transition-all flex items-center justify-center text-[10px] font-mono font-bold ${
                    isOccupied
                      ? 'bg-gradient-to-t from-orange-500 to-amber-400 border-amber-300/40 text-slate-950 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                  title={`Slot #${i + 1}: ${isOccupied ? 'Occupied' : 'Free'}`}
                >
                  #{i + 1}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {isFull
              ? 'Warning: Next write will trigger eviction candidate sweep.'
              : 'Zero lock contention on current allocation buffer.'}
          </p>
        </div>
      </div>
    </div>
  );
};
