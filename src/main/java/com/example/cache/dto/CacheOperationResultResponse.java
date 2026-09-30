package com.example.cache.dto;

import com.example.cache.metrics.CacheMetricsSnapshot;

/**
 * Standard response envelope for individual cache operations (GET, PUT, DELETE).
 */
public class CacheOperationResultResponse {

    private String status; // "HIT" | "MISS" | "EXPIRED" | "EVICTION" | "STORED" | "DELETED"
    private String key;
    private String value;
    private CacheMetricsSnapshot metrics;

    public CacheOperationResultResponse() {
    }

    public CacheOperationResultResponse(String status, String key, String value, CacheMetricsSnapshot metrics) {
        this.status = status;
        this.key = key;
        this.value = value;
        this.metrics = metrics;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public CacheMetricsSnapshot getMetrics() {
        return metrics;
    }

    public void setMetrics(CacheMetricsSnapshot metrics) {
        this.metrics = metrics;
    }

    @Override
    public String toString() {
        return "CacheOperationResultResponse{" +
                "status='" + status + '\'' +
                ", key='" + key + '\'' +
                ", value='" + value + '\'' +
                ", metrics=" + metrics +
                '}';
    }
}
