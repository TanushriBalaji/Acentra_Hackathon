export interface JavaSourceFile {
  path: string;
  name: string;
  category: 'model' | 'eviction' | 'metrics' | 'engine' | 'dto' | 'service' | 'controller' | 'test' | 'config';
  description: string;
  code: string;
}

export const JAVA_FILES: JavaSourceFile[] = [
  {
    path: 'com/example/cache/model/CacheEntry.java',
    name: 'CacheEntry.java',
    category: 'model',
    description: 'Generic cache entry container with creation/expiration timestamps, access frequency, and recency tracking.',
    code: `package com.example.cache.model;

import java.util.Objects;

/**
 * Represents a cached entry containing key, value, metadata for TTL expiration,
 * and usage statistics for eviction strategies (LRU and LFU).
 *
 * @param <K> the type of key
 * @param <V> the type of value
 */
public class CacheEntry<K, V> {

    private final K key;
    private V value;
    private final long creationTimestamp;
    private long expirationTimestamp;
    private long accessCount;
    private long lastAccessTimestamp;

    /**
     * Constructs a new CacheEntry with specified key, value, and TTL in milliseconds.
     *
     * @param key the entry key (must not be null)
     * @param value the entry value
     * @param ttlInMillis time to live in milliseconds; if null, 0, or negative, entry does not expire
     */
    public CacheEntry(K key, V value, Long ttlInMillis) {
        this.key = Objects.requireNonNull(key, "Cache entry key must not be null");
        this.value = value;
        long now = System.currentTimeMillis();
        this.creationTimestamp = now;
        this.lastAccessTimestamp = now;
        this.accessCount = 1L; // Initialized to 1 upon creation/insertion

        if (ttlInMillis != null && ttlInMillis > 0) {
            this.expirationTimestamp = now + ttlInMillis;
        } else {
            this.expirationTimestamp = Long.MAX_VALUE; // No expiration
        }
    }

    /**
     * Checks whether this cache entry has expired based on current wall-clock time.
     *
     * @return true if the entry has expired; false otherwise
     */
    public boolean isExpired() {
        if (expirationTimestamp == Long.MAX_VALUE) {
            return false;
        }
        return System.currentTimeMillis() >= expirationTimestamp;
    }

    /**
     * Checks whether this cache entry is expired relative to an explicit timestamp.
     *
     * @param currentTimeMillis the timestamp to evaluate against
     * @return true if expired; false otherwise
     */
    public boolean isExpired(long currentTimeMillis) {
        if (expirationTimestamp == Long.MAX_VALUE) {
            return false;
        }
        return currentTimeMillis >= expirationTimestamp;
    }

    /**
     * Updates entry access metrics upon retrieval or update.
     * Increments the access counter and records the current timestamp.
     */
    public void touch() {
        this.accessCount++;
        this.lastAccessTimestamp = System.currentTimeMillis();
    }

    /**
     * Updates entry access metrics with a specific timestamp.
     *
     * @param timestamp the timestamp to record
     */
    public void touch(long timestamp) {
        this.accessCount++;
        this.lastAccessTimestamp = timestamp;
    }

    /**
     * Refreshes the expiration timestamp given a new TTL.
     *
     * @param ttlInMillis new TTL in milliseconds
     */
    public void refreshExpiration(Long ttlInMillis) {
        long now = System.currentTimeMillis();
        if (ttlInMillis != null && ttlInMillis > 0) {
            this.expirationTimestamp = now + ttlInMillis;
        } else {
            this.expirationTimestamp = Long.MAX_VALUE;
        }
    }

    // --- Getters & Setters ---

    public K getKey() {
        return key;
    }

    public V getValue() {
        return value;
    }

    public void setValue(V value) {
        this.value = value;
    }

    public long getCreationTimestamp() {
        return creationTimestamp;
    }

    public long getExpirationTimestamp() {
        return expirationTimestamp;
    }

    public long getAccessCount() {
        return accessCount;
    }

    public void setAccessCount(long accessCount) {
        this.accessCount = accessCount;
    }

    public long getLastAccessTimestamp() {
        return lastAccessTimestamp;
    }

    public void setLastAccessTimestamp(long lastAccessTimestamp) {
        this.lastAccessTimestamp = lastAccessTimestamp;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CacheEntry<?, ?> that = (CacheEntry<?, ?>) o;
        return Objects.equals(key, that.key);
    }

    @Override
    public int hashCode() {
        return Objects.hash(key);
    }

    @Override
    public String toString() {
        return "CacheEntry{" +
                "key=" + key +
                ", value=" + value +
                ", creationTimestamp=" + creationTimestamp +
                ", expirationTimestamp=" + (expirationTimestamp == Long.MAX_VALUE ? "NEVER" : expirationTimestamp) +
                ", accessCount=" + accessCount +
                ", lastAccessTimestamp=" + lastAccessTimestamp +
                ", expired=" + isExpired() +
                '}';
    }
}`
  },
  {
    path: 'com/example/cache/eviction/EvictionPolicy.java',
    name: 'EvictionPolicy.java',
    category: 'eviction',
    description: 'Enumeration of supported cache eviction algorithms (LRU and LFU).',
    code: `package com.example.cache.eviction;

/**
 * Supported cache eviction policies.
 */
public enum EvictionPolicy {
    /**
     * Least Recently Used: Evicts entries that haven't been accessed for the longest time.
     */
    LRU("Least Recently Used"),

    /**
     * Least Frequently Used: Evicts entries with the lowest access counts,
     * breaking ties using the least recent access timestamp.
     */
    LFU("Least Frequently Used");

    private final String description;

    EvictionPolicy(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}`
  },
  {
    path: 'com/example/cache/eviction/EvictionStrategy.java',
    name: 'EvictionStrategy.java',
    category: 'eviction',
    description: 'Interface specifying eviction candidate selection and access tracking hooks.',
    code: `package com.example.cache.eviction;

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
}`
  },
  {
    path: 'com/example/cache/eviction/LRUEvictionStrategy.java',
    name: 'LRUEvictionStrategy.java',
    category: 'eviction',
    description: 'Recency-based eviction strategy tracking access order with LinkedHashSet.',
    code: `package com.example.cache.eviction;

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
}`
  },
  {
    path: 'com/example/cache/eviction/LFUEvictionStrategy.java',
    name: 'LFUEvictionStrategy.java',
    category: 'eviction',
    description: 'Frequency-based eviction strategy with LRU recency tie-breaking.',
    code: `package com.example.cache.eviction;

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
}`
  },
  {
    path: 'com/example/cache/metrics/CacheMetrics.java',
    name: 'CacheMetrics.java',
    category: 'metrics',
    description: 'Thread-safe operational telemetry collector using AtomicLong counters.',
    code: `package com.example.cache.metrics;

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
}`
  },
  {
    path: 'com/example/cache/metrics/CacheMetricsSnapshot.java',
    name: 'CacheMetricsSnapshot.java',
    category: 'metrics',
    description: 'Immutable snapshot record encapsulating point-in-time metrics.',
    code: `package com.example.cache.metrics;

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
}`
  },
  {
    path: 'com/example/cache/engine/CustomCache.java',
    name: 'CustomCache.java',
    category: 'engine',
    description: 'Thread-safe core engine guarded by ReentrantLock with TTL and dynamic strategies.',
    code: `package com.example.cache.engine;

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
 * Concurrency is strictly guaranteed by an internal ReentrantLock ensuring
 * that multi-step state mutations execute atomically.
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

    public CustomCache() {
        this(DEFAULT_CAPACITY, EvictionPolicy.LRU, DEFAULT_TTL_MILLIS);
    }

    public CustomCache(int capacity, EvictionPolicy policy) {
        this(capacity, policy, DEFAULT_TTL_MILLIS);
    }

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

    public void put(K key, V value) {
        put(key, value, this.defaultTtlInMillis);
    }

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

    public int size() {
        lock.lock();
        try {
            evictExpiredEntriesIfAny();
            return storage.size();
        } finally {
            lock.unlock();
        }
    }

    public boolean isEmpty() {
        return size() == 0;
    }

    public void clear() {
        lock.lock();
        try {
            storage.clear();
            strategy.clear();
        } finally {
            lock.unlock();
        }
    }

    public void setEvictionPolicy(EvictionPolicy newPolicy) {
        Objects.requireNonNull(newPolicy, "New eviction policy cannot be null");

        lock.lock();
        try {
            if (this.activePolicy == newPolicy) {
                return;
            }

            this.activePolicy = newPolicy;
            this.strategy = createStrategy(newPolicy);

            evictExpiredEntriesIfAny();
            for (Map.Entry<K, CacheEntry<K, V>> item : storage.entrySet()) {
                this.strategy.onPut(item.getKey(), item.getValue());
            }
        } finally {
            lock.unlock();
        }
    }

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

    public void setDefaultTtlInMillis(long defaultTtlInMillis) {
        lock.lock();
        try {
            this.defaultTtlInMillis = Math.max(0L, defaultTtlInMillis);
        } finally {
            lock.unlock();
        }
    }

    public CacheMetricsSnapshot getMetrics() {
        return metrics.snapshot();
    }

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

    public Map<K, CacheEntry<K, V>> getEntriesSnapshot() {
        lock.lock();
        try {
            evictExpiredEntriesIfAny();
            return Collections.unmodifiableMap(new HashMap<>(storage));
        } finally {
            lock.unlock();
        }
    }

    private void evictExpiredEntriesIfAny() {
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
}`
  },
  {
    path: 'com/example/cache/CustomCacheTest.java',
    name: 'CustomCacheTest.java',
    category: 'test',
    description: 'Comprehensive JUnit 5 test suite validating basic ops, TTL, LRU, LFU tie-breaking, and concurrency.',
    code: `package com.example.cache;

import com.example.cache.engine.CustomCache;
import com.example.cache.eviction.EvictionPolicy;
import com.example.cache.metrics.CacheMetricsSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CustomCache Comprehensive Test Suite")
class CustomCacheTest {

    private CustomCache<String, String> cache;

    @BeforeEach
    void setUp() {
        cache = new CustomCache<>(10, EvictionPolicy.LRU);
    }

    @Nested
    @DisplayName("Basic Operations")
    class BasicOperationsTest {

        @Test
        @DisplayName("Should successfully store and retrieve an item (Cache Hit)")
        void testBasicPutAndGet() {
            cache.put("user:101", "Alice");

            String val = cache.get("user:101");
            assertEquals("Alice", val);

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(1, metrics.hits());
            assertEquals(0, metrics.misses());
            assertEquals(100.0, metrics.hitRate());
            assertEquals(1, cache.size());
        }

        @Test
        @DisplayName("Should return null and record a miss for non-existent key")
        void testGetNonExistentKeyRecordsMiss() {
            String val = cache.get("unknown_key");
            assertNull(val);

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(0, metrics.hits());
            assertEquals(1, metrics.misses());
        }

        @Test
        @DisplayName("Should update value in-place without triggering eviction when key already exists")
        void testPutOverwriteExistingKey() {
            cache.put("k1", "v1");
            cache.put("k1", "v2_updated");

            assertEquals("v2_updated", cache.get("k1"));
            assertEquals(1, cache.size());
        }

        @Test
        @DisplayName("Should remove existing key and decrease size")
        void testRemoveKey() {
            cache.put("k1", "v1");
            assertTrue(cache.containsKey("k1"));

            String removed = cache.remove("k1");
            assertEquals("v1", removed);
            assertFalse(cache.containsKey("k1"));
            assertEquals(0, cache.size());
        }

        @Test
        @DisplayName("Should clear all entries")
        void testClearCache() {
            cache.put("a", "1");
            cache.put("b", "2");
            cache.put("c", "3");

            cache.clear();
            assertEquals(0, cache.size());
            assertTrue(cache.isEmpty());
        }
    }

    @Nested
    @DisplayName("TTL Expiration Operations")
    class TtlExpirationTest {

        @Test
        @DisplayName("GET should return null and record expiration & miss after TTL expires")
        void testEntryExpiresAfterTtl() throws InterruptedException {
            cache.put("token:temp", "secret_value", 40L);

            Thread.sleep(60L);

            String result = cache.get("token:temp");
            assertNull(result);

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(1, metrics.expirations());
            assertEquals(1, metrics.misses());
            assertEquals(0, metrics.hits());
            assertEquals(0, cache.size());
        }
    }

    @Nested
    @DisplayName("LRU Eviction Policy")
    class LruEvictionTest {

        @Test
        @DisplayName("Should evict the least recently used item when capacity is reached")
        void testLruEvictsOldestItem() {
            CustomCache<String, String> lruCache = new CustomCache<>(3, EvictionPolicy.LRU);

            lruCache.put("A", "Alpha");
            lruCache.put("B", "Beta");
            lruCache.put("C", "Gamma");

            // Touch A -> B becomes LRU
            assertEquals("Alpha", lruCache.get("A"));

            // Insert D -> Evicts B
            lruCache.put("D", "Delta");

            assertEquals(3, lruCache.size());
            assertNull(lruCache.get("B"));
            assertNotNull(lruCache.get("A"));
            assertNotNull(lruCache.get("C"));
            assertNotNull(lruCache.get("D"));
            assertEquals(1, lruCache.getMetrics().evictions());
        }
    }

    @Nested
    @DisplayName("LFU Eviction Policy with Deterministic Tie-Breaker")
    class LfuEvictionTest {

        @Test
        @DisplayName("Should evict entry with the lowest access count")
        void testLfuEvictsLowestFrequency() {
            CustomCache<String, String> lfuCache = new CustomCache<>(3, EvictionPolicy.LFU);

            lfuCache.put("A", "Alpha");
            lfuCache.put("B", "Beta");
            lfuCache.put("C", "Gamma");

            lfuCache.get("A");
            lfuCache.get("A"); // A freq: 3
            lfuCache.get("B"); // B freq: 2
            // C freq: 1

            lfuCache.put("D", "Delta");

            assertNull(lfuCache.get("C"));
            assertNotNull(lfuCache.get("A"));
            assertNotNull(lfuCache.get("B"));
            assertNotNull(lfuCache.get("D"));
        }

        @Test
        @DisplayName("LFU Tie-Breaker: When frequencies are equal, evict the least recently used")
        void testLfuTieBreakerUsesLruRecency() throws InterruptedException {
            CustomCache<String, String> lfuCache = new CustomCache<>(2, EvictionPolicy.LFU);

            lfuCache.put("A", "valA");
            Thread.sleep(10L);
            lfuCache.put("B", "valB");

            // Equal freq (1), A is older -> evict A
            lfuCache.put("C", "valC");

            assertEquals(2, lfuCache.size());
            assertNull(lfuCache.get("A"));
            assertNotNull(lfuCache.get("B"));
            assertNotNull(lfuCache.get("C"));
        }
    }

    @Nested
    @DisplayName("Thread Safety & Concurrency")
    class ConcurrencyTest {

        @Test
        @Timeout(value = 10, unit = TimeUnit.SECONDS)
        @DisplayName("Multi-threaded concurrent GET and PUT operations maintain atomic metrics and bounded capacity")
        void testConcurrentGetAndPut() throws InterruptedException {
            int capacity = 50;
            int numThreads = 16;
            int operationsPerThread = 200;

            CustomCache<Integer, String> concurrentCache = new CustomCache<>(capacity, EvictionPolicy.LRU);

            ExecutorService executor = Executors.newFixedThreadPool(numThreads);
            CountDownLatch startGate = new CountDownLatch(1);
            CountDownLatch doneGate = new CountDownLatch(numThreads);
            AtomicInteger exceptionCount = new AtomicInteger(0);

            for (int t = 0; t < numThreads; t++) {
                final int threadId = t;
                executor.submit(() -> {
                    try {
                        startGate.await();
                        for (int i = 0; i < operationsPerThread; i++) {
                            int key = (threadId * 10) + (i % 25);
                            if (i % 3 == 0) {
                                concurrentCache.put(key, "Thread-" + threadId + "-Iter-" + i);
                            } else {
                                concurrentCache.get(key);
                            }
                        }
                    } catch (Throwable e) {
                        exceptionCount.incrementAndGet();
                    } finally {
                        doneGate.countDown();
                    }
                });
            }

            startGate.countDown();
            boolean finished = doneGate.await(8, TimeUnit.SECONDS);
            executor.shutdown();

            assertTrue(finished);
            assertEquals(0, exceptionCount.get());
            assertTrue(concurrentCache.size() <= capacity);

            CacheMetricsSnapshot snapshot = concurrentCache.getMetrics();
            assertEquals(snapshot.hits() + snapshot.misses(), snapshot.totalRequests());
        }
    }
}`
  },
  {
    path: 'pom.xml',
    name: 'pom.xml',
    category: 'config',
    description: 'Maven configuration specifying Java 17, JUnit 5 Jupiter, Surefire, and Compiler plugins.',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>custom-cache-library</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>Custom Cache Library</name>
    <description>Generic thread-safe Java in-memory cache library with pluggable eviction (LRU/LFU), per-entry TTL, and metrics.</description>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <junit.jupiter.version>5.10.2</junit.jupiter.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-api</artifactId>
            <version>\${junit.jupiter.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-engine</artifactId>
            <version>\${junit.jupiter.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-params</artifactId>
            <version>\${junit.jupiter.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
            </plugin>
        </plugins>
    </build>
</project>`
  },
  {
    path: 'com/example/cache/dto/CacheConfigRequest.java',
    name: 'CacheConfigRequest.java',
    category: 'dto',
    description: 'DTO carrying configuration parameters for capacity and eviction policy.',
    code: `package com.example.cache.dto;

import com.example.cache.eviction.EvictionPolicy;

public class CacheConfigRequest {
    private int capacity;
    private EvictionPolicy policy;
    private Long defaultTtlInMillis;

    public CacheConfigRequest() {}

    public CacheConfigRequest(int capacity, EvictionPolicy policy, Long defaultTtlInMillis) {
        this.capacity = capacity;
        this.policy = policy;
        this.defaultTtlInMillis = defaultTtlInMillis;
    }

    public int getCapacity() { return capacity; }
    public void setCapacity(int capacity) { this.capacity = capacity; }
    public EvictionPolicy getPolicy() { return policy; }
    public void setPolicy(EvictionPolicy policy) { this.policy = policy; }
    public Long getDefaultTtlInMillis() { return defaultTtlInMillis; }
    public void setDefaultTtlInMillis(Long defaultTtlInMillis) { this.defaultTtlInMillis = defaultTtlInMillis; }
}`
  },
  {
    path: 'com/example/cache/dto/CacheEntryRequest.java',
    name: 'CacheEntryRequest.java',
    category: 'dto',
    description: 'DTO carrying payload value and optional custom TTL for cache insertion.',
    code: `package com.example.cache.dto;

public class CacheEntryRequest {
    private String value;
    private Long ttlInMillis;

    public CacheEntryRequest() {}

    public CacheEntryRequest(String value, Long ttlInMillis) {
        this.value = value;
        this.ttlInMillis = ttlInMillis;
    }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public Long getTtlInMillis() { return ttlInMillis; }
    public void setTtlInMillis(Long ttlInMillis) { this.ttlInMillis = ttlInMillis; }
}`
  },
  {
    path: 'com/example/cache/dto/CacheEntryResponse.java',
    name: 'CacheEntryResponse.java',
    category: 'dto',
    description: 'Detailed response representation of a cached item with usage metadata.',
    code: `package com.example.cache.dto;

public class CacheEntryResponse {
    private String key;
    private String value;
    private long creationTime;
    private Long expiryTime;
    private long accessCount;
    private long lastAccessTime;
    private boolean isExpired;

    public CacheEntryResponse() {}

    public CacheEntryResponse(String key, String value, long creationTime, Long expiryTime, long accessCount, long lastAccessTime, boolean isExpired) {
        this.key = key;
        this.value = value;
        this.creationTime = creationTime;
        this.expiryTime = expiryTime;
        this.accessCount = accessCount;
        this.lastAccessTime = lastAccessTime;
        this.isExpired = isExpired;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public long getCreationTime() { return creationTime; }
    public void setCreationTime(long creationTime) { this.creationTime = creationTime; }
    public Long getExpiryTime() { return expiryTime; }
    public void setExpiryTime(Long expiryTime) { this.expiryTime = expiryTime; }
    public long getAccessCount() { return accessCount; }
    public void setAccessCount(long accessCount) { this.accessCount = accessCount; }
    public long getLastAccessTime() { return lastAccessTime; }
    public void setLastAccessTime(long lastAccessTime) { this.lastAccessTime = lastAccessTime; }
    public boolean isExpired() { return isExpired; }
    public void setExpired(boolean expired) { isExpired = expired; }
}`
  },
  {
    path: 'com/example/cache/dto/CacheOperationResultResponse.java',
    name: 'CacheOperationResultResponse.java',
    category: 'dto',
    description: 'Standard envelope returned after individual GET, PUT, or DELETE operations.',
    code: `package com.example.cache.dto;

import com.example.cache.metrics.CacheMetricsSnapshot;

public class CacheOperationResultResponse {
    private String status; // "HIT" | "MISS" | "EXPIRED" | "EVICTION" | "STORED" | "DELETED"
    private String key;
    private String value;
    private CacheMetricsSnapshot metrics;

    public CacheOperationResultResponse() {}

    public CacheOperationResultResponse(String status, String key, String value, CacheMetricsSnapshot metrics) {
        this.status = status;
        this.key = key;
        this.value = value;
        this.metrics = metrics;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public CacheMetricsSnapshot getMetrics() { return metrics; }
    public void setMetrics(CacheMetricsSnapshot metrics) { this.metrics = metrics; }
}`
  },
  {
    path: 'com/example/cache/dto/SamplePatternResponse.java',
    name: 'SamplePatternResponse.java',
    category: 'dto',
    description: 'Result envelope for the sample pattern diagnostic execution.',
    code: `package com.example.cache.dto;

import com.example.cache.metrics.CacheMetricsSnapshot;
import java.util.List;

public class SamplePatternResponse {
    private int operationsRun;
    private CacheMetricsSnapshot finalMetrics;
    private List<String> executionLogs;

    public SamplePatternResponse() {}

    public SamplePatternResponse(int operationsRun, CacheMetricsSnapshot finalMetrics, List<String> executionLogs) {
        this.operationsRun = operationsRun;
        this.finalMetrics = finalMetrics;
        this.executionLogs = executionLogs;
    }

    public int getOperationsRun() { return operationsRun; }
    public void setOperationsRun(int operationsRun) { this.operationsRun = operationsRun; }
    public CacheMetricsSnapshot getFinalMetrics() { return finalMetrics; }
    public void setFinalMetrics(CacheMetricsSnapshot finalMetrics) { this.finalMetrics = finalMetrics; }
    public List<String> getExecutionLogs() { return executionLogs; }
    public void setExecutionLogs(List<String> executionLogs) { this.executionLogs = executionLogs; }
}`
  },
  {
    path: 'com/example/cache/service/CacheService.java',
    name: 'CacheService.java',
    category: 'service',
    description: 'Spring service managing the cache lifecycle and executing operations.',
    code: `package com.example.cache.service;

import com.example.cache.dto.*;
import com.example.cache.engine.CustomCache;
import com.example.cache.eviction.EvictionPolicy;
import com.example.cache.metrics.CacheMetricsSnapshot;
import com.example.cache.model.CacheEntry;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class CacheService {
    private CustomCache<String, String> cache;
    private final ReentrantLock lifecycleLock = new ReentrantLock();

    public CacheService() {
        this.cache = new CustomCache<>(5, EvictionPolicy.LRU, 0L);
    }

    public void configureCache(CacheConfigRequest config) {
        if (config == null) return;
        lifecycleLock.lock();
        try {
            if (config.getPolicy() != null) cache.setEvictionPolicy(config.getPolicy());
            if (config.getCapacity() > 0) cache.setCapacity(config.getCapacity());
            if (config.getDefaultTtlInMillis() != null) cache.setDefaultTtlInMillis(config.getDefaultTtlInMillis());
        } finally {
            lifecycleLock.unlock();
        }
    }

    public CacheOperationResultResponse put(String key, String value, Long ttl) {
        long evictionsBefore = cache.getMetrics().evictions();
        cache.put(key, value, ttl);
        long evictionsAfter = cache.getMetrics().evictions();
        String status = (evictionsAfter > evictionsBefore) ? "EVICTION" : "STORED";
        return new CacheOperationResultResponse(status, key, value, cache.getMetrics());
    }

    public CacheOperationResultResponse get(String key) {
        long expBefore = cache.getMetrics().expirations();
        String val = cache.get(key);
        long expAfter = cache.getMetrics().expirations();

        String status = (val != null) ? "HIT" : (expAfter > expBefore ? "EXPIRED" : "MISS");
        return new CacheOperationResultResponse(status, key, val, cache.getMetrics());
    }

    public CacheOperationResultResponse delete(String key) {
        String removed = cache.remove(key);
        String status = (removed != null) ? "DELETED" : "MISS";
        return new CacheOperationResultResponse(status, key, removed, cache.getMetrics());
    }

    public void clear() { cache.clear(); }

    public List<CacheEntryResponse> getCurrentEntries() {
        Map<String, CacheEntry<String, String>> snapshot = cache.getEntriesSnapshot();
        List<CacheEntryResponse> results = new ArrayList<>();
        for (Map.Entry<String, CacheEntry<String, String>> item : snapshot.entrySet()) {
            CacheEntry<String, String> e = item.getValue();
            Long exp = (e.getExpirationTimestamp() == Long.MAX_VALUE) ? null : e.getExpirationTimestamp();
            results.add(new CacheEntryResponse(e.getKey(), e.getValue(), e.getCreationTimestamp(), exp, e.getAccessCount(), e.getLastAccessTimestamp(), e.isExpired()));
        }
        return results;
    }

    public CacheMetricsSnapshot getMetrics() { return cache.getMetrics(); }
    public int getCapacity() { return cache.getCapacity(); }
    public EvictionPolicy getActivePolicy() { return cache.getActivePolicy(); }

    public SamplePatternResponse runSamplePattern() {
        lifecycleLock.lock();
        try {
            List<String> logs = new ArrayList<>();
            this.cache = new CustomCache<>(2, EvictionPolicy.LRU, 0L);
            logs.add("Initialized CustomCache(capacity=2, policy=LRU, ttl=0ms)");

            cache.put("A", "Apple");
            logs.add("1. PUT key='A', value='Apple' -> Stored. Current size: 1/2");

            cache.put("B", "Banana");
            logs.add("2. PUT key='B', value='Banana' -> Stored. Current size: 2/2 (Capacity full)");

            String valA = cache.get("A");
            logs.add("3. GET key='A' -> HIT: '" + valA + "'. Access order updated: [B, A]. B is now Least Recently Used.");

            cache.put("C", "Cat");
            logs.add("4. PUT key='C', value='Cat' -> Capacity reached! Evicted key='B' (LRU). Current items: [A, C]");

            String valB = cache.get("B");
            logs.add("5. GET key='B' -> MISS: " + valB + " (Correctly evicted by LRU strategy)");

            String valC = cache.get("C");
            logs.add("6. GET key='C' -> HIT: '" + valC + "'");

            CacheMetricsSnapshot finalMetrics = cache.getMetrics();
            return new SamplePatternResponse(6, finalMetrics, logs);
        } finally {
            lifecycleLock.unlock();
        }
    }
}`
  },
  {
    path: 'com/example/cache/controller/CacheController.java',
    name: 'CacheController.java',
    category: 'controller',
    description: 'Spring Boot REST Controller exposing /api/cache endpoints.',
    code: `package com.example.cache.controller;

import com.example.cache.dto.*;
import com.example.cache.service.CacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/cache")
@CrossOrigin(origins = "*")
public class CacheController {

    private final CacheService cacheService;

    public CacheController(CacheService cacheService) {
        this.cacheService = cacheService;
    }

    @PostMapping("/configure")
    public ResponseEntity<Map<String, Object>> configureCache(@RequestBody CacheConfigRequest config) {
        cacheService.configureCache(config);
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "SUCCESS");
        resp.put("capacity", cacheService.getCapacity());
        resp.put("policy", cacheService.getActivePolicy());
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> putEntry(@PathVariable("key") String key, @RequestBody CacheEntryRequest req) {
        Long ttl = req != null ? req.getTtlInMillis() : null;
        String val = req != null ? req.getValue() : "";
        return ResponseEntity.ok(cacheService.put(key, val, ttl));
    }

    @GetMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> getEntry(@PathVariable("key") String key) {
        return ResponseEntity.ok(cacheService.get(key));
    }

    @DeleteMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> deleteEntry(@PathVariable("key") String key) {
        return ResponseEntity.ok(cacheService.delete(key));
    }

    @DeleteMapping("/entries")
    public ResponseEntity<Map<String, Object>> clearCache() {
        cacheService.clear();
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "SUCCESS");
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/entries")
    public ResponseEntity<List<CacheEntryResponse>> getAllEntries() {
        return ResponseEntity.ok(cacheService.getCurrentEntries());
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        var m = cacheService.getMetrics();
        Map<String, Object> resp = new HashMap<>();
        resp.put("hits", m.hits());
        resp.put("misses", m.misses());
        resp.put("evictions", m.evictions());
        resp.put("expirations", m.expirations());
        resp.put("totalRequests", m.totalRequests());
        resp.put("hitRate", m.hitRate());
        resp.put("missRate", m.missRate());
        resp.put("currentSize", cacheService.getCurrentEntries().size());
        resp.put("capacity", cacheService.getCapacity());
        resp.put("policy", cacheService.getActivePolicy());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/sample-pattern")
    public ResponseEntity<SamplePatternResponse> runSamplePattern() {
        return ResponseEntity.ok(cacheService.runSamplePattern());
    }
}`
  },
  {
    path: 'com/example/cache/CacheApplication.java',
    name: 'CacheApplication.java',
    category: 'config',
    description: 'Spring Boot main entry point for the REST API application.',
    code: `package com.example.cache;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CacheApplication {
    public static void main(String[] args) {
        SpringApplication.run(CacheApplication.class, args);
    }
}`
  },
  {
    path: 'com/example/cache/CacheControllerTest.java',
    name: 'CacheControllerTest.java',
    category: 'test',
    description: 'Spring Boot MockMvc integration tests for CacheController REST endpoints.',
    code: `package com.example.cache;

import com.example.cache.dto.CacheConfigRequest;
import com.example.cache.dto.CacheEntryRequest;
import com.example.cache.eviction.EvictionPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Spring Boot REST API Controller Tests")
class CacheControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void testConfigureEndpoint() throws Exception {
        CacheConfigRequest config = new CacheConfigRequest(4, EvictionPolicy.LRU, 0L);
        mockMvc.perform(post("/api/cache/configure")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(config)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    void testPutAndGetEndpoint() throws Exception {
        CacheEntryRequest entryReq = new CacheEntryRequest("SecretValue", 5000L);
        mockMvc.perform(put("/api/cache/entries/session:101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entryReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("STORED"));

        mockMvc.perform(get("/api/cache/entries/session:101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("HIT"))
                .andExpect(jsonPath("$.value").value("SecretValue"));
    }

    @Test
    void testSamplePatternEndpoint() throws Exception {
        mockMvc.perform(post("/api/cache/sample-pattern"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operationsRun").value(6))
                .andExpect(jsonPath("$.finalMetrics.evictions", equalTo(1)));
    }
}`
  }
];
