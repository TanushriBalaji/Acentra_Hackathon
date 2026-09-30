package com.example.cache;

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

/**
 * Production-grade JUnit 5 test suite validating the CustomCache library:
 * - Basic Put / Get / Remove / Clear semantics
 * - Time-To-Live (TTL) expiration & lazy eviction
 * - Least Recently Used (LRU) eviction
 * - Least Frequently Used (LFU) eviction with deterministic LRU tie-breaking
 * - Multi-threaded concurrency under high contention
 */
@DisplayName("CustomCache Comprehensive Test Suite")
class CustomCacheTest {

    private CustomCache<String, String> cache;

    @BeforeEach
    void setUp() {
        // Default initialized with capacity 10 and LRU policy
        cache = new CustomCache<>(10, EvictionPolicy.LRU);
    }

    // =========================================================================
    // a) Basic PUT and GET functionality
    // =========================================================================
    @Nested
    @DisplayName("Basic Operations")
    class BasicOperationsTest {

        @Test
        @DisplayName("Should successfully store and retrieve an item (Cache Hit)")
        void testBasicPutAndGet() {
            cache.put("user:101", "Alice");

            String val = cache.get("user:101");
            assertEquals("Alice", val, "Expected retrieved value to match stored value");

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(1, metrics.hits(), "Hits count should be 1");
            assertEquals(0, metrics.misses(), "Misses count should be 0");
            assertEquals(100.0, metrics.hitRate(), "Hit rate should be 100%");
            assertEquals(1, cache.size(), "Cache size should be 1");
        }

        @Test
        @DisplayName("Should return null and record a miss for non-existent key")
        void testGetNonExistentKeyRecordsMiss() {
            String val = cache.get("unknown_key");
            assertNull(val, "Non-existent key should return null");

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(0, metrics.hits());
            assertEquals(1, metrics.misses());
            assertEquals(0.0, metrics.hitRate());
            assertEquals(100.0, metrics.missRate());
        }

        @Test
        @DisplayName("Should update value in-place without triggering eviction when key already exists")
        void testPutOverwriteExistingKey() {
            cache.put("k1", "v1");
            cache.put("k1", "v2_updated");

            assertEquals("v2_updated", cache.get("k1"));
            assertEquals(1, cache.size(), "Overwriting existing key should not increase cache size");
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
            assertNull(cache.get("k1"));
        }

        @Test
        @DisplayName("Should clear all entries")
        void testClearCache() {
            cache.put("a", "1");
            cache.put("b", "2");
            cache.put("c", "3");
            assertEquals(3, cache.size());

            cache.clear();
            assertEquals(0, cache.size());
            assertTrue(cache.isEmpty());
            assertNull(cache.get("a"));
        }

        @Test
        @DisplayName("Should reject null keys with NullPointerException")
        void testNullKeyRejection() {
            assertThrows(NullPointerException.class, () -> cache.put(null, "value"));
        }
    }

    // =========================================================================
    // b) TTL Expiration Tests
    // =========================================================================
    @Nested
    @DisplayName("TTL Expiration Operations")
    class TtlExpirationTest {

        @Test
        @DisplayName("Entry should be retrievable before TTL expires")
        void testEntryValidBeforeTtl() {
            // Set 500ms TTL
            cache.put("session:abc", "active_data", 500L);

            assertTrue(cache.containsKey("session:abc"));
            assertEquals("active_data", cache.get("session:abc"));
            assertEquals(1, cache.getMetrics().hits());
        }

        @Test
        @DisplayName("GET should return null and record expiration & miss after TTL expires")
        void testEntryExpiresAfterTtl() throws InterruptedException {
            // Short TTL: 40ms
            long shortTtl = 40L;
            cache.put("token:temp", "secret_value", shortTtl);

            // Wait 60ms to guarantee expiration
            Thread.sleep(60L);

            String result = cache.get("token:temp");
            assertNull(result, "Expired entry must return null on get()");

            CacheMetricsSnapshot metrics = cache.getMetrics();
            assertEquals(1, metrics.expirations(), "Expirations counter should increment to 1");
            assertEquals(1, metrics.misses(), "Misses counter should increment to 1");
            assertEquals(0, metrics.hits(), "Hits counter should remain 0");
            assertFalse(cache.containsKey("token:temp"), "Cache should no longer contain expired key");
            assertEquals(0, cache.size(), "Size should reflect eviction of expired entry");
        }

        @Test
        @DisplayName("Default cache TTL is respected when custom TTL is omitted")
        void testDefaultTtlApplied() throws InterruptedException {
            CustomCache<String, String> ttlCache = new CustomCache<>(5, EvictionPolicy.LRU, 50L);
            ttlCache.put("default_item", "default_val");

            Thread.sleep(70L);

            assertNull(ttlCache.get("default_item"));
            assertEquals(1, ttlCache.getMetrics().expirations());
        }
    }

    // =========================================================================
    // c) LRU Eviction Tests
    // =========================================================================
    @Nested
    @DisplayName("LRU Eviction Policy")
    class LruEvictionTest {

        @Test
        @DisplayName("Should evict the least recently used item when capacity is reached")
        void testLruEvictsOldestItem() {
            // Capacity 3
            CustomCache<String, String> lruCache = new CustomCache<>(3, EvictionPolicy.LRU);

            lruCache.put("A", "Alpha"); // Access order: [A]
            lruCache.put("B", "Beta");  // Access order: [A, B]
            lruCache.put("C", "Gamma"); // Access order: [A, B, C]

            // Access A -> Access order becomes [B, C, A] (B is now least recently used)
            assertEquals("Alpha", lruCache.get("A"));

            // Insert D -> Cache full! B should be evicted
            lruCache.put("D", "Delta");

            assertEquals(3, lruCache.size());
            assertNull(lruCache.get("B"), "Key B should have been evicted by LRU strategy");
            assertNotNull(lruCache.get("A"), "Key A should still exist");
            assertNotNull(lruCache.get("C"), "Key C should still exist");
            assertNotNull(lruCache.get("D"), "Key D should still exist");

            CacheMetricsSnapshot metrics = lruCache.getMetrics();
            assertEquals(1, metrics.evictions(), "Evictions counter should be 1");
        }

        @Test
        @DisplayName("Updating an existing key should mark it as most recently used in LRU")
        void testLruPutUpdatesRecency() {
            CustomCache<String, String> lruCache = new CustomCache<>(2, EvictionPolicy.LRU);

            lruCache.put("k1", "v1"); // [k1]
            lruCache.put("k2", "v2"); // [k1, k2]

            // Re-put k1 -> refreshes recency, order becomes [k2, k1]
            lruCache.put("k1", "v1_updated");

            // Put k3 -> k2 should be evicted
            lruCache.put("k3", "v3");

            assertNull(lruCache.get("k2"), "k2 was the least recently used and should be evicted");
            assertEquals("v1_updated", lruCache.get("k1"));
            assertEquals("v3", lruCache.get("k3"));
        }

        @Test
        @DisplayName("Dynamic capacity reduction should evict excess items via LRU")
        void testDynamicCapacityReductionLru() {
            CustomCache<String, String> lruCache = new CustomCache<>(5, EvictionPolicy.LRU);
            lruCache.put("1", "one");
            lruCache.put("2", "two");
            lruCache.put("3", "three");
            lruCache.put("4", "four");

            // Touch 1 and 2 to make 3 and 4 older
            lruCache.get("1");
            lruCache.get("2"); // Order: 3, 4, 1, 2

            // Reduce capacity to 2
            lruCache.setCapacity(2);

            assertEquals(2, lruCache.size());
            assertNull(lruCache.get("3"), "3 should be evicted");
            assertNull(lruCache.get("4"), "4 should be evicted");
            assertNotNull(lruCache.get("1"), "1 should be retained");
            assertNotNull(lruCache.get("2"), "2 should be retained");
        }
    }

    // =========================================================================
    // d) LFU Eviction Tests
    // =========================================================================
    @Nested
    @DisplayName("LFU Eviction Policy with Deterministic Tie-Breaker")
    class LfuEvictionTest {

        @Test
        @DisplayName("Should evict entry with the lowest access count")
        void testLfuEvictsLowestFrequency() {
            // Capacity 3
            CustomCache<String, String> lfuCache = new CustomCache<>(3, EvictionPolicy.LFU);

            lfuCache.put("A", "Alpha"); // count 1
            lfuCache.put("B", "Beta");  // count 1
            lfuCache.put("C", "Gamma"); // count 1

            // Access A 3 times (count = 1 + 3 = 4)
            lfuCache.get("A");
            lfuCache.get("A");
            lfuCache.get("A");

            // Access B 1 time (count = 1 + 1 = 2)
            lfuCache.get("B");

            // C is untouched (count = 1)

            // Insert D -> C has the lowest frequency (1) and must be evicted
            lfuCache.put("D", "Delta");

            assertEquals(3, lfuCache.size());
            assertNull(lfuCache.get("C"), "Key C should have been evicted as lowest frequency entry");
            assertNotNull(lfuCache.get("A"), "Key A should be retained");
            assertNotNull(lfuCache.get("B"), "Key B should be retained");
            assertNotNull(lfuCache.get("D"), "Key D should be retained");

            assertEquals(1, lfuCache.getMetrics().evictions());
        }

        @Test
        @DisplayName("LFU Tie-Breaker: When frequencies are equal, evict the least recently used")
        void testLfuTieBreakerUsesLruRecency() throws InterruptedException {
            CustomCache<String, String> lfuCache = new CustomCache<>(2, EvictionPolicy.LFU);

            // Put A (count = 1, timestamp t0)
            lfuCache.put("A", "valA");
            Thread.sleep(10L); // Ensure timestamp divergence

            // Put B (count = 1, timestamp t1 > t0)
            lfuCache.put("B", "valB");

            // Both A and B have frequency count = 1.
            // A has an older lastAccessTimestamp than B.
            // Inserting C should evict A via LRU tie-breaker.
            lfuCache.put("C", "valC");

            assertEquals(2, lfuCache.size());
            assertNull(lfuCache.get("A"), "Key A has equal frequency to B but is older; it should be evicted");
            assertNotNull(lfuCache.get("B"), "Key B is more recent; it should be retained");
            assertNotNull(lfuCache.get("C"), "Key C is newly inserted; it should be retained");
        }

        @Test
        @DisplayName("Dynamic switch from LRU to LFU preserves entries and adopts LFU behavior")
        void testDynamicPolicySwitch() {
            CustomCache<String, String> dynamicCache = new CustomCache<>(3, EvictionPolicy.LRU);
            dynamicCache.put("A", "valA");
            dynamicCache.put("B", "valB");
            dynamicCache.put("C", "valC");

            // Boost B and C
            dynamicCache.get("B");
            dynamicCache.get("B");
            dynamicCache.get("C");

            // Switch policy to LFU
            dynamicCache.setEvictionPolicy(EvictionPolicy.LFU);
            assertEquals(EvictionPolicy.LFU, dynamicCache.getActivePolicy());

            // Insert D -> A has count 1, B has count 3, C has count 2. A should be evicted.
            dynamicCache.put("D", "valD");

            assertNull(dynamicCache.get("A"), "Key A had lowest frequency and should be evicted after switch to LFU");
            assertNotNull(dynamicCache.get("B"));
            assertNotNull(dynamicCache.get("C"));
            assertNotNull(dynamicCache.get("D"));
        }
    }

    // =========================================================================
    // e) Concurrency Stress Tests
    // =========================================================================
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
                        startGate.await(); // Synchronize thread blast-off

                        for (int i = 0; i < operationsPerThread; i++) {
                            int key = (threadId * 10) + (i % 25); // Contention on keys
                            if (i % 3 == 0) {
                                // Write operation
                                concurrentCache.put(key, "Thread-" + threadId + "-Iter-" + i);
                            } else {
                                // Read operation
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

            // Fire all threads simultaneously
            startGate.countDown();

            // Await completion
            boolean finished = doneGate.await(8, TimeUnit.SECONDS);
            executor.shutdown();

            assertTrue(finished, "All concurrent tasks should complete within timeout");
            assertEquals(0, exceptionCount.get(), "No exceptions should occur during concurrent execution");

            // Cache size invariant
            assertTrue(concurrentCache.size() <= capacity,
                    "Cache size (" + concurrentCache.size() + ") must never exceed capacity (" + capacity + ")");

            // Invariant: totalRequests = hits + misses
            CacheMetricsSnapshot snapshot = concurrentCache.getMetrics();
            assertEquals(snapshot.hits() + snapshot.misses(), snapshot.totalRequests(),
                    "Total requests must strictly equal sum of hits and misses");

            assertTrue(snapshot.totalRequests() > 0, "Concurrent requests should be registered");
        }
    }
}
