package com.example.cache.model;

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
     * Checks whether this cache entry is expired relative to an explicit timestamp (useful for deterministic testing).
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
     * Updates entry access metrics with a specific timestamp (useful for testing and deterministic ordering).
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
}
