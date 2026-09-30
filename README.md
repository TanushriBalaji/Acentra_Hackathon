Custom In-Memory Java Cache Library with Live Metrics PanelA high-performance, thread-safe in-memory Java caching engine featuring generic key-value storage, pluggable eviction strategies (LRU/LFU with deterministic tie-breaking), per-entry TTL expiration, live operational telemetry, Spring Boot REST API integration, and an interactive React dashboard.Key FeaturesGeneric In-Memory Cache Engine: Stores key-value data with configurable maximum capacity.Pluggable Eviction Strategies:LRU (Least Recently Used): Evicts the least recently accessed item when capacity is reached.LFU (Least Frequently Used): Tracks entry access frequencies and evicts the least frequently used key, using access timestamps as a deterministic tie-breaker for equal counts.Per-Entry Time-To-Live (TTL): Independent expiration tracking per cache entry. Expired keys are recognized as misses and cleaned up dynamically.Thread Safety & Concurrency: Protected multi-step operations using ReentrantLock and atomic metrics counters (AtomicLong).RESTful API Layer: Full Spring Boot application exposing endpoints for configuration, manual cache operations, metrics retrieval, and sample access patterns.Live Metrics Dashboard: React + Vite interface with real-time performance telemetry (Hit Rate %, Miss Rate %, Memory Capacity Gauge, and visual Cache Entry Inspector).Technology StackBackend: Java 21, Spring Boot 3.2.4, Maven, JUnit 5Concurrency & Metrics: java.util.concurrent.locks.ReentrantLock, java.util.concurrent.atomic.AtomicLongFrontend: React, Vite, Tailwind CSS, RechartsVersion Control: Git & GitHubProject ArchitecturePlaintext┌─────────────────────────┐          HTTP / JSON          ┌──────────────────────────┐
│  React Dashboard (Vite) │ ────────────────────────────> │  Spring Boot REST API    │
│  - Metrics Cards        │                               │  - CacheController       │
│  - Operation Controls   │ <──────────────────────────── │  - CacheService          │
│  - Live Cache Inspector │          Responses            └─────────────┬────────────┘
└─────────────────────────┘                                             │
                                                                        ▼
                                                          ┌──────────────────────────┐
                                                          │ Custom Cache Library     │
                                                          │  - CustomCache Engine    │
                                                          │  - LRU / LFU Strategies  │
                                                          │  - Atomic Metrics        │
                                                          └──────────────────────────┘
REST API DocumentationMethodEndpointDescriptionPOST/api/cache/configureSet capacity, eviction policy (LRU / LFU), and default TTLPUT/api/cache/entries/{key}Insert or update a cache key-value pair with optional TTLGET/api/cache/entries/{key}Retrieve a value (returns HIT, MISS, or EXPIRED)DELETE/api/cache/entries/{key}Remove a specific entry by keyDELETE/api/cache/entriesFlush all entries from cacheGET/api/cache/entriesList all currently active, unexpired cache entriesGET/api/cache/metricsSnapshot of hits, misses, hit rate %, evictions, and sizePOST/api/cache/sample-patternExecute predefined demonstration access patternGetting Started & Local SetupPrerequisitesJava JDK 17 or 21 (java -version)Apache Maven 3.8+ (mvn -version)Node.js 18+ and npm (node -v, npm -v)Step 1: Run the Backend (Spring Boot)Open a terminal in the project root directory:Bash# Run JUnit 5 unit test suite
mvn test

# Start the Spring Boot REST API server
mvn spring-boot:run
The server will start locally at http://localhost:8080.Step 2: Run the Frontend (React Dashboard)Open a second terminal window in the project root directory:Bash# Install Node dependencies
npm install --legacy-peer-deps

# Start Vite development server
npm run dev
Open your browser and navigate to http://localhost:3000 (or http://localhost:5173) to open the live dashboard.Demonstration WorkflowTo verify LRU eviction and live telemetry metrics in action:Configure Capacity = 2 and Policy = LRU.Execute PUT A = Apple.Execute PUT B = Banana.Execute GET A (Updates recency for key A, making key B the oldest item).Execute PUT C = Cat (Triggers capacity limit; key B is evicted).Execute GET B (Returns MISS).Execute GET A (Returns HIT).
