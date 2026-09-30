package com.example.cache.dto;

/**
 * DTO carrying payload for creating or updating a cache entry.
 */
public class CacheEntryRequest {

    private String value;
    private Long ttlInMillis;

    public CacheEntryRequest() {
    }

    public CacheEntryRequest(String value, Long ttlInMillis) {
        this.value = value;
        this.ttlInMillis = ttlInMillis;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public Long getTtlInMillis() {
        return ttlInMillis;
    }

    public void setTtlInMillis(Long ttlInMillis) {
        this.ttlInMillis = ttlInMillis;
    }

    @Override
    public String toString() {
        return "CacheEntryRequest{" +
                "value='" + value + '\'' +
                ", ttlInMillis=" + ttlInMillis +
                '}';
    }
}
