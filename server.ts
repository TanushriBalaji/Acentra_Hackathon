import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Cache Core for the backend service
interface BackendCacheEntry {
  key: string;
  value: string;
  creationTimestamp: number;
  expirationTimestamp: number;
  accessCount: number;
  lastAccessTimestamp: number;
}

class BackendCacheService {
  private capacity = 5;
  private policy: 'LRU' | 'LFU' = 'LRU';
  private defaultTtl = 0;
  private storage = new Map<string, BackendCacheEntry>();
  private lruOrder: string[] = [];
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  public configure(cap?: number, pol?: 'LRU' | 'LFU', ttl?: number) {
    if (pol) this.policy = pol;
    if (ttl !== undefined) this.defaultTtl = Math.max(0, ttl);
    if (cap && cap > 0) {
      this.capacity = cap;
      this.sweepExpired();
      while (this.storage.size > this.capacity) {
        const candidate = this.selectCandidate();
        if (!candidate) break;
        this.storage.delete(candidate);
        this.removeFromLru(candidate);
        this.metrics.evictions++;
      }
    }
  }

  public put(key: string, value: string, customTtl?: number): { status: string; key: string; value: string } {
    const now = Date.now();
    const effectiveTtl = (customTtl !== undefined && customTtl > 0) ? customTtl : this.defaultTtl;
    const existing = this.storage.get(key);

    if (existing) {
      existing.value = value;
      existing.expirationTimestamp = effectiveTtl > 0 ? now + effectiveTtl : Infinity;
      existing.accessCount++;
      existing.lastAccessTimestamp = now;
      this.touchLru(key);
      return { status: 'STORED', key, value };
    }

    this.sweepExpired();

    let hadEviction = false;
    if (this.storage.size >= this.capacity) {
      const candidate = this.selectCandidate();
      if (candidate) {
        this.storage.delete(candidate);
        this.removeFromLru(candidate);
        this.metrics.evictions++;
        hadEviction = true;
      }
    }

    const newEntry: BackendCacheEntry = {
      key,
      value,
      creationTimestamp: now,
      expirationTimestamp: effectiveTtl > 0 ? now + effectiveTtl : Infinity,
      accessCount: 1,
      lastAccessTimestamp: now,
    };

    this.storage.set(key, newEntry);
    this.touchLru(key);

    return {
      status: hadEviction ? 'EVICTION' : 'STORED',
      key,
      value,
    };
  }

  public get(key: string): { status: 'HIT' | 'MISS' | 'EXPIRED'; key: string; value: string | null } {
    const entry = this.storage.get(key);
    if (!entry) {
      this.metrics.misses++;
      return { status: 'MISS', key, value: null };
    }

    const now = Date.now();
    if (entry.expirationTimestamp !== Infinity && now >= entry.expirationTimestamp) {
      this.storage.delete(key);
      this.removeFromLru(key);
      this.metrics.expirations++;
      this.metrics.misses++;
      return { status: 'EXPIRED', key, value: null };
    }

    entry.accessCount++;
    entry.lastAccessTimestamp = now;
    this.touchLru(key);
    this.metrics.hits++;
    return { status: 'HIT', key, value: entry.value };
  }

  public delete(key: string): { status: 'DELETED' | 'MISS'; key: string; value: string | null } {
    const entry = this.storage.get(key);
    if (entry) {
      this.storage.delete(key);
      this.removeFromLru(key);
      return { status: 'DELETED', key, value: entry.value };
    }
    return { status: 'MISS', key, value: null };
  }

  public clear() {
    this.storage.clear();
    this.lruOrder = [];
  }

  public getAllEntries() {
    const now = Date.now();
    const list = [];
    for (const entry of this.storage.values()) {
      const isExpired = entry.expirationTimestamp !== Infinity && now >= entry.expirationTimestamp;
      list.push({
        key: entry.key,
        value: entry.value,
        creationTime: entry.creationTimestamp,
        expiryTime: entry.expirationTimestamp === Infinity ? null : entry.expirationTimestamp,
        accessCount: entry.accessCount,
        lastAccessTime: entry.lastAccessTimestamp,
        isExpired,
      });
    }
    return list;
  }

  public getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      expirations: this.metrics.expirations,
      totalRequests: total,
      hitRate: total === 0 ? 0 : (this.metrics.hits / total) * 100,
      missRate: total === 0 ? 0 : (this.metrics.misses / total) * 100,
      currentSize: this.storage.size,
      capacity: this.capacity,
      policy: this.policy,
    };
  }

  public runSamplePattern() {
    const logs: string[] = [];
    this.clear();
    this.capacity = 2;
    this.policy = 'LRU';
    this.defaultTtl = 0;
    logs.push("Initialized CustomCache(capacity=2, policy=LRU, ttl=0ms)");

    this.put("A", "Apple");
    logs.push("1. PUT key='A', value='Apple' -> Stored. Current size: 1/2");

    this.put("B", "Banana");
    logs.push("2. PUT key='B', value='Banana' -> Stored. Current size: 2/2 (Capacity full)");

    const resA = this.get("A");
    logs.push(`3. GET key='A' -> HIT: '${resA.value}'. Access order updated: [B, A]. B is now Least Recently Used.`);

    this.put("C", "Cat");
    logs.push("4. PUT key='C', value='Cat' -> Capacity reached! Evicted key='B' (LRU). Current items: [A, C]");

    const resB = this.get("B");
    logs.push(`5. GET key='B' -> MISS: ${resB.value} (Correctly evicted by LRU strategy)`);

    const resC = this.get("C");
    logs.push(`6. GET key='C' -> HIT: '${resC.value}'`);

    const finalMetrics = this.getMetrics();
    logs.push(`Summary: Operations completed. Final Metrics: hits=${finalMetrics.hits}, misses=${finalMetrics.misses}, evictions=${finalMetrics.evictions}, hitRate=${finalMetrics.hitRate.toFixed(1)}%`);

    return {
      operationsRun: 6,
      finalMetrics,
      executionLogs: logs,
    };
  }

  private selectCandidate(): string | null {
    if (this.storage.size === 0) return null;
    if (this.policy === 'LRU') {
      for (const k of this.lruOrder) {
        if (this.storage.has(k)) return k;
      }
      return this.storage.keys().next().value || null;
    } else {
      let candidateKey: string | null = null;
      let minFreq = Infinity;
      let oldestAccess = Infinity;
      let oldestCreation = Infinity;

      for (const [k, v] of this.storage.entries()) {
        const freq = v.accessCount;
        const lastAccess = v.lastAccessTimestamp;
        const creation = v.creationTimestamp;

        let isBetter = false;
        if (candidateKey === null || freq < minFreq) {
          isBetter = true;
        } else if (freq === minFreq) {
          if (lastAccess < oldestAccess) {
            isBetter = true;
          } else if (lastAccess === oldestAccess && creation < oldestCreation) {
            isBetter = true;
          }
        }

        if (isBetter) {
          candidateKey = k;
          minFreq = freq;
          oldestAccess = lastAccess;
          oldestCreation = creation;
        }
      }
      return candidateKey;
    }
  }

  private sweepExpired() {
    const now = Date.now();
    for (const [k, v] of this.storage.entries()) {
      if (v.expirationTimestamp !== Infinity && now >= v.expirationTimestamp) {
        this.storage.delete(k);
        this.removeFromLru(k);
        this.metrics.expirations++;
      }
    }
  }

  private touchLru(key: string) {
    this.removeFromLru(key);
    this.lruOrder.push(key);
  }

  private removeFromLru(key: string) {
    const idx = this.lruOrder.indexOf(key);
    if (idx !== -1) {
      this.lruOrder.splice(idx, 1);
    }
  }
}

const cacheService = new BackendCacheService();

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS support
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // REST API Routes matching Spring Boot CacheController specification
  // 1. POST /api/cache/configure
  app.post('/api/cache/configure', (req: Request, res: Response) => {
    const { capacity, policy, defaultTtlInMillis } = req.body;
    cacheService.configure(capacity, policy, defaultTtlInMillis);
    const metrics = cacheService.getMetrics();
    res.json({
      status: 'SUCCESS',
      message: 'Cache configuration updated successfully',
      capacity: metrics.capacity,
      policy: metrics.policy,
    });
  });

  // 2. PUT /api/cache/entries/:key
  app.put('/api/cache/entries/:key', (req: Request, res: Response) => {
    const key = req.params.key;
    const { value, ttlInMillis } = req.body || {};
    const result = cacheService.put(key, value || '', ttlInMillis);
    res.json({
      status: result.status,
      key: result.key,
      value: result.value,
      metrics: cacheService.getMetrics(),
    });
  });

  // 3. GET /api/cache/entries/:key
  app.get('/api/cache/entries/:key', (req: Request, res: Response) => {
    const key = req.params.key;
    const result = cacheService.get(key);
    res.json({
      status: result.status,
      key: result.key,
      value: result.value,
      metrics: cacheService.getMetrics(),
    });
  });

  // 4. DELETE /api/cache/entries/:key
  app.delete('/api/cache/entries/:key', (req: Request, res: Response) => {
    const key = req.params.key;
    const result = cacheService.delete(key);
    res.json({
      status: result.status,
      key: result.key,
      value: result.value,
      metrics: cacheService.getMetrics(),
    });
  });

  // 5. DELETE /api/cache/entries
  app.delete('/api/cache/entries', (req: Request, res: Response) => {
    cacheService.clear();
    res.json({
      status: 'SUCCESS',
      message: 'Cache entries cleared successfully',
    });
  });

  // 6. GET /api/cache/entries
  app.get('/api/cache/entries', (req: Request, res: Response) => {
    const entries = cacheService.getAllEntries();
    res.json(entries);
  });

  // 7. GET /api/cache/metrics
  app.get('/api/cache/metrics', (req: Request, res: Response) => {
    const metrics = cacheService.getMetrics();
    res.json(metrics);
  });

  // 8. POST /api/cache/sample-pattern
  app.post('/api/cache/sample-pattern', (req: Request, res: Response) => {
    const response = cacheService.runSamplePattern();
    res.json(response);
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Custom Cache Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
