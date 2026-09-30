import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react';
import { CacheSimulator } from '../cache-engine/simulator';

interface ScenarioStep {
  stepNumber: number;
  operation: 'CONFIG' | 'PUT' | 'GET';
  title: string;
  command: string;
  explanation: string;
  expectedResult: 'STORED' | 'HIT' | 'MISS' | 'EVICTION';
  candidateBefore?: string;
  evictedKey?: string;
  slots: Array<{ key: string; value: string; accessCount: number; isCandidate?: boolean; isNew?: boolean; isEvicted?: boolean }>;
  metricHits: number;
  metricMisses: number;
  metricEvictions: number;
}

const PREDEFINED_STEPS: ScenarioStep[] = [
  {
    stepNumber: 0,
    operation: 'CONFIG',
    title: 'Initialize Test Environment',
    command: 'CustomCache(capacity = 2, policy = LRU, ttl = 0)',
    explanation: 'Cache is allocated with maximum capacity of 2 slots and Least Recently Used (LRU) eviction.',
    expectedResult: 'STORED',
    slots: [],
    metricHits: 0,
    metricMisses: 0,
    metricEvictions: 0,
  },
  {
    stepNumber: 1,
    operation: 'PUT',
    title: 'Insert Key "A"',
    command: 'put("A", "Apple")',
    explanation: 'Key "A" is stored in slot #1. Current cache size: 1 of 2 slots.',
    expectedResult: 'STORED',
    slots: [{ key: 'A', value: 'Apple', accessCount: 1, isNew: true }],
    metricHits: 0,
    metricMisses: 0,
    metricEvictions: 0,
  },
  {
    stepNumber: 2,
    operation: 'PUT',
    title: 'Insert Key "B"',
    command: 'put("B", "Banana")',
    explanation: 'Key "B" is stored in slot #2. Cache is now 100% full. "A" is the oldest (LRU candidate).',
    expectedResult: 'STORED',
    candidateBefore: 'A',
    slots: [
      { key: 'A', value: 'Apple', accessCount: 1, isCandidate: true },
      { key: 'B', value: 'Banana', accessCount: 1, isNew: true },
    ],
    metricHits: 0,
    metricMisses: 0,
    metricEvictions: 0,
  },
  {
    stepNumber: 3,
    operation: 'GET',
    title: 'Access Key "A" (Cache Hit)',
    command: 'get("A")',
    explanation: 'Key "A" retrieved successfully (HIT). Order refreshed to [B, A]. Key "B" is now the LRU candidate!',
    expectedResult: 'HIT',
    candidateBefore: 'B',
    slots: [
      { key: 'B', value: 'Banana', accessCount: 1, isCandidate: true },
      { key: 'A', value: 'Apple', accessCount: 2, isNew: true },
    ],
    metricHits: 1,
    metricMisses: 0,
    metricEvictions: 0,
  },
  {
    stepNumber: 4,
    operation: 'PUT',
    title: 'Insert Key "C" (Triggers Eviction)',
    command: 'put("C", "Cat")',
    explanation: 'Cache was full! Strategy inspected LRU order [B, A] and evicted "B". "C" takes the free slot.',
    expectedResult: 'EVICTION',
    evictedKey: 'B',
    candidateBefore: 'A',
    slots: [
      { key: 'A', value: 'Apple', accessCount: 2, isCandidate: true },
      { key: 'C', value: 'Cat', accessCount: 1, isNew: true },
    ],
    metricHits: 1,
    metricMisses: 0,
    metricEvictions: 1,
  },
  {
    stepNumber: 5,
    operation: 'GET',
    title: 'Access Key "B" (Cache Miss)',
    command: 'get("B")',
    explanation: 'Key "B" is looked up, but returns null (MISS). Confirms "B" was evicted in step #4!',
    expectedResult: 'MISS',
    slots: [
      { key: 'A', value: 'Apple', accessCount: 2, isCandidate: true },
      { key: 'C', value: 'Cat', accessCount: 1 },
    ],
    metricHits: 1,
    metricMisses: 1,
    metricEvictions: 1,
  },
  {
    stepNumber: 6,
    operation: 'GET',
    title: 'Access Key "C" (Cache Hit)',
    command: 'get("C")',
    explanation: 'Key "C" is retrieved successfully (HIT). Order refreshed to [A, C]. Final hit rate: 66.7%.',
    expectedResult: 'HIT',
    slots: [
      { key: 'A', value: 'Apple', accessCount: 2, isCandidate: true },
      { key: 'C', value: 'Cat', accessCount: 2, isNew: true },
    ],
    metricHits: 2,
    metricMisses: 1,
    metricEvictions: 1,
  },
];

interface ScenarioRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToLiveCache: (sim: CacheSimulator) => void;
}

export const ScenarioRunnerModal: React.FC<ScenarioRunnerModalProps> = ({
  isOpen,
  onClose,
  onApplyToLiveCache,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(1800);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setTimeout(() => {
        if (currentStepIndex < PREDEFINED_STEPS.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, playbackSpeedMs);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, playbackSpeedMs]);

  if (!isOpen) return null;

  const currentStep = PREDEFINED_STEPS[currentStepIndex];

  const handleApplyState = () => {
    // Replay up to current step on a real simulator instance
    const sim = new CacheSimulator(2, 'LRU', 0);
    for (let i = 0; i <= currentStepIndex; i++) {
      const s = PREDEFINED_STEPS[i];
      if (s.operation === 'PUT') {
        const parts = s.command.match(/put\("([^"]+)", "([^"]+)"\)/);
        if (parts) sim.put(parts[1], parts[2]);
      } else if (s.operation === 'GET') {
        const parts = s.command.match(/get\("([^"]+)"\)/);
        if (parts) sim.get(parts[1]);
      }
    }
    onApplyToLiveCache(sim);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Predefined LRU Eviction Demonstration Scenario
              </h2>
              <p className="text-xs text-slate-400">
                Specification Flow: Capacity = 2 &bull; PUT A &rarr; PUT B &rarr; GET A &rarr; PUT C &rarr; GET B &rarr; GET C
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Interactive Playback Control Bar */}
        <div className="bg-slate-900/90 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? 'Pause' : 'Auto Play'}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIndex(0);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              title="Reset to Beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={currentStepIndex === 0}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIndex((prev) => Math.max(0, prev - 1));
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition disabled:opacity-40 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              disabled={currentStepIndex === PREDEFINED_STEPS.length - 1}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIndex((prev) => Math.min(PREDEFINED_STEPS.length - 1, prev + 1));
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition disabled:opacity-40 flex items-center gap-1"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {PREDEFINED_STEPS.map((s, idx) => (
              <button
                key={s.stepNumber}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex(idx);
                }}
                className={`w-7 h-7 rounded-full font-mono text-xs font-bold transition flex items-center justify-center ${
                  idx === currentStepIndex
                    ? 'bg-orange-500 text-white ring-2 ring-orange-500/40'
                    : idx < currentStepIndex
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {idx}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Speed:</span>
            <select
              value={playbackSpeedMs}
              onChange={(e) => setPlaybackSpeedMs(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none"
            >
              <option value="2500">Slow (2.5s)</option>
              <option value="1800">Normal (1.8s)</option>
              <option value="1000">Fast (1.0s)</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Active Step Hero Banner */}
          <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-inner space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
                Step #{currentStep.stepNumber} of 6 &bull; {currentStep.title}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  currentStep.expectedResult === 'HIT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : currentStep.expectedResult === 'MISS'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : currentStep.expectedResult === 'EVICTION'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                }`}
              >
                Result: {currentStep.expectedResult}
              </span>
            </div>

            <div className="bg-slate-900 rounded-xl p-3 font-mono text-sm text-emerald-300 border border-slate-800 flex items-center justify-between">
              <span>{currentStep.command}</span>
              {currentStep.evictedKey && (
                <span className="text-xs text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                  Evicted: &quot;{currentStep.evictedKey}&quot;
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {currentStep.explanation}
            </p>
          </div>

          {/* Live Simulated Slots View */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Memory State (Capacity = 2)</span>
              <span className="font-mono text-slate-500">
                {currentStep.slots.length} / 2 Slots Occupied
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, slotIdx) => {
                const item = currentStep.slots[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`rounded-2xl p-4 border transition-all ${
                      item
                        ? item.isCandidate
                          ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/40'
                          : 'bg-slate-950 border-slate-800'
                        : 'bg-slate-950/40 border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs'
                    }`}
                  >
                    {item ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-bold text-orange-300">
                            Key: &quot;{item.key}&quot;
                          </span>
                          {item.isCandidate && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                              LRU CANDIDATE
                            </span>
                          )}
                          {item.isNew && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              UPDATED / HIT
                            </span>
                          )}
                        </div>
                        <div className="bg-slate-900 rounded p-2 text-xs font-mono text-slate-200">
                          Value: {item.value}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                          <span>Access Count: {item.accessCount}</span>
                          <span>Slot #{slotIdx + 1}</span>
                        </div>
                      </div>
                    ) : (
                      <span>[ Empty Slot #{slotIdx + 1} ]</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metric Deltas */}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Cumulative Hits</span>
              <span className="text-emerald-400 font-bold text-lg">{currentStep.metricHits}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Cumulative Misses</span>
              <span className="text-rose-400 font-bold text-lg">{currentStep.metricMisses}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Evictions</span>
              <span className="text-amber-400 font-bold text-lg">{currentStep.metricEvictions}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={handleApplyState}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 transition flex items-center gap-1.5"
          >
            Apply Scenario State to Live Cache
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
