import { CacheEntryState, EvictionPolicyType, MetricsState, CacheEventLog } from './types';

export class CacheSimulator {
  private capacity: number;
  private defaultTtlMs: number;
  private activePolicy: EvictionPolicyType;
  private storage: Map<string, CacheEntryState>;
  private lruAccessOrder: string[]; // tail = most recent
  private metrics: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
  };
  private eventLogs: CacheEventLog[];
  private onStateChange?: () => void;

  constructor(
    capacity = 5,
    policy: EvictionPolicyType = 'LRU',
    defaultTtlMs = 0,
    onStateChange?: () => void
  ) {
    this.capacity = capacity;
    this.activePolicy = policy;
    this.defaultTtlMs = defaultTtlMs;
    this.storage = new Map();
    this.lruAccessOrder = [];
    this.metrics = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
    this.eventLogs = [];
    this.onStateChange = onStateChange;

    this.log('POLICY', `Initialized CustomCache(capacity=${capacity}, policy=${policy}, defaultTtl=${defaultTtlMs}ms)`);
  }

  private log(type: CacheEventLog['type'], message: string, details?: string) {
    const logItem: CacheEventLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      type,
      message,
      details,
    };
    this.eventLogs.unshift(logItem);
    if (this.eventLogs.length > 100) {
      this.eventLogs.pop();
    }
  }

  public get(key: string): { value: string | null; status: 'HIT' | 'MISS' | 'EXPIRED' } {
    const entry = this.storage.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.log('MISS', `GET key="${key}" -> Not Found (MISS)`);
      this.notify();
      return { value: null, status: 'MISS' };
    }

    const now = Date.now();
    if (entry.expirationTimestamp !== Infinity && now >= entry.expirationTimestamp) {
      // Expired entry
      this.storage.delete(key);
      this.removeFromLruOrder(key);
      this.metrics.expirations++;
      this.metrics.misses++;
      this.log('EXPIRE', `GET key="${key}" -> Expired at ${new Date(entry.expirationTimestamp).toISOString().substring(11, 23)} (EXPIRED -> MISS)`);
      this.notify();
      return { value: null, status: 'EXPIRED' };
    }

    // Hit
    entry.accessCount++;
    entry.lastAccessTimestamp = now;
    this.touchLru(key);
    this.metrics.hits++;
    this.log('HIT', `GET key="${key}" -> Hit: "${entry.value}" (accessCount=${entry.accessCount})`);
    this.notify();
    return { value: entry.value, status: 'HIT' };
  }

  public put(key: string, value: string, customTtlMs?: number): { evictedKey: string | null } {
    const now = Date.now();
    const effectiveTtl = (customTtlMs !== undefined && customTtlMs > 0)
      ? customTtlMs
      : (this.defaultTtlMs > 0 ? this.defaultTtlMs : 0);

    const existing = this.storage.get(key);
    if (existing) {
      existing.value = value;
      existing.expirationTimestamp = effectiveTtl > 0 ? now + effectiveTtl : Infinity;
      existing.accessCount++;
      existing.lastAccessTimestamp = now;
      this.touchLru(key);
      this.log('PUT', `PUT update key="${key}" with value="${value}" (TTL=${effectiveTtl ? effectiveTtl + 'ms' : 'none'})`);
      this.notify();
      return { evictedKey: null };
    }

    // Clean expired entries first
    this.sweepExpired();

    let evictedKey: string | null = null;
    if (this.storage.size >= this.capacity) {
      evictedKey = this.selectEvictionCandidate();
      if (evictedKey) {
        const evictedEntry = this.storage.get(evictedKey);
        this.storage.delete(evictedKey);
        this.removeFromLruOrder(evictedKey);
        this.metrics.evictions++;
        this.log('EVICT', `Evicted key="${evictedKey}" via ${this.activePolicy}`,
          evictedEntry ? `Stats: count=${evictedEntry.accessCount}, lastAccess=${new Date(evictedEntry.lastAccessTimestamp).toLocaleTimeString()}` : undefined
        );
      }
    }

    const newEntry: CacheEntryState = {
      key,
      value,
      creationTimestamp: now,
      expirationTimestamp: effectiveTtl > 0 ? now + effectiveTtl : Infinity,
      accessCount: 1,
      lastAccessTimestamp: now,
    };

    this.storage.set(key, newEntry);
    this.touchLru(key);
    this.log('PUT', `PUT insert key="${key}" value="${value}" (TTL=${effectiveTtl ? effectiveTtl + 'ms' : 'none'})`);
    this.notify();
    return { evictedKey };
  }

  public remove(key: string): boolean {
    const existed = this.storage.delete(key);
    if (existed) {
      this.removeFromLruOrder(key);
      this.log('PUT', `REMOVE key="${key}"`);
      this.notify();
    }
    return existed;
  }

  public clear(): void {
    this.storage.clear();
    this.lruAccessOrder = [];
    this.log('CLEAR', 'Cache cleared');
    this.notify();
  }

  public setEvictionPolicy(newPolicy: EvictionPolicyType): void {
    if (this.activePolicy === newPolicy) return;
    this.activePolicy = newPolicy;
    this.log('POLICY', `Switched eviction policy to ${newPolicy}`);
    this.notify();
  }

  public setCapacity(newCap: number): void {
    if (newCap <= 0) return;
    this.capacity = newCap;
    this.log('CAPACITY', `Adjusted capacity to ${newCap}`);
    this.sweepExpired();
    while (this.storage.size > this.capacity) {
      const candidate = this.selectEvictionCandidate();
      if (!candidate) break;
      this.storage.delete(candidate);
      this.removeFromLruOrder(candidate);
      this.metrics.evictions++;
      this.log('EVICT', `Capacity reduction evicted key="${candidate}"`);
    }
    this.notify();
  }

  public setDefaultTtl(ttlMs: number): void {
    this.defaultTtlMs = Math.max(0, ttlMs);
    this.notify();
  }

  public selectEvictionCandidate(): string | null {
    if (this.storage.size === 0) return null;

    if (this.activePolicy === 'LRU') {
      // The least recently used key is at the front of lruAccessOrder
      for (const k of this.lruAccessOrder) {
        if (this.storage.has(k)) {
          return k;
        }
      }
      // fallback
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.storage.entries()) {
        if (v.lastAccessTimestamp < oldestTime) {
          oldestTime = v.lastAccessTimestamp;
          oldestKey = k;
        }
      }
      return oldestKey || this.storage.keys().next().value || null;
    } else {
      // LFU with deterministic LRU tie-breaking
      let candidateKey: string | null = null;
      let minFreq = Infinity;
      let oldestLastAccess = Infinity;
      let oldestCreation = Infinity;

      for (const [k, v] of this.storage.entries()) {
        const freq = v.accessCount;
        const lastAccess = v.lastAccessTimestamp;
        const creation = v.creationTimestamp;

        let isBetter = false;
        if (candidateKey === null) {
          isBetter = true;
        } else if (freq < minFreq) {
          isBetter = true;
        } else if (freq === minFreq) {
          if (lastAccess < oldestLastAccess) {
            isBetter = true;
          } else if (lastAccess === oldestLastAccess) {
            if (creation < oldestCreation) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          candidateKey = k;
          minFreq = freq;
          oldestLastAccess = lastAccess;
          oldestCreation = creation;
        }
      }
      return candidateKey;
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    for (const [k, v] of this.storage.entries()) {
      if (v.expirationTimestamp !== Infinity && now >= v.expirationTimestamp) {
        expiredKeys.push(k);
      }
    }
    for (const k of expiredKeys) {
      this.storage.delete(k);
      this.removeFromLruOrder(k);
      this.metrics.expirations++;
      this.log('EXPIRE', `Lazy sweep evicted expired key="${k}"`);
    }
  }

  private touchLru(key: string): void {
    this.removeFromLruOrder(key);
    this.lruAccessOrder.push(key);
  }

  private removeFromLruOrder(key: string): void {
    const idx = this.lruAccessOrder.indexOf(key);
    if (idx !== -1) {
      this.lruAccessOrder.splice(idx, 1);
    }
  }

  public getEntries(): CacheEntryState[] {
    const now = Date.now();
    const list: CacheEntryState[] = [];
    for (const entry of this.storage.values()) {
      const remaining = entry.expirationTimestamp === Infinity
        ? undefined
        : Math.max(0, entry.expirationTimestamp - now);
      list.push({
        ...entry,
        ttlRemainingMs: remaining,
      });
    }
    return list;
  }

  public getMetrics(): MetricsState {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      expirations: this.metrics.expirations,
      totalRequests: total,
      hitRate: total === 0 ? 0 : (this.metrics.hits / total) * 100,
      missRate: total === 0 ? 0 : (this.metrics.misses / total) * 100,
    };
  }

  public resetMetrics(): void {
    this.metrics = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
    this.notify();
  }

  public getLogs(): CacheEventLog[] {
    return [...this.eventLogs];
  }

  public clearLogs(): void {
    this.eventLogs = [];
    this.notify();
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getPolicy(): EvictionPolicyType {
    return this.activePolicy;
  }

  public getDefaultTtl(): number {
    return this.defaultTtlMs;
  }

  private notify(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
