package com.example.cache.dto;

/**
 * Detailed representation of an active or retrieved cache entry.
 */
public class CacheEntryResponse {

    private String key;
    private String value;
    private long creationTime;
    private Long expiryTime;
    private long accessCount;
    private long lastAccessTime;
    private boolean isExpired;

    public CacheEntryResponse() {
    }

    public CacheEntryResponse(String key, String value, long creationTime, Long expiryTime, long accessCount, long lastAccessTime, boolean isExpired) {
        this.key = key;
        this.value = value;
        this.creationTime = creationTime;
        this.expiryTime = expiryTime;
        this.accessCount = accessCount;
        this.lastAccessTime = lastAccessTime;
        this.isExpired = isExpired;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public long getCreationTime() {
        return creationTime;
    }

    public void setCreationTime(long creationTime) {
        this.creationTime = creationTime;
    }

    public Long getExpiryTime() {
        return expiryTime;
    }

    public void setExpiryTime(Long expiryTime) {
        this.expiryTime = expiryTime;
    }

    public long getAccessCount() {
        return accessCount;
    }

    public void setAccessCount(long accessCount) {
        this.accessCount = accessCount;
    }

    public long getLastAccessTime() {
        return lastAccessTime;
    }

    public void setLastAccessTime(long lastAccessTime) {
        this.lastAccessTime = lastAccessTime;
    }

    public boolean isExpired() {
        return isExpired;
    }

    public void setExpired(boolean expired) {
        isExpired = expired;
    }

    @Override
    public String toString() {
        return "CacheEntryResponse{" +
                "key='" + key + '\'' +
                ", value='" + value + '\'' +
                ", creationTime=" + creationTime +
                ", expiryTime=" + expiryTime +
                ", accessCount=" + accessCount +
                ", lastAccessTime=" + lastAccessTime +
                ", isExpired=" + isExpired +
                '}';
    }
}
