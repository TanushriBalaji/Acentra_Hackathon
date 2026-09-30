package com.example.cache.dto;

import com.example.cache.metrics.CacheMetricsSnapshot;

import java.util.List;

/**
 * Encapsulates the results and step-by-step diagnostic log of the demonstration execution pattern.
 */
public class SamplePatternResponse {

    private int operationsRun;
    private CacheMetricsSnapshot finalMetrics;
    private List<String> executionLogs;

    public SamplePatternResponse() {
    }

    public SamplePatternResponse(int operationsRun, CacheMetricsSnapshot finalMetrics, List<String> executionLogs) {
        this.operationsRun = operationsRun;
        this.finalMetrics = finalMetrics;
        this.executionLogs = executionLogs;
    }

    public int getOperationsRun() {
        return operationsRun;
    }

    public void setOperationsRun(int operationsRun) {
        this.operationsRun = operationsRun;
    }

    public CacheMetricsSnapshot getFinalMetrics() {
        return finalMetrics;
    }

    public void setFinalMetrics(CacheMetricsSnapshot finalMetrics) {
        this.finalMetrics = finalMetrics;
    }

    public List<String> getExecutionLogs() {
        return executionLogs;
    }

    public void setExecutionLogs(List<String> executionLogs) {
        this.executionLogs = executionLogs;
    }

    @Override
    public String toString() {
        return "SamplePatternResponse{" +
                "operationsRun=" + operationsRun +
                ", finalMetrics=" + finalMetrics +
                ", executionLogs=" + executionLogs +
                '}';
    }
}
