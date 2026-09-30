export type EvictionPolicyType = 'LRU' | 'LFU';

export interface CacheEntryState<K = string, V = string> {
  key: K;
  value: V;
  creationTimestamp: number;
  expirationTimestamp: number; // Infinity if none
  accessCount: number;
  lastAccessTimestamp: number;
  ttlRemainingMs?: number;
}

export interface MetricsState {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  totalRequests: number;
  hitRate: number;
  missRate: number;
}

export interface CacheEventLog {
  id: string;
  timestamp: string;
  type: 'HIT' | 'MISS' | 'PUT' | 'EVICT' | 'EXPIRE' | 'CLEAR' | 'POLICY' | 'CAPACITY';
  message: string;
  details?: string;
}

export interface UnitTestResult {
  id: string;
  suite: string;
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  durationMs: number;
  assertions: string[];
  errorMessage?: string;
}
