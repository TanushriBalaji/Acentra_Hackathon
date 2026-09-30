package com.example.cache.eviction;

import com.example.cache.model.CacheEntry;

import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Least Recently Used (LRU) eviction strategy.
 * Tracks access recency using an access-ordered set (LinkedHashSet).
 * Every access (get/put) moves the key to the tail (most recent),
 * so the head of the set is consistently the least recently used candidate.
 *
 * @param <K> key type
 * @param <V> value type
 */
public class LRUEvictionStrategy<K, V> implements EvictionStrategy<K, V> {

    private final Set<K> accessOrder = new LinkedHashSet<>();

    @Override
    public void onGet(K key, CacheEntry<K, V> entry) {
        if (key != null) {
            accessOrder.remove(key);
            accessOrder.add(key);
        }
    }

    @Override
    public void onPut(K key, CacheEntry<K, V> entry) {
        if (key != null) {
            accessOrder.remove(key);
            accessOrder.add(key);
        }
    }

    @Override
    public void onRemove(K key) {
        if (key != null) {
            accessOrder.remove(key);
        }
    }

    @Override
    public K selectEvictionCandidate(Map<K, CacheEntry<K, V>> entries) {
        if (entries == null || entries.isEmpty()) {
            return null;
        }

        // Check internal accessOrder first (head is least recently used)
        Iterator<K> iterator = accessOrder.iterator();
        while (iterator.hasNext()) {
            K candidate = iterator.next();
            if (entries.containsKey(candidate)) {
                return candidate;
            } else {
                iterator.remove(); // Clean up stale reference
            }
        }

        // Fallback: If accessOrder was somehow out of sync, determine candidate via entry lastAccessTimestamp
        K oldestKey = null;
        long oldestTime = Long.MAX_VALUE;

        for (Map.Entry<K, CacheEntry<K, V>> item : entries.entrySet()) {
            CacheEntry<K, V> entry = item.getValue();
            if (entry != null && entry.getLastAccessTimestamp() < oldestTime) {
                oldestTime = entry.getLastAccessTimestamp();
                oldestKey = item.getKey();
            }
        }

        return oldestKey != null ? oldestKey : entries.keySet().iterator().next();
    }

    @Override
    public void clear() {
        accessOrder.clear();
    }

    /**
     * Returns an unmodifiable view of current access order (head = oldest, tail = newest).
     */
    public Set<K> getAccessOrderSnapshot() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(accessOrder));
    }
}
