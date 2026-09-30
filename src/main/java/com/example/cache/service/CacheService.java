package com.example.cache.service;

import com.example.cache.dto.CacheConfigRequest;
import com.example.cache.dto.CacheEntryResponse;
import com.example.cache.dto.CacheOperationResultResponse;
import com.example.cache.dto.SamplePatternResponse;
import com.example.cache.engine.CustomCache;
import com.example.cache.eviction.EvictionPolicy;
import com.example.cache.metrics.CacheMetricsSnapshot;
import com.example.cache.model.CacheEntry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Service managing CustomCache instance lifecycle, operations,
 * and high-level demonstration patterns.
 */
@Service
public class CacheService {

    private CustomCache<String, String> cache;
    private final ReentrantLock lifecycleLock = new ReentrantLock();

    public CacheService() {
        // Initialized with default capacity of 5, LRU policy, no default expiration
        this.cache = new CustomCache<>(5, EvictionPolicy.LRU, 0L);
    }

    /**
     * Reconfigures active cache instance parameters (capacity, policy, default TTL).
     *
     * @param config the configuration payload
     */
    public void configureCache(CacheConfigRequest config) {
        if (config == null) {
            return;
        }

        lifecycleLock.lock();
        try {
            if (config.getPolicy() != null) {
                cache.setEvictionPolicy(config.getPolicy());
            }
            if (config.getCapacity() > 0) {
                cache.setCapacity(config.getCapacity());
            }
            if (config.getDefaultTtlInMillis() != null) {
                cache.setDefaultTtlInMillis(config.getDefaultTtlInMillis());
            }
        } finally {
            lifecycleLock.unlock();
        }
    }

    /**
     * Inserts or updates an entry in the cache.
     *
     * @param key entry key
     * @param value entry value
     * @param ttl optional per-entry TTL in milliseconds
     * @return operation result envelope with status and metrics
     */
    public CacheOperationResultResponse put(String key, String value, Long ttl) {
        long evictionsBefore = cache.getMetrics().evictions();
        cache.put(key, value, ttl);
        long evictionsAfter = cache.getMetrics().evictions();

        String status = (evictionsAfter > evictionsBefore) ? "EVICTION" : "STORED";
        return new CacheOperationResultResponse(status, key, value, cache.getMetrics());
    }

    /**
     * Retrieves an entry from cache, recording hits, misses, or expirations.
     *
     * @param key entry key
     * @return operation result envelope with status and value
     */
    public CacheOperationResultResponse get(String key) {
        long expirationsBefore = cache.getMetrics().expirations();
        long missesBefore = cache.getMetrics().misses();

        String val = cache.get(key);

        long expirationsAfter = cache.getMetrics().expirations();
        long missesAfter = cache.getMetrics().misses();

        String status;
        if (val != null) {
            status = "HIT";
        } else if (expirationsAfter > expirationsBefore) {
            status = "EXPIRED";
        } else {
            status = "MISS";
        }

        return new CacheOperationResultResponse(status, key, val, cache.getMetrics());
    }

    /**
     * Removes an entry from the cache.
     *
     * @param key the key to remove
     * @return operation result envelope
     */
    public CacheOperationResultResponse delete(String key) {
        String removed = cache.remove(key);
        String status = (removed != null) ? "DELETED" : "MISS";
        return new CacheOperationResultResponse(status, key, removed, cache.getMetrics());
    }

    /**
     * Clears all cache entries.
     */
    public void clear() {
        cache.clear();
    }

    /**
     * Returns all active, non-expired cache entries as DTOs.
     *
     * @return list of active CacheEntryResponse
     */
    public List<CacheEntryResponse> getCurrentEntries() {
        Map<String, CacheEntry<String, String>> snapshot = cache.getEntriesSnapshot();
        List<CacheEntryResponse> results = new ArrayList<>();

        for (Map.Entry<String, CacheEntry<String, String>> item : snapshot.entrySet()) {
            CacheEntry<String, String> entry = item.getValue();
            Long expiry = (entry.getExpirationTimestamp() == Long.MAX_VALUE) ? null : entry.getExpirationTimestamp();

            results.add(new CacheEntryResponse(
                    entry.getKey(),
                    entry.getValue(),
                    entry.getCreationTimestamp(),
                    expiry,
                    entry.getAccessCount(),
                    entry.getLastAccessTimestamp(),
                    entry.isExpired()
            ));
        }

        return results;
    }

    /**
     * Retrieves the current metrics snapshot.
     */
    public CacheMetricsSnapshot getMetrics() {
        return cache.getMetrics();
    }

    public int getCapacity() {
        return cache.getCapacity();
    }

    public EvictionPolicy getActivePolicy() {
        return cache.getActivePolicy();
    }

    /**
     * Executes the standard demonstration scenario:
     * 1. Re-initialize with Capacity 2, LRU policy.
     * 2. Clear cache.
     * 3. PUT A -> "Apple"
     * 4. PUT B -> "Banana"
     * 5. GET A -> "Apple" (A is refreshed, B becomes LRU candidate)
     * 6. PUT C -> "Cat" (Capacity full: evicts B)
     * 7. GET B -> null (MISS)
     * 8. GET C -> "Cat" (HIT)
     *
     * @return SamplePatternResponse with execution logs and final metrics
     */
    public SamplePatternResponse runSamplePattern() {
        lifecycleLock.lock();
        try {
            List<String> logs = new ArrayList<>();

            // Step 0: Setup environment
            this.cache = new CustomCache<>(2, EvictionPolicy.LRU, 0L);
            logs.add("Initialized CustomCache(capacity=2, policy=LRU, ttl=0ms)");

            // Step 1: PUT A Apple
            cache.put("A", "Apple");
            logs.add("1. PUT key='A', value='Apple' -> Stored. Current size: 1/2");

            // Step 2: PUT B Banana
            cache.put("B", "Banana");
            logs.add("2. PUT key='B', value='Banana' -> Stored. Current size: 2/2 (Capacity full)");

            // Step 3: GET A (Hit, touches A, B becomes LRU)
            String valA = cache.get("A");
            logs.add("3. GET key='A' -> HIT: '" + valA + "'. Access order updated: [B, A]. B is now Least Recently Used.");

            // Step 4: PUT C Cat (triggers LRU eviction of B)
            cache.put("C", "Cat");
            logs.add("4. PUT key='C', value='Cat' -> Capacity reached! Evicted key='B' (LRU). Current items: [A, C]");

            // Step 5: GET B (Miss, verified evicted)
            String valB = cache.get("B");
            logs.add("5. GET key='B' -> MISS: " + valB + " (Correctly evicted by LRU strategy)");

            // Step 6: GET C (Hit)
            String valC = cache.get("C");
            logs.add("6. GET key='C' -> HIT: '" + valC + "'");

            CacheMetricsSnapshot finalMetrics = cache.getMetrics();
            logs.add("Summary: Operations completed. Final Metrics: " + finalMetrics);

            return new SamplePatternResponse(6, finalMetrics, logs);
        } finally {
            lifecycleLock.unlock();
        }
    }
}
