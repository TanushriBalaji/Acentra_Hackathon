package com.example.cache.eviction;

import com.example.cache.model.CacheEntry;
import java.util.Map;

/**
 * Strategy interface defining eviction life-cycle hooks and candidate selection.
 * Implementations manage order and frequency tracking to select an entry to evict
 * when capacity is exceeded.
 *
 * @param <K> the key type
 * @param <V> the value type
 */
public interface EvictionStrategy<K, V> {

    /**
     * Hook triggered when a key is successfully retrieved.
     *
     * @param key the key accessed
     * @param entry the associated cache entry
     */
    void onGet(K key, CacheEntry<K, V> entry);

    /**
     * Hook triggered when an entry is inserted or updated.
     *
     * @param key the key inserted or updated
     * @param entry the associated cache entry
     */
    void onPut(K key, CacheEntry<K, V> entry);

    /**
     * Hook triggered when an entry is explicitly removed from cache.
     *
     * @param key the removed key
     */
    void onRemove(K key);

    /**
     * Identifies the optimal candidate key for eviction based on the active policy.
     *
     * @param entries the current active entries map
     * @return the candidate key to evict, or null if no candidate can be found
     */
    K selectEvictionCandidate(Map<K, CacheEntry<K, V>> entries);

    /**
     * Resets any internal tracking state.
     */
    void clear();
}
