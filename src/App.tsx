import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Plus,
  Search,
  Trash2,
  ArrowUpDown,
  Zap,
  Cpu,
  Download,
  Copy,
  Check,
  Code2,
  FileCode,
  ShieldCheck,
  Terminal,
  BarChart3,
  Flame,
  Gauge,
  Send,
  Radio,
  FileJson,
  Braces,
  ListCollapse,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
  Sliders,
  AlertOctagon,
  Eye
} from 'lucide-react';
import { CacheSimulator } from './cache-engine/simulator';
import { CacheEntryState, EvictionPolicyType, MetricsState, CacheEventLog, UnitTestResult } from './cache-engine/types';
import { JAVA_FILES, JavaSourceFile } from './data/javaSourceFiles';
import { runJUnitTestSuite } from './cache-engine/testRunner';
import { cacheApiClient, SamplePatternResponseDto } from './api/cacheApi';
import { CapacityGauge } from './components/CapacityGauge';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { ScenarioRunnerModal } from './components/ScenarioRunnerModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'analytics' | 'swagger' | 'code' | 'tests'>('console');
  
  // Simulator configuration & state
  const [capacity, setCapacity] = useState<number>(5);
  const [policy, setPolicy] = useState<EvictionPolicyType>('LRU');
  const [defaultTtl, setDefaultTtl] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Form states
  const [putKey, setPutKey] = useState<string>('');
  const [putValue, setPutValue] = useState<string>('');
  const [putTtlPreset, setPutTtlPreset] = useState<string>('0');
  const [getKey, setGetKey] = useState<string>('');
  const [lastOpResult, setLastOpResult] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [recentTouchedKey, setRecentTouchedKey] = useState<string | null>(null);
  const [lastEvictionTimestamp, setLastEvictionTimestamp] = useState<number>(0);

  // Analytics history buffer (records periodic hit rate snapshots)
  const [metricHistory, setMetricHistory] = useState<Array<{ time: string; hitRate: number; requests: number }>>([
    { time: '0s', hitRate: 0, requests: 0 }
  ]);

  // Modal Scenario Runner state
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);

  // Clear confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Source code viewer state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<JavaSourceFile>(JAVA_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [codeSearchQuery, setCodeSearchQuery] = useState<string>('');

  // Unit test runner state
  const [testResults, setTestResults] = useState<UnitTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  // REST API Tester State
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('GET /api/cache/metrics');
  const [apiParamKey, setApiParamKey] = useState<string>('user:101');
  const [apiRequestBody, setApiRequestBody] = useState<string>('{\n  "value": "Alice",\n  "ttlInMillis": 5000\n}');
  const [apiResponse, setApiResponse] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    data: any;
  } | null>(null);
  const [isCallingApi, setIsCallingApi] = useState<boolean>(false);

  // Simulator instance ref
  const [, setTick] = useState<number>(0);
  const simulatorRef = useRef<CacheSimulator | null>(null);

  if (!simulatorRef.current) {
    simulatorRef.current = new CacheSimulator(capacity, policy, defaultTtl, () => {
      setTick((t) => t + 1);
    });
  }

  // Periodic interval to refresh TTL countdowns and record metrics history
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      if (simulatorRef.current) {
        const m = simulatorRef.current.getMetrics();
        setMetricHistory((prev) => {
          const next = [...prev, {
            time: new Date().toLocaleTimeString('en-US', { hour12: false }).substring(3, 8),
            hitRate: m.hitRate,
            requests: m.totalRequests,
          }];
          return next.slice(-20); // Keep last 20 snapshots
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sim = simulatorRef.current;
  const entries: CacheEntryState[] = sim.getEntries();
  const metrics: MetricsState = sim.getMetrics();
  const logs: CacheEventLog[] = sim.getLogs();
  const candidateKey = sim.selectEvictionCandidate();

  // Handlers
  const handlePut = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!putKey.trim()) return;
    const ttlMs = parseInt(putTtlPreset, 10);
    
    try {
      await cacheApiClient.put(putKey.trim(), putValue.trim() || `val_${Date.now() % 1000}`, ttlMs);
    } catch {}

    const result = sim.put(putKey.trim(), putValue.trim() || `val_${Date.now() % 1000}`, ttlMs);
    setRecentTouchedKey(putKey.trim());
    setTimeout(() => setRecentTouchedKey(null), 1500);

    if (result.evictedKey) {
      setLastEvictionTimestamp(Date.now());
      setLastOpResult({
        message: `PUT stored "${putKey.trim()}", but cache was full! Evicted "${result.evictedKey}" via ${policy}.`,
        type: 'warning'
      });
    } else {
      setLastOpResult({
        message: `Successfully PUT "${putKey.trim()}" into cache`,
        type: 'success'
      });
    }
    setPutKey('');
    setPutValue('');
  };

  const handleGet = async (keyToGet: string) => {
    if (!keyToGet.trim()) return;
    try {
      await cacheApiClient.get(keyToGet.trim());
    } catch {}

    const res = sim.get(keyToGet.trim());
    setRecentTouchedKey(keyToGet.trim());
    setTimeout(() => setRecentTouchedKey(null), 1500);

    if (res.status === 'HIT') {
      setLastOpResult({
        message: `HIT: key "${keyToGet}" = "${res.value}"`,
        type: 'success'
      });
    } else if (res.status === 'EXPIRED') {
      setLastOpResult({
        message: `EXPIRED: key "${keyToGet}" has passed its TTL and was purged!`,
        type: 'warning'
      });
    } else {
      setLastOpResult({
        message: `MISS: key "${keyToGet}" was not found in cache.`,
        type: 'error'
      });
    }
  };

  const handleRemove = async (k: string) => {
    try {
      await cacheApiClient.delete(k);
    } catch {}
    const removed = sim.remove(k);
    if (removed) {
      setLastOpResult({ message: `Removed key "${k}"`, type: 'success' });
    }
  };

  const handleClear = async () => {
    try {
      await cacheApiClient.clear();
    } catch {}
    sim.clear();
    setShowClearConfirm(false);
    setLastOpResult({ message: 'Cache completely cleared', type: 'warning' });
  };

  const handlePolicyChange = async (newPol: EvictionPolicyType) => {
    setPolicy(newPol);
    sim.setEvictionPolicy(newPol);
    try {
      await cacheApiClient.configure({ capacity, policy: newPol, defaultTtlInMillis: defaultTtl });
    } catch {}
    setLastOpResult({ message: `Switched eviction algorithm to ${newPol}`, type: 'success' });
  };

  const handleCapacityChange = async (newCap: number) => {
    const cap = Math.max(1, Math.min(20, newCap));
    setCapacity(cap);
    sim.setCapacity(cap);
    try {
      await cacheApiClient.configure({ capacity: cap, policy, defaultTtlInMillis: defaultTtl });
    } catch {}
  };

  // REST API Client Invocation Handler
  const handleExecuteApi = async () => {
    setIsCallingApi(true);
    const startTime = performance.now();
    try {
      let resData: any = null;
      let statusCode = 200;
      let statusText = 'OK';

      if (selectedEndpoint === 'GET /api/cache/metrics') {
        const resp = await fetch('/api/cache/metrics');
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
      } else if (selectedEndpoint === 'GET /api/cache/entries') {
        const resp = await fetch('/api/cache/entries');
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
      } else if (selectedEndpoint === 'GET /api/cache/entries/{key}') {
        const resp = await fetch(`/api/cache/entries/${encodeURIComponent(apiParamKey)}`);
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
      } else if (selectedEndpoint === 'PUT /api/cache/entries/{key}') {
        let parsed = {};
        try { parsed = JSON.parse(apiRequestBody); } catch {}
        const resp = await fetch(`/api/cache/entries/${encodeURIComponent(apiParamKey)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
        sim.put(apiParamKey, (parsed as any).value || '', (parsed as any).ttlInMillis);
      } else if (selectedEndpoint === 'DELETE /api/cache/entries/{key}') {
        const resp = await fetch(`/api/cache/entries/${encodeURIComponent(apiParamKey)}`, {
          method: 'DELETE',
        });
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
        sim.remove(apiParamKey);
      } else if (selectedEndpoint === 'DELETE /api/cache/entries') {
        const resp = await fetch('/api/cache/entries', { method: 'DELETE' });
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
        sim.clear();
      } else if (selectedEndpoint === 'POST /api/cache/configure') {
        let parsed = {};
        try { parsed = JSON.parse(apiRequestBody); } catch {}
        const resp = await fetch('/api/cache/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
        if ((parsed as any).capacity) setCapacity((parsed as any).capacity);
        if ((parsed as any).policy) setPolicy((parsed as any).policy);
      } else if (selectedEndpoint === 'POST /api/cache/sample-pattern') {
        const resp = await fetch('/api/cache/sample-pattern', { method: 'POST' });
        statusCode = resp.status;
        statusText = resp.statusText;
        resData = await resp.json();
      }

      const durationMs = Math.round(performance.now() - startTime);
      setApiResponse({
        status: statusCode,
        statusText,
        durationMs,
        data: resData,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      setApiResponse({
        status: 500,
        statusText: 'Internal Error',
        durationMs,
        data: { error: err.message || 'Network error' },
      });
    } finally {
      setIsCallingApi(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (file: JavaSourceFile) => {
    const element = document.createElement('a');
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(blob);
    element.download = file.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    const results = await runJUnitTestSuite((updated) => {
      setTestResults(updated);
    });
    setTestResults(results);
    setIsRunningTests(false);
  };

  // Filter Java source files
  const filteredJavaFiles = JAVA_FILES.filter((f) => {
    const matchesCat = selectedCategory === 'all'
      ? true
      : selectedCategory === 'dto' ? f.category === 'dto'
      : selectedCategory === 'service' ? f.category === 'service'
      : selectedCategory === 'controller' ? f.category === 'controller'
      : selectedCategory === 'core' ? ['model', 'eviction', 'engine', 'metrics'].includes(f.category)
      : ['test', 'config'].includes(f.category);

    const matchesSearch = codeSearchQuery.trim() === ''
      ? true
      : f.name.toLowerCase().includes(codeSearchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(codeSearchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  const passedTestsCount = testResults.filter((t) => t.status === 'passed').length;
  const totalTestsCount = testResults.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold text-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">Java Custom Cache Engine</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-mono font-medium border border-orange-500/30">
                  Module 3: Executive Dashboard &amp; Analytics
                </span>
              </div>
              <p className="text-xs text-slate-400">Thread-safe generic cache with LRU/LFU eviction, per-entry TTL, REST API &amp; Live Telemetry</p>
            </div>
          </div>

          {/* HUD Summary Badges */}
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
              <span className="text-slate-400">Policy:</span>
              <span className="text-orange-400 font-bold">{policy}</span>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
              <span className="text-slate-400">Memory:</span>
              <span className="text-emerald-400 font-bold">{entries.length}/{capacity}</span>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
              <span className="text-slate-400">Hit Rate:</span>
              <span className={`font-bold ${metrics.hitRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {metrics.hitRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Main Top Navigation Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'console'
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Live Console
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Analytics &amp; Charts
            </button>
            <button
              onClick={() => setActiveTab('swagger')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'swagger'
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              REST API Swagger
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'code'
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Java Source ({JAVA_FILES.length})
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'tests'
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              JUnit 5 Tests
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Banner Alert for Recent Operations */}
        {lastOpResult && (
          <div
            className={`p-3 rounded-xl border text-sm flex items-center justify-between transition-all ${
              lastOpResult.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : lastOpResult.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-black/30">
                {lastOpResult.type}
              </span>
              <span>{lastOpResult.message}</span>
            </div>
            <button
              onClick={() => setLastOpResult(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: DASHBOARD & LIVE CONSOLE */}
        {/* ========================================================================= */}
        {activeTab === 'console' && (
          <div className="space-y-6">
            {/* Top Row: Capacity Memory Gauge + Dynamic Telemetry Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dynamic Capacity Memory Gauge */}
              <CapacityGauge
                currentSize={entries.length}
                capacity={capacity}
                lastEvictionTime={lastEvictionTimestamp}
              />

              {/* Real-Time Telemetry KPI Cards */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Cache Hits
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono my-1">
                    {metrics.hits}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hit Rate: <span className="text-emerald-300 font-bold">{metrics.hitRate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Cache Misses
                  </div>
                  <div className="text-3xl font-extrabold text-rose-400 font-mono my-1">
                    {metrics.misses}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Miss Rate: <span className="text-rose-300 font-bold">{metrics.missRate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Evictions
                  </div>
                  <div className="text-3xl font-extrabold text-amber-400 font-mono my-1">
                    {metrics.evictions}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Policy: <span className="text-amber-300 font-bold">{policy}</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Expirations
                  </div>
                  <div className="text-3xl font-extrabold text-purple-400 font-mono my-1">
                    {metrics.expirations}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Lazy Sweep: <span className="text-purple-300 font-bold">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Operations Panel & Dynamic Policy Controller */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Operations Panel */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Cache Operations Engine
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsScenarioModalOpen(true)}
                      className="px-3 py-1 text-xs rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transition flex items-center gap-1.5 font-semibold shadow-md shadow-orange-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Run Predefined Scenario
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Cache
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PUT form */}
                  <form onSubmit={handlePut} className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-orange-400">PUT /api/cache/entries/&#123;key&#125;</span>
                      <span className="text-[10px] text-slate-500">Atomic Lock</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Key (e.g. user:101)"
                        value={putKey}
                        onChange={(e) => setPutKey(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Alice)"
                        value={putValue}
                        onChange={(e) => setPutValue(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">TTL:</span>
                      <select
                        value={putTtlPreset}
                        onChange={(e) => setPutTtlPreset(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none font-mono flex-1"
                      >
                        <option value="0">No Expiration (Infinite)</option>
                        <option value="3000">3 Seconds</option>
                        <option value="6000">6 Seconds</option>
                        <option value="15000">15 Seconds</option>
                        <option value="60000">60 Seconds</option>
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium rounded-lg text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        PUT
                      </button>
                    </div>
                  </form>

                  {/* GET form */}
                  <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-sky-400">GET /api/cache/entries/&#123;key&#125;</span>
                      <span className="text-[10px] text-slate-500">Touch &amp; Strategy</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Lookup key..."
                        value={getKey}
                        onChange={(e) => setGetKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGet(getKey)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleGet(getKey)}
                        className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs flex items-center gap-1 shadow-md shadow-sky-600/20 transition"
                      >
                        <Search className="w-3.5 h-3.5" />
                        GET
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span>Quick Keys:</span>
                      <div className="flex gap-1 flex-wrap">
                        {entries.slice(0, 4).map((en) => (
                          <button
                            key={en.key}
                            onClick={() => {
                              setGetKey(en.key);
                              handleGet(en.key);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px]"
                          >
                            {en.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cache Reconfiguration Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                    <Sliders className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Configuration Controls
                    </h2>
                  </div>

                  {/* Eviction Policy Switcher */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Eviction Policy</span>
                      <span className="text-[10px] text-orange-400 font-mono">Dynamic Switch</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePolicyChange('LRU')}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                          policy === 'LRU'
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span>LRU</span>
                          {policy === 'LRU' && <Check className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal">Least Recently Used</p>
                      </button>

                      <button
                        onClick={() => handlePolicyChange('LFU')}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                          policy === 'LFU'
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span>LFU</span>
                          {policy === 'LFU' && <Check className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal">Least Frequently Used</p>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Capacity Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Capacity Limit</span>
                      <span className="font-mono text-emerald-400 font-bold">{capacity} entries</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={capacity}
                      onChange={(e) => handleCapacityChange(parseInt(e.target.value, 10))}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between font-mono text-slate-300">
                    <span>Eviction Target:</span>
                    <span className="text-rose-400 font-bold">{candidateKey ? `"${candidateKey}"` : 'None (Room left)'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Cache State Inspector (Live Memory View) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    Live Memory View ({entries.length} of {capacity} items held)
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1 rounded ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                      title="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1 rounded ${viewMode === 'table' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
                      title="Table View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                    <Server className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium">In-Memory Cache is currently empty.</p>
                  <p className="text-xs text-slate-600">Click &quot;Run Predefined Scenario&quot; above to watch real-time eviction steps.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries.map((entry) => {
                    const isCandidate = entry.key === candidateKey && entries.length >= capacity;
                    const hasTtl = entry.expirationTimestamp !== Infinity;
                    const remainingMs = entry.ttlRemainingMs ?? 0;
                    const isExpired = hasTtl && remainingMs <= 0;
                    const isRecentTouch = entry.key === recentTouchedKey;

                    return (
                      <div
                        key={entry.key}
                        className={`relative rounded-2xl p-4 border transition-all duration-300 ${
                          isRecentTouch
                            ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-900/30 scale-[1.01]'
                            : isCandidate
                            ? 'bg-rose-950/20 border-rose-500/60 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {isCandidate && (
                          <div className="absolute -top-2.5 right-3 bg-rose-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                            NEXT TO EVICT ({policy})
                          </div>
                        )}
                        {isRecentTouch && !isCandidate && (
                          <div className="absolute -top-2.5 right-3 bg-emerald-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow animate-pulse">
                            ACCESSED
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="font-mono text-sm font-bold text-orange-300 truncate">
                            {entry.key}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleGet(entry.key)}
                              className="px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-mono border border-sky-500/20 transition"
                              title="Simulate GET (Touch)"
                            >
                              GET
                            </button>
                            <button
                              onClick={() => handleRemove(entry.key)}
                              className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                              title="Remove Key"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-900/90 rounded-lg p-2.5 font-mono text-xs text-slate-200 break-all mb-3 border border-slate-800/80">
                          {entry.value}
                        </div>

                        {/* Frequency & Recency Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                          <div>
                            <span className="text-slate-500">Access Count:</span>
                            <span className="ml-1 text-slate-200 font-bold">{entry.accessCount}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Recency:</span>
                            <span className="ml-1 text-slate-300">
                              {Math.max(0, Math.round((Date.now() - entry.lastAccessTimestamp) / 1000))}s ago
                            </span>
                          </div>
                        </div>

                        {/* TTL progress bar */}
                        {hasTtl && (
                          <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-rose-400" />
                                TTL Countdown:
                              </span>
                              <span className={isExpired ? 'text-rose-400 font-bold' : 'text-amber-300'}>
                                {isExpired ? 'EXPIRED' : `${(remainingMs / 1000).toFixed(1)}s`}
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  remainingMs < 2000
                                    ? 'bg-rose-500'
                                    : remainingMs < 5000
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, (remainingMs / 15000) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Key</th>
                        <th className="p-3">Value</th>
                        <th className="p-3">Access Count (LFU)</th>
                        <th className="p-3">Last Access (LRU)</th>
                        <th className="p-3">TTL Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {entries.map((en) => {
                        const isCandidate = en.key === candidateKey && entries.length >= capacity;
                        const hasTtl = en.expirationTimestamp !== Infinity;
                        const remainingMs = en.ttlRemainingMs ?? 0;
                        return (
                          <tr key={en.key} className={isCandidate ? 'bg-rose-950/20' : 'hover:bg-slate-950/50'}>
                            <td className="p-3 font-bold text-orange-400 flex items-center gap-1.5">
                              {en.key}
                              {isCandidate && (
                                <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-sans">
                                  CANDIDATE
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-300">{en.value}</td>
                            <td className="p-3 text-emerald-400 font-bold">{en.accessCount}</td>
                            <td className="p-3 text-slate-400">
                              {Math.max(0, Math.round((Date.now() - en.lastAccessTimestamp) / 1000))}s ago
                            </td>
                            <td className="p-3">
                              {hasTtl ? (
                                <span className="text-amber-400 font-bold">{(remainingMs / 1000).toFixed(1)}s left</span>
                              ) : (
                                <span className="text-slate-500">Infinite</span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-1">
                              <button
                                onClick={() => handleGet(en.key)}
                                className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                              >
                                GET
                              </button>
                              <button
                                onClick={() => handleRemove(en.key)}
                                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                              >
                                DEL
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Trail Terminal */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    Operation Audit Trail
                  </h2>
                </div>
                <button
                  onClick={() => sim.clearLogs()}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Clear Logs
                </button>
              </div>

              <div className="bg-slate-950 font-mono text-xs rounded-xl p-3 border border-slate-800 h-40 overflow-y-auto space-y-1.5">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-6">No operation events recorded yet.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          log.type === 'HIT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : log.type === 'MISS'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : log.type === 'EVICT'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : log.type === 'EXPIRE'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.type}
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                      {log.details && <span className="text-slate-500 italic text-[11px]">({log.details})</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: METRICS & ANALYTICS CHARTS */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Cache Performance &amp; Telemetry Analytics</h2>
                <p className="text-xs text-slate-400">
                  Visual hit vs. miss distribution and real-time hit-rate percentage trend charts
                </p>
              </div>
              <button
                onClick={() => {
                  sim.resetMetrics();
                  setMetricHistory([{ time: '0s', hitRate: 0, requests: 0 }]);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Telemetry Counters
              </button>
            </div>

            {/* SVG Visual Charts */}
            <AnalyticsCharts metrics={metrics} history={metricHistory} />

            {/* Performance Ratios Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-orange-400" />
                  Efficiency Metrics Engine
                </h3>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Total Read Invocations:</span>
                      <span className="text-white font-bold">{metrics.totalRequests}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Cache Hit Rate:</span>
                      <span className="text-emerald-400 font-bold">{metrics.hitRate.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Cache Miss Rate:</span>
                      <span className="text-rose-400 font-bold">{metrics.missRate.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400">Mathematical Calculation:</div>
                    <code className="text-xs font-mono text-emerald-300 block">
                      hitRate = total == 0 ? 0.0 : ((double) hits / total) * 100.0;
                    </code>
                    <code className="text-xs font-mono text-rose-300 block">
                      missRate = total == 0 ? 0.0 : ((double) misses / total) * 100.0;
                    </code>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Thread-Safety &amp; Invariants
                </h3>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-white">Atomic Invariant:</strong> <code className="text-orange-300 font-mono">hits + misses == totalRequests</code> holds at all times across concurrent requests.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-white">ReentrantLock Mutex:</strong> Encapsulates multi-step TTL checks, capacity evictions, and map rebalancing.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-white">Immutable Snapshot DTO:</strong> <code className="text-orange-300 font-mono">CacheMetricsSnapshot</code> guarantees point-in-time thread-safe reporting without blocking concurrent threads.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: REST API SWAGGER & ENDPOINTS VISUALIZER */}
        {/* ========================================================================= */}
        {activeTab === 'swagger' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-400" />
                  Spring Boot REST API Swagger Visualizer
                </h2>
                <p className="text-xs text-slate-400">
                  Direct interactive HTTP testing against <code className="text-orange-400 font-mono">CacheController</code> (`/api/cache/*`)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScenarioModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Run Predefined Scenario
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Endpoint Selector List */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2">
                  Available REST Endpoints
                </div>

                {[
                  { method: 'POST', path: '/api/cache/configure', label: 'POST /api/cache/configure', desc: 'Reconfigure capacity & policy' },
                  { method: 'PUT', path: '/api/cache/entries/{key}', label: 'PUT /api/cache/entries/{key}', desc: 'Insert or update entry with TTL' },
                  { method: 'GET', path: '/api/cache/entries/{key}', label: 'GET /api/cache/entries/{key}', desc: 'Get value & status (HIT/MISS/EXPIRED)' },
                  { method: 'DELETE', path: '/api/cache/entries/{key}', label: 'DELETE /api/cache/entries/{key}', desc: 'Delete specific entry' },
                  { method: 'DELETE', path: '/api/cache/entries', label: 'DELETE /api/cache/entries', desc: 'Clear entire cache' },
                  { method: 'GET', path: '/api/cache/entries', label: 'GET /api/cache/entries', desc: 'List all active cache entries' },
                  { method: 'GET', path: '/api/cache/metrics', label: 'GET /api/cache/metrics', desc: 'Retrieve telemetry & hit/miss rates' },
                  { method: 'POST', path: '/api/cache/sample-pattern', label: 'POST /api/cache/sample-pattern', desc: 'Run demonstration sequence' },
                ].map((ep) => {
                  const isSelected = selectedEndpoint === ep.label;
                  return (
                    <button
                      key={ep.label}
                      onClick={() => {
                        setSelectedEndpoint(ep.label);
                        if (ep.method === 'POST' && ep.path.includes('configure')) {
                          setApiRequestBody('{\n  "capacity": 5,\n  "policy": "LRU",\n  "defaultTtlInMillis": 0\n}');
                        } else if (ep.method === 'PUT') {
                          setApiRequestBody('{\n  "value": "Alice",\n  "ttlInMillis": 5000\n}');
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition border ${
                        isSelected
                          ? 'bg-orange-500/15 border-orange-500/50 text-white font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ep.method === 'GET'
                              ? 'bg-sky-500/20 text-sky-400'
                              : ep.method === 'POST'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : ep.method === 'PUT'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="truncate">{ep.path}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans font-normal truncate">
                        {ep.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Endpoint Request & Response Visualizer */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="font-mono text-xs font-bold text-orange-400">
                      {selectedEndpoint}
                    </div>
                    <button
                      onClick={handleExecuteApi}
                      disabled={isCallingApi}
                      className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition disabled:opacity-50"
                    >
                      {isCallingApi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send Request
                    </button>
                  </div>

                  {selectedEndpoint.includes('{key}') && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Path Parameter: <span className="font-mono text-orange-400">key</span>
                      </label>
                      <input
                        type="text"
                        value={apiParamKey}
                        onChange={(e) => setApiParamKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                        placeholder="e.g. user:101"
                      />
                    </div>
                  )}

                  {(selectedEndpoint.startsWith('POST') || selectedEndpoint.startsWith('PUT')) &&
                    !selectedEndpoint.includes('sample-pattern') && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>Request Body (JSON)</span>
                          <span className="text-[10px] text-slate-500 font-mono">application/json</span>
                        </label>
                        <textarea
                          rows={4}
                          value={apiRequestBody}
                          onChange={(e) => setApiRequestBody(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}
                </div>

                {/* HTTP Response Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      HTTP Response Output
                    </span>
                    {apiResponse && (
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            apiResponse.status >= 200 && apiResponse.status < 300
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {apiResponse.status} {apiResponse.statusText}
                        </span>
                        <span className="text-slate-500">{apiResponse.durationMs} ms</span>
                      </div>
                    )}
                  </div>

                  {apiResponse ? (
                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-80">
                      <pre>
                        <code>{JSON.stringify(apiResponse.data, null, 2)}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Select an endpoint above and click &quot;Send Request&quot; to test live.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: JAVA SOURCE CODE EXPLORER */}
        {/* ========================================================================= */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Production Java Source Files</h2>
                <p className="text-xs text-slate-400">
                  Standard Maven Project structure under package <code className="text-orange-400 font-mono">com.example.cache</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition flex items-center gap-1.5 border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy File'}
                </button>
                <button
                  onClick={() => handleDownloadFile(selectedFile)}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs text-white font-medium transition flex items-center gap-1.5 shadow-md shadow-orange-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .java
                </button>
              </div>
            </div>

            {/* Filter chips & Search bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'All Files' },
                  { id: 'core', label: 'Core & Engine' },
                  { id: 'dto', label: 'DTOs' },
                  { id: 'service', label: 'Service' },
                  { id: 'controller', label: 'Controller' },
                  { id: 'test', label: 'Tests & POM' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setSelectedCategory(chip.id)}
                    className={`px-3 py-1 rounded-lg border font-medium whitespace-nowrap transition ${
                      selectedCategory === chip.id
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter classes..."
                  value={codeSearchQuery}
                  onChange={(e) => setCodeSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* File Explorer Tree */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 flex items-center justify-between">
                  <span>Class Files</span>
                  <span className="font-mono text-[10px] text-slate-500">{filteredJavaFiles.length} files</span>
                </div>

                <div className="space-y-1">
                  {filteredJavaFiles.map((file) => {
                    const isSelected = selectedFile.path === file.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300 font-bold'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-orange-400' : 'text-slate-500'}`} />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <span className="text-[9px] uppercase font-sans px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {file.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code Viewer */}
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-orange-400 font-bold">{selectedFile.path}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{selectedFile.description}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                    Java 17 / Spring Boot 3
                  </span>
                </div>

                <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-[600px] leading-relaxed">
                  <pre className="tab-4">
                    <code>{selectedFile.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: JUNIT 5 TEST SUITE RUNNER */}
        {/* ========================================================================= */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">JUnit 5 &amp; Spring Boot Integration Tests</h2>
                <p className="text-xs text-slate-400">
                  Validates core cache algorithms, TTL expiration, concurrency, and MockMvc REST endpoints.
                </p>
              </div>
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                {isRunningTests ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run All JUnit 5 Tests
                  </>
                )}
              </button>
            </div>

            {testResults.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Tests Ready to Execute</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click &quot;Run All JUnit 5 Tests&quot; to execute all test cases with real assertion checks.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {passedTestsCount} of {totalTestsCount} Tests Passed
                      </div>
                      <div className="text-xs text-slate-400">
                        Total Execution Time:{' '}
                        {testResults.reduce((acc, curr) => acc + curr.durationMs, 0)} ms
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30 text-xs font-mono">
                    BUILD SUCCESS
                  </span>
                </div>

                <div className="space-y-3">
                  {testResults.map((test) => (
                    <div
                      key={test.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition hover:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {test.status === 'passed' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                          {test.status === 'failed' && (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          {test.status === 'running' && (
                            <RotateCcw className="w-4 h-4 text-amber-400 animate-spin" />
                          )}
                          <span className="font-mono text-xs font-bold text-white">
                            {test.name}()
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {test.suite}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {test.durationMs} ms
                        </span>
                      </div>

                      <div className="pl-6 space-y-1">
                        {test.assertions.map((assertion, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] font-mono text-slate-400 flex items-center gap-2"
                          >
                            <span className="text-emerald-500">✓</span>
                            <span>{assertion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Predefined Scenario Runner Modal */}
      <ScenarioRunnerModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
        onApplyToLiveCache={(scenarioSim) => {
          simulatorRef.current = scenarioSim;
          setCapacity(scenarioSim.getCapacity());
          setPolicy(scenarioSim.getPolicy());
          setLastOpResult({
            message: 'Scenario state successfully applied to live in-memory cache!',
            type: 'success'
          });
          setTick((t) => t + 1);
        }}
      />

      {/* Clear Cache Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Clear All Cache Entries?</h3>
                <p className="text-xs text-slate-400">This will purge all key-value mappings and reset eviction order.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        Module 3: React Dashboard &bull; Custom Cache Library with Live Metrics Panel &bull; Package <span className="font-mono text-slate-400">com.example.cache</span>
      </footer>
    </div>
  );
}
