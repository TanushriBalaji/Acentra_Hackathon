package com.example.cache.engine;

import com.example.cache.eviction.EvictionPolicy;
import com.example.cache.eviction.EvictionStrategy;
import com.example.cache.eviction.LFUEvictionStrategy;
import com.example.cache.eviction.LRUEvictionStrategy;
import com.example.cache.metrics.CacheMetrics;
import com.example.cache.metrics.CacheMetricsSnapshot;
import com.example.cache.model.CacheEntry;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Thread-safe generic in-memory cache supporting pluggable eviction strategies (LRU/LFU),
 * per-entry Time-To-Live (TTL), dynamic capacity adjustments, and metrics tracking.
 *
 * <p>Concurrency is strictly guaranteed by an internal {@link ReentrantLock} ensuring
 * that multi-step state mutations (checking expiration, candidate eviction, and strategy updates)
 * execute atomically.</p>
 *
 * @param <K> the type of keys maintained by this cache
 * @param <V> the type of mapped values
 */
public class CustomCache<K, V> {

    public static final int DEFAULT_CAPACITY = 100;
    public static final long DEFAULT_TTL_MILLIS = 0L; // 0 = no expiration

    private final ReentrantLock lock;
    private int capacity;
    private long defaultTtlInMillis;
    private EvictionPolicy activePolicy;
    private EvictionStrategy<K, V> strategy;
    private final Map<K, CacheEntry<K, V>> storage;
    private final CacheMetrics metrics;

    /**
     * Constructs a CustomCache with default settings (capacity 100, LRU, no default TTL).
     */
    public CustomCache() {
        this(DEFAULT_CAPACITY, EvictionPolicy.LRU, DEFAULT_TTL_MILLIS);
    }

    /**
     * Constructs a CustomCache with specified capacity and eviction policy.
     *
     * @param capacity maximum number of items in cache
     * @param policy eviction policy (LRU or LFU)
     */
    public CustomCache(int capacity, EvictionPolicy policy) {
        this(capacity, policy, DEFAULT_TTL_MILLIS);
    }

    /**
     * Constructs a CustomCache with specified capacity, eviction policy, and default TTL.
     *
     * @param capacity maximum number of items in cache (must be > 0)
     * @param policy eviction policy (LRU or LFU)
     * @param defaultTtlInMillis default TTL in milliseconds (0 or negative means infinite)
     */
    public CustomCache(int capacity, EvictionPolicy policy, long defaultTtlInMillis) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("Cache capacity must be strictly positive: " + capacity);
        }
        this.lock = new ReentrantLock();
        this.capacity = capacity;
        this.defaultTtlInMillis = Math.max(0L, defaultTtlInMillis);
        this.activePolicy = Objects.requireNonNull(policy, "Eviction policy must not be null");
        this.storage = new HashMap<>();
        this.metrics = new CacheMetrics();
        this.strategy = createStrategy(this.activePolicy);
    }

    /**
     * Retrieves the value associated with the specified key.
     *
     * <ol>
     *   <li>Acquires ReentrantLock.</li>
     *   <li>If key is missing, records a cache miss and returns null.</li>
     *   <li>If entry is present but expired, removes entry, records expiration and miss, and returns null.</li>
     *   <li>If valid, touches the entry, notifies strategy via {@code onGet}, records hit, and returns value.</li>
     *   <li>Safely releases the lock in a finally block.</li>
     * </ol>
     *
     * @param key the key whose associated value is to be returned
     * @return the value, or null if key is not found or has expired
     */
    public V get(K key) {
        if (key == null) {
            return null;
        }

        lock.lock();
        try {
            CacheEntry<K, V> entry = storage.get(key);

            if (entry == null) {
                metrics.recordMiss();
                return null;
            }

            // Check TTL expiration
            if (entry.isExpired()) {
                storage.remove(key);
                strategy.onRemove(key);
                metrics.recordExpiration();
                metrics.recordMiss();
                return null;
            }

            // Valid cache hit
            entry.touch();
            strategy.onGet(key, entry);
            metrics.recordHit();
            return entry.getValue();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Associates the specified value with the specified key using the default TTL.
     *
     * @param key the key with which the specified value is to be associated
     * @param value the value to be associated
     */
    public void put(K key, V value) {
        put(key, value, this.defaultTtlInMillis);
    }

    /**
     * Associates the specified value with the specified key using a custom TTL.
     *
     * <ol>
     *   <li>Acquires ReentrantLock.</li>
     *   <li>If updating an existing key: updates value, resets expiration, touches entry, and invokes {@code strategy.onPut}.</li>
     *   <li>If inserting a new key: checks if cache reached capacity. If full, selects eviction candidate,
     *       removes it, records eviction metric, then creates and stores new entry and notifies strategy.</li>
     *   <li>Safely releases lock in a finally block.</li>
     * </ol>
     *
     * @param key key with which the specified value is to be associated (must not be null)
     * @param value value to be associated
     * @param customTtlInMillis TTL in milliseconds; if null or <= 0, falls back to default TTL or never expires
     */
    public void put(K key, V value, Long customTtlInMillis) {
        Objects.requireNonNull(key, "Cache key cannot be null");

        lock.lock();
        try {
            long effectiveTtl = (customTtlInMillis != null && customTtlInMillis > 0)
                    ? customTtlInMillis
                    : this.defaultTtlInMillis;

            CacheEntry<K, V> existing = storage.get(key);

            if (existing != null) {
                // Updating existing key
                existing.setValue(value);
                existing.refreshExpiration(effectiveTtl);
                existing.touch();
                strategy.onPut(key, existing);
                return;
            }

            // Key does not exist. First check if any expired keys can be evicted before policy eviction
            evictExpiredEntriesIfAny();

            // If still at capacity, trigger eviction strategy
            if (storage.size() >= capacity) {
                K candidateKey = strategy.selectEvictionCandidate(storage);
                if (candidateKey != null) {
                    storage.remove(candidateKey);
                    strategy.onRemove(candidateKey);
                    metrics.recordEviction();
                }
            }

            // Create and insert new entry
            CacheEntry<K, V> newEntry = new CacheEntry<>(key, value, effectiveTtl);
            storage.put(key, newEntry);
            strategy.onPut(key, newEntry);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Removes the mapping for a key from this cache if it is present.
     *
     * @param key key whose mapping is to be removed
     * @return previous value associated with key, or null if none
     */
    public V remove(K key) {
        if (key == null) {
            return null;
        }

        lock.lock();
        try {
            CacheEntry<K, V> removed = storage.remove(key);
            if (removed != null) {
                strategy.onRemove(key);
                return removed.getValue();
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Returns true if this cache contains a non-expired mapping for the specified key.
     * Does not record hits or misses.
     *
     * @param key key whose presence in this cache is to be tested
     * @return true if non-expired key is present
     */
    public boolean containsKey(K key) {
        if (key == null) {
            return false;
        }

        lock.lock();
        try {
            CacheEntry<K, V> entry = storage.get(key);
            if (entry == null) {
                return false;
            }
            if (entry.isExpired()) {
                storage.remove(key);
                strategy.onRemove(key);
                metrics.recordExpiration();
                return false;
            }
            return true;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Returns the current number of non-expired key-value mappings in this cache.
     *
     * @return current size
     */
    public int size() {
        lock.lock();
        try {
            evictExpiredEntriesIfAny();
            return storage.size();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Returns true if this cache contains no non-expired key-value mappings.
     */
    public boolean isEmpty() {
        return size() == 0;
    }

    /**
     * Clears all cache entries and resets strategy tracking.
     */
    public void clear() {
        lock.lock();
        try {
            storage.clear();
            strategy.clear();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Changes the active eviction policy dynamically and re-syncs state into the new strategy.
     *
     * @param newPolicy the new eviction policy (LRU or LFU)
     */
    public void setEvictionPolicy(EvictionPolicy newPolicy) {
        Objects.requireNonNull(newPolicy, "New eviction policy cannot be null");

        lock.lock();
        try {
            if (this.activePolicy == newPolicy) {
                return;
            }

            this.activePolicy = newPolicy;
            this.strategy = createStrategy(newPolicy);

            // Re-feed active non-expired entries into the new strategy
            evictExpiredEntriesIfAny();
            for (Map.Entry<K, CacheEntry<K, V>> item : storage.entrySet()) {
                this.strategy.onPut(item.getKey(), item.getValue());
            }
        } finally {
            lock.unlock();
        }
    }

    /**
     * Dynamically adjusts the cache capacity.
     * If the new capacity is smaller than current size, excess entries are evicted
     * according to the active eviction strategy.
     *
     * @param newCapacity new maximum capacity (must be > 0)
     */
    public void setCapacity(int newCapacity) {
        if (newCapacity <= 0) {
            throw new IllegalArgumentException("Capacity must be positive: " + newCapacity);
        }

        lock.lock();
        try {
            this.capacity = newCapacity;
            evictExpiredEntriesIfAny();

            while (storage.size() > this.capacity) {
                K candidateKey = strategy.selectEvictionCandidate(storage);
                if (candidateKey == null) {
                    break;
                }
                storage.remove(candidateKey);
                strategy.onRemove(candidateKey);
                metrics.recordEviction();
            }
        } finally {
            lock.unlock();
        }
    }

    /**
     * Sets the default TTL in milliseconds for new entries that do not specify a custom TTL.
     *
     * @param defaultTtlInMillis TTL in milliseconds
     */
    public void setDefaultTtlInMillis(long defaultTtlInMillis) {
        lock.lock();
        try {
            this.defaultTtlInMillis = Math.max(0L, defaultTtlInMillis);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Returns an immutable copy of the current metrics.
     */
    public CacheMetricsSnapshot getMetrics() {
        return metrics.snapshot();
    }

    /**
     * Returns the underlying metrics collector.
     */
    public CacheMetrics getMetricsCollector() {
        return metrics;
    }

    public int getCapacity() {
        lock.lock();
        try {
            return capacity;
        } finally {
            lock.unlock();
        }
    }

    public long getDefaultTtlInMillis() {
        lock.lock();
        try {
            return defaultTtlInMillis;
        } finally {
            lock.unlock();
        }
    }

    public EvictionPolicy getActivePolicy() {
        lock.lock();
        try {
            return activePolicy;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Creates an unmodifiable snapshot map of all current entries (for metrics/debugging).
     */
    public Map<K, CacheEntry<K, V>> getEntriesSnapshot() {
        lock.lock();
        try {
            evictExpiredEntriesIfAny();
            return Collections.unmodifiableMap(new HashMap<>(storage));
        } finally {
            lock.unlock();
        }
    }

    /**
     * Helper to sweep expired entries before capacity checks.
     */
    private void evictExpiredEntriesIfAny() {
        // Collect expired keys
        java.util.List<K> expiredKeys = new java.util.ArrayList<>();
        for (Map.Entry<K, CacheEntry<K, V>> e : storage.entrySet()) {
            if (e.getValue().isExpired()) {
                expiredKeys.add(e.getKey());
            }
        }

        for (K expKey : expiredKeys) {
            storage.remove(expKey);
            strategy.onRemove(expKey);
            metrics.recordExpiration();
        }
    }

    private EvictionStrategy<K, V> createStrategy(EvictionPolicy policy) {
        return switch (policy) {
            case LRU -> new LRUEvictionStrategy<>();
            case LFU -> new LFUEvictionStrategy<>();
        };
    }
}
