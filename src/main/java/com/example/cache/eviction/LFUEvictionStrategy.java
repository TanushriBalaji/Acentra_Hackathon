package com.example.cache.eviction;

import com.example.cache.model.CacheEntry;

import java.util.Map;

/**
 * Least Frequently Used (LFU) eviction strategy.
 * Selects the cache entry with the lowest access count for eviction.
 * When multiple entries share the identical lowest frequency, it utilizes
 * the entry's last access timestamp (LRU) as a deterministic tie-breaker.
 *
 * @param <K> key type
 * @param <V> value type
 */
public class LFUEvictionStrategy<K, V> implements EvictionStrategy<K, V> {

    @Override
    public void onGet(K key, CacheEntry<K, V> entry) {
        // Entry touch is handled atomically within CustomCache.get()
    }

    @Override
    public void onPut(K key, CacheEntry<K, V> entry) {
        // Entry initialization or update is handled atomically within CustomCache.put()
    }

    @Override
    public void onRemove(K key) {
        // No auxiliary state required beyond entries map and entry metadata
    }

    /**
     * Finds the key with minimal access count.
     * Ties are broken by finding the minimum lastAccessTimestamp (least recently used).
     *
     * @param entries the current active entries map
     * @return the candidate key, or null if map is empty
     */
    @Override
    public K selectEvictionCandidate(Map<K, CacheEntry<K, V>> entries) {
        if (entries == null || entries.isEmpty()) {
            return null;
        }

        K candidateKey = null;
        long minFrequency = Long.MAX_VALUE;
        long oldestAccessTime = Long.MAX_VALUE;
        long oldestCreationTime = Long.MAX_VALUE;

        for (Map.Entry<K, CacheEntry<K, V>> mapEntry : entries.entrySet()) {
            K key = mapEntry.getKey();
            CacheEntry<K, V> entry = mapEntry.getValue();

            if (entry == null) {
                continue;
            }

            long freq = entry.getAccessCount();
            long lastAccess = entry.getLastAccessTimestamp();
            long creationTime = entry.getCreationTimestamp();

            boolean isBetterCandidate = false;

            if (candidateKey == null) {
                isBetterCandidate = true;
            } else if (freq < minFrequency) {
                // Lower frequency wins immediately
                isBetterCandidate = true;
            } else if (freq == minFrequency) {
                // Tie-breaker 1: Least recently accessed
                if (lastAccess < oldestAccessTime) {
                    isBetterCandidate = true;
                } else if (lastAccess == oldestAccessTime) {
                    // Tie-breaker 2: Older creation timestamp
                    if (creationTime < oldestCreationTime) {
                        isBetterCandidate = true;
                    }
                }
            }

            if (isBetterCandidate) {
                candidateKey = key;
                minFrequency = freq;
                oldestAccessTime = lastAccess;
                oldestCreationTime = creationTime;
            }
        }

        return candidateKey;
    }

    @Override
    public void clear() {
        // Stateless strategy relying on entry metadata; no internal state to clear
    }
}
