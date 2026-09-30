# Custom In-Memory Java Cache Library with Live Metrics Panel

A high-performance, thread-safe in-memory Java caching engine featuring generic key-value storage, pluggable eviction strategies (LRU/LFU with deterministic tie-breaking), per-entry TTL expiration, live operational telemetry, Spring Boot REST API integration, and an interactive React dashboard.

---

## Key Features

- **Generic In-Memory Cache Engine:** Stores key-value data with configurable maximum capacity.
- **Pluggable Eviction Strategies:**
  - **LRU (Least Recently Used):** Evicts the least recently accessed item when capacity is reached.
  - **LFU (Least Frequently Used):** Tracks entry access frequencies and evicts the least frequently used key, using access timestamps as a deterministic tie-breaker for equal counts.
- **Per-Entry Time-To-Live (TTL):** Independent expiration tracking per cache entry. Expired keys are recognized as misses and cleaned up dynamically.
- **Thread Safety & Concurrency:** Protected multi-step operations using `ReentrantLock` and atomic metrics counters (`AtomicLong`).
- **RESTful API Layer:** Full Spring Boot application exposing endpoints for configuration, manual cache operations, metrics retrieval, and sample access patterns.
- **Live Metrics Dashboard:** React + Vite interface with real-time performance telemetry including Hit Rate %, Miss Rate %, Memory Capacity Gauge, and visual Cache Entry Inspector.

---

## Technology Stack

- **Backend:** Java 21, Spring Boot 3.2.4, Maven, JUnit 5
- **Concurrency & Metrics:** `java.util.concurrent.locks.ReentrantLock`, `java.util.concurrent.atomic.AtomicLong`
- **Frontend:** React, Vite, Tailwind CSS, Recharts
- **Version Control:** Git & GitHub

---

## Project Architecture

```text
┌─────────────────────────┐          HTTP / JSON          ┌──────────────────────────┐
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


custom-cache/
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── example/
│   │   │           └── cache/
│   │   │               ├── cache/
│   │   │               │   ├── CacheEntry.java
│   │   │               │   ├── CustomCache.java
│   │   │               │   ├── EvictionStrategy.java
│   │   │               │   ├── LRUEvictionStrategy.java
│   │   │               │   └── LFUEvictionStrategy.java
│   │   │               │
│   │   │               ├── controller/
│   │   │               │   └── CacheController.java
│   │   │               │
│   │   │               ├── service/
│   │   │               │   └── CacheService.java
│   │   │               │
│   │   │               └── CacheApplication.java
│   │   │
│   │   └── resources/
│   │       └── application.properties
│   │
│   └── test/
│       └── java/
│           └── com/
│               └── example/
│                   └── cache/
│                       └── CustomCacheTest.java
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── pom.xml
└── README.md



| **Method** | **Endpoint**                | **Description**                                                |
| ---------- | --------------------------- | -------------------------------------------------------------- |
| `POST`     | `/api/cache/configure`      | Set capacity, eviction policy (`LRU` / `LFU`), and default TTL |
| `PUT`      | `/api/cache/entries/{key}`  | Insert or update a cache key-value pair with optional TTL      |
| `GET`      | `/api/cache/entries/{key}`  | Retrieve a value and return `HIT`, `MISS`, or `EXPIRED`        |
| `DELETE`   | `/api/cache/entries/{key}`  | Remove a specific entry by key                                 |
| `DELETE`   | `/api/cache/entries`        | Flush all entries from the cache                               |
| `GET`      | `/api/cache/entries`        | List all currently active, unexpired cache entries             |
| `GET`      | `/api/cache/metrics`        | Return hits, misses, hit rate %, evictions, and current size   |
| `POST`     | `/api/cache/sample-pattern` | Execute a predefined demonstration access pattern              |


API Workflow

The basic cache operation flow is
Client / React Dashboard
          │
          ▼
   HTTP REST Request
          │
          ▼
   CacheController
          │
          ▼
     CacheService
          │
          ▼
      CustomCache
          │
     ┌────┴────┐
     ▼         ▼
    LRU       LFU
 Strategy   Strategy
     │         │
     └────┬────┘
          ▼
   CacheEntry Storage
          │
          ▼
   Metrics / Response
          │
          ▼
   React Dashboard
