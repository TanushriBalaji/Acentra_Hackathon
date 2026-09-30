package com.example.cache.dto;

import com.example.cache.eviction.EvictionPolicy;

/**
 * DTO carrying configuration parameters for resizing or policy adjustments.
 */
public class CacheConfigRequest {

    private int capacity;
    private EvictionPolicy policy;
    private Long defaultTtlInMillis;

    public CacheConfigRequest() {
    }

    public CacheConfigRequest(int capacity, EvictionPolicy policy, Long defaultTtlInMillis) {
        this.capacity = capacity;
        this.policy = policy;
        this.defaultTtlInMillis = defaultTtlInMillis;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public EvictionPolicy getPolicy() {
        return policy;
    }

    public void setPolicy(EvictionPolicy policy) {
        this.policy = policy;
    }

    public Long getDefaultTtlInMillis() {
        return defaultTtlInMillis;
    }

    public void setDefaultTtlInMillis(Long defaultTtlInMillis) {
        this.defaultTtlInMillis = defaultTtlInMillis;
    }

    @Override
    public String toString() {
        return "CacheConfigRequest{" +
                "capacity=" + capacity +
                ", policy=" + policy +
                ", defaultTtlInMillis=" + defaultTtlInMillis +
                '}';
    }
}
