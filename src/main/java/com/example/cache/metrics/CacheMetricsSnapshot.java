package com.example.cache.metrics;

/**
 * Immutable snapshot DTO representing cache metrics at a specific point in time.
 */
public record CacheMetricsSnapshot(
        long hits,
        long misses,
        long evictions,
        long expirations,
        long totalRequests,
        double hitRate,
        double missRate
) {
    @Override
    public String toString() {
        return String.format(
                "CacheMetricsSnapshot[hits=%d, misses=%d, evictions=%d, expirations=%d, requests=%d, hitRate=%.2f%%, missRate=%.2f%%]",
                hits, misses, evictions, expirations, totalRequests, hitRate, missRate
        );
    }
}
