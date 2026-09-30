package com.example.cache;

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

/**
 * End-to-end Spring Boot Web MVC integration tests for CacheController REST endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Spring Boot REST API Controller Tests")
class CacheControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("POST /api/cache/configure updates capacity and policy")
    void testConfigureEndpoint() throws Exception {
        CacheConfigRequest config = new CacheConfigRequest(4, EvictionPolicy.LRU, 0L);

        mockMvc.perform(post("/api/cache/configure")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(config)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.capacity").value(4))
                .andExpect(jsonPath("$.policy").value("LRU"));
    }

    @Test
    @DisplayName("PUT /api/cache/entries/{key} and GET /api/cache/entries/{key} lifecycle")
    void testPutAndGetEndpoint() throws Exception {
        CacheEntryRequest entryReq = new CacheEntryRequest("SecretValue", 5000L);

        // 1. PUT
        mockMvc.perform(put("/api/cache/entries/session:101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(entryReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("session:101"))
                .andExpect(jsonPath("$.status").value("STORED"));

        // 2. GET
        mockMvc.perform(get("/api/cache/entries/session:101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("HIT"))
                .andExpect(jsonPath("$.value").value("SecretValue"));

        // 3. GET Non-existent -> MISS
        mockMvc.perform(get("/api/cache/entries/unknown_xyz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MISS"))
                .andExpect(jsonPath("$.value").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/cache/metrics reports live telemetry")
    void testMetricsEndpoint() throws Exception {
        mockMvc.perform(get("/api/cache/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hits").isNumber())
                .andExpect(jsonPath("$.misses").isNumber())
                .andExpect(jsonPath("$.hitRate").isNumber())
                .andExpect(jsonPath("$.capacity").isNumber());
    }

    @Test
    @DisplayName("POST /api/cache/sample-pattern runs standard demonstration sequence")
    void testSamplePatternEndpoint() throws Exception {
        mockMvc.perform(post("/api/cache/sample-pattern"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operationsRun").value(6))
                .andExpect(jsonPath("$.executionLogs", hasSize(greaterThanOrEqualTo(6))))
                .andExpect(jsonPath("$.finalMetrics.hits", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.finalMetrics.evictions", equalTo(1)));
    }
}
