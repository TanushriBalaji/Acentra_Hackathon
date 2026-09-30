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
- **Live Metrics Dashboard:** React + Vite interface with real-time performance telemetry (Hit Rate %, Miss Rate %, Memory Capacity Gauge, and visual Cache Entry Inspector).

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
│  React Dashboard (Vite) │ ────────────────────────────> │  Spring Boot
