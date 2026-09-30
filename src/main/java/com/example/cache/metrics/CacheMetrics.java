package com.example.cache.metrics;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe collector for cache operational metrics using AtomicLong counters.
 * Tracks cache hits, misses, evictions, and expirations, and calculates rates.
 */
public class CacheMetrics {

    private final AtomicLong hits = new AtomicLong(0L);
    private final AtomicLong misses = new AtomicLong(0L);
    private final AtomicLong evictions = new AtomicLong(0L);
    private final AtomicLong expirations = new AtomicLong(0L);

    /**
     * Increments the hit counter by 1.
     */
    public void recordHit() {
        hits.incrementAndGet();
    }

    /**
     * Increments the miss counter by 1.
     */
    public void recordMiss() {
        misses.incrementAndGet();
    }

    /**
     * Increments the eviction counter by 1.
     */
    public void recordEviction() {
        evictions.incrementAndGet();
    }

    /**
     * Increments the expiration counter by 1.
     */
    public void recordExpiration() {
        expirations.incrementAndGet();
    }

    public long getHits() {
        return hits.get();
    }

    public long getMisses() {
        return misses.get();
    }

    public long getEvictions() {
        return evictions.get();
    }

    public long getExpirations() {
        return expirations.get();
    }

    /**
     * Returns total read requests (hits + misses).
     */
    public long getTotalRequests() {
        return hits.get() + misses.get();
    }

    /**
     * Computes the hit rate as a percentage: (hits / totalRequests) * 100.
     * Returns 0.0 if no requests have been recorded yet.
     */
    public double getHitRate() {
        long h = hits.get();
        long m = misses.get();
        long total = h + m;
        if (total == 0L) {
            return 0.0;
        }
        return ((double) h / total) * 100.0;
    }

    /**
     * Computes the miss rate as a percentage: (misses / totalRequests) * 100.
     * Returns 0.0 if no requests have been recorded yet.
     */
    public double getMissRate() {
        long h = hits.get();
        long m = misses.get();
        long total = h + m;
        if (total == 0L) {
            return 0.0;
        }
        return ((double) m / total) * 100.0;
    }

    /**
     * Creates an immutable snapshot DTO of the current metrics.
     *
     * @return snapshot DTO
     */
    public CacheMetricsSnapshot snapshot() {
        long h = hits.get();
        long m = misses.get();
        long e = evictions.get();
        long exp = expirations.get();
        long total = h + m;
        double hitPct = total == 0L ? 0.0 : ((double) h / total) * 100.0;
        double missPct = total == 0L ? 0.0 : ((double) m / total) * 100.0;

        return new CacheMetricsSnapshot(h, m, e, exp, total, hitPct, missPct);
    }

    /**
     * Resets all metric counters to zero.
     */
    public void reset() {
        hits.set(0L);
        misses.set(0L);
        evictions.set(0L);
        expirations.set(0L);
    }

    @Override
    public String toString() {
        return snapshot().toString();
    }
}
