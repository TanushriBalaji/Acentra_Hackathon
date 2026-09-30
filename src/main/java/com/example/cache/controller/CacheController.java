package com.example.cache.controller;

import com.example.cache.dto.CacheConfigRequest;
import com.example.cache.dto.CacheEntryRequest;
import com.example.cache.dto.CacheEntryResponse;
import com.example.cache.dto.CacheOperationResultResponse;
import com.example.cache.dto.SamplePatternResponse;
import com.example.cache.metrics.CacheMetricsSnapshot;
import com.example.cache.service.CacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller exposing in-memory cache endpoints for management,
 * key manipulation, metrics introspection, and algorithm diagnostics.
 */
@RestController
@RequestMapping("/api/cache")
@CrossOrigin(origins = "*")
public class CacheController {

    private final CacheService cacheService;

    public CacheController(CacheService cacheService) {
        this.cacheService = cacheService;
    }

    /**
     * POST /api/cache/configure
     * Reconfigures cache capacity, eviction algorithm (LRU/LFU), and default TTL.
     */
    @PostMapping("/configure")
    public ResponseEntity<Map<String, Object>> configureCache(@RequestBody CacheConfigRequest config) {
        cacheService.configureCache(config);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("message", "Cache configuration updated successfully");
        response.put("capacity", cacheService.getCapacity());
        response.put("policy", cacheService.getActivePolicy());
        return ResponseEntity.ok(response);
    }

    /**
     * PUT /api/cache/entries/{key}
     * Stores or updates a key-value mapping with an optional per-entry TTL.
     */
    @PutMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> putEntry(
            @PathVariable("key") String key,
            @RequestBody CacheEntryRequest request
    ) {
        Long ttl = (request != null) ? request.getTtlInMillis() : null;
        String val = (request != null) ? request.getValue() : "";
        CacheOperationResultResponse result = cacheService.put(key, val, ttl);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/cache/entries/{key}
     * Retrieves the cached entry value and reports HIT, MISS, or EXPIRED.
     */
    @GetMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> getEntry(@PathVariable("key") String key) {
        CacheOperationResultResponse result = cacheService.get(key);
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/cache/entries/{key}
     * Deletes a specific entry by its key.
     */
    @DeleteMapping("/entries/{key}")
    public ResponseEntity<CacheOperationResultResponse> deleteEntry(@PathVariable("key") String key) {
        CacheOperationResultResponse result = cacheService.delete(key);
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/cache/entries
     * Purges all entries from the cache.
     */
    @DeleteMapping("/entries")
    public ResponseEntity<Map<String, Object>> clearCache() {
        cacheService.clear();

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("message", "Cache entries cleared successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/cache/entries
     * Lists all current non-expired cache entries with metadata.
     */
    @GetMapping("/entries")
    public ResponseEntity<List<CacheEntryResponse>> getAllEntries() {
        List<CacheEntryResponse> entries = cacheService.getCurrentEntries();
        return ResponseEntity.ok(entries);
    }

    /**
     * GET /api/cache/metrics
     * Returns comprehensive telemetry including hits, misses, hit rate, miss rate,
     * evictions, expirations, capacity, and active eviction policy.
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        CacheMetricsSnapshot metrics = cacheService.getMetrics();
        List<CacheEntryResponse> entries = cacheService.getCurrentEntries();

        Map<String, Object> response = new HashMap<>();
        response.put("hits", metrics.hits());
        response.put("misses", metrics.misses());
        response.put("evictions", metrics.evictions());
        response.put("expirations", metrics.expirations());
        response.put("totalRequests", metrics.totalRequests());
        response.put("hitRate", metrics.hitRate());
        response.put("missRate", metrics.missRate());
        response.put("currentSize", entries.size());
        response.put("capacity", cacheService.getCapacity());
        response.put("policy", cacheService.getActivePolicy());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/cache/sample-pattern
     * Executes standard demonstration workflow (Capacity 2, LRU, A -> B -> GET A -> C evicts B -> GET B miss).
     */
    @PostMapping("/sample-pattern")
    public ResponseEntity<SamplePatternResponse> runSamplePattern() {
        SamplePatternResponse response = cacheService.runSamplePattern();
        return ResponseEntity.ok(response);
    }
}
