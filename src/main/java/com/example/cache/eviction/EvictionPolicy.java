package com.example.cache.eviction;

/**
 * Supported cache eviction policies.
 */
public enum EvictionPolicy {
    /**
     * Least Recently Used: Evicts entries that haven't been accessed for the longest time.
     */
    LRU("Least Recently Used"),

    /**
     * Least Frequently Used: Evicts entries with the lowest access counts,
     * breaking ties using the least recent access timestamp.
     */
    LFU("Least Frequently Used");

    private final String description;

    EvictionPolicy(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
