export interface CacheConfigRequestDto {
  capacity: number;
  policy: 'LRU' | 'LFU';
  defaultTtlInMillis?: number;
}

export interface CacheEntryRequestDto {
  value: string;
  ttlInMillis?: number;
}

export interface CacheEntryResponseDto {
  key: string;
  value: string;
  creationTime: number;
  expiryTime: number | null;
  accessCount: number;
  lastAccessTime: number;
  isExpired: boolean;
}

export interface CacheOperationResultDto {
  status: 'HIT' | 'MISS' | 'EXPIRED' | 'EVICTION' | 'STORED' | 'DELETED';
  key: string;
  value: string | null;
  metrics: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    totalRequests: number;
    hitRate: number;
    missRate: number;
    currentSize?: number;
    capacity?: number;
    policy?: string;
  };
}

export interface SamplePatternResponseDto {
  operationsRun: number;
  finalMetrics: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    totalRequests: number;
    hitRate: number;
    missRate: number;
    currentSize?: number;
    capacity?: number;
    policy?: string;
  };
  executionLogs: string[];
}

const BASE_URL = '/api/cache';

export const cacheApiClient = {
  async configure(config: CacheConfigRequestDto) {
    const res = await fetch(`${BASE_URL}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async put(key: string, value: string, ttlInMillis?: number): Promise<CacheOperationResultDto> {
    const res = await fetch(`${BASE_URL}/entries/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, ttlInMillis }),
    });
    return res.json();
  },

  async get(key: string): Promise<CacheOperationResultDto> {
    const res = await fetch(`${BASE_URL}/entries/${encodeURIComponent(key)}`);
    return res.json();
  },

  async delete(key: string): Promise<CacheOperationResultDto> {
    const res = await fetch(`${BASE_URL}/entries/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async clear(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${BASE_URL}/entries`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getEntries(): Promise<CacheEntryResponseDto[]> {
    const res = await fetch(`${BASE_URL}/entries`);
    return res.json();
  },

  async getMetrics() {
    const res = await fetch(`${BASE_URL}/metrics`);
    return res.json();
  },

  async runSamplePattern(): Promise<SamplePatternResponseDto> {
    const res = await fetch(`${BASE_URL}/sample-pattern`, {
      method: 'POST',
    });
    return res.json();
  },
};
