# Search Typeahead System - Viva / Interview Preparation Guide

This guide contains 5 challenging technical questions regarding the architecture of this Search Typeahead system, along with concise, technically perfect answers suitable for interviews or academic reviews.

---

### Q1: What are the scaling limits of an in-memory Trie data structure, and how would you scale it horizontally once memory capacity is exceeded?
**Answer:**
* **Scale Limits**: A Trie has high memory consumption because every character node allocates pointers to child nodes (e.g., in Javascript, a `Map` object wrapper adds overhead). In a single-node setup, as unique queries grow to tens of millions, heap limits will be exceeded.
* **Horizontal Scaling**:
  1. **Range-Based Partitioning**: Shard the Trie based on the prefix first character (e.g., Node A handles `a-g`, Node B handles `h-p`, Node C handles `q-z`).
  2. **Consistent Hash Routing**: Route search inputs and lookups to a pool of distributed Trie shards using a consistent hash ring on the first 2-3 characters of the prefix.
  3. **Read Replicas**: Distribute read queries across multiple read-only Trie replicas while updates are processed on a primary writer node and broadcasted to replicas.

---

### Q2: When a node is added or removed from the Consistent Hashing Ring, how do you handle key rebalancing? What is the impact of virtual nodes?
**Answer:**
* **Key Rebalancing**: In consistent hashing, when a new node is added, it only acquires keys from its immediate clockwise successor on the ring. Conversely, when a node is removed, its keys are reassigned to its clockwise successor. Only $1/N$ of the keys need to be moved (where $N$ is the total number of nodes), rather than re-hashing all keys as in modular arithmetic (`hash % N`).
* **Virtual Nodes**: They solve the **non-uniform key distribution** problem. Without virtual nodes, physical node positions on the hash ring could be clustered, leading to hot spots. By mapping each physical node to multiple virtual positions (e.g., 50-100 replicas), keys are divided into smaller intervals and distributed uniformly across all physical nodes.

---

### Q3: Your Batch Writes layer aggregates search counts in memory. What happens if the server crashes unexpectedly? How do you prevent data loss?
**Answer:**
* **Impact of Crash**: All search counts aggregated in the in-memory buffer since the last flush (up to 5 seconds or 50 unique items) will be lost, leading to slightly inaccurate trend rankings.
* **Mitigation Strategies**:
  1. **Write-Ahead Logging (WAL)**: Before buffering the search query in memory, write it to an append-only log on non-volatile disk. If the server crashes, read and replay the WAL on restart to reconstruct the buffer.
  2. **Durable Message Queue (e.g., Kafka)**: Route search events to a partition of a message queue. Background workers read messages in batches. The queue tracks offsets; if a worker crashes before committing a batch, another worker picks up the offset, guaranteeing zero data loss.

---

### Q4: Computing Exponential Time Decay on read queries could become an $O(N)$ operation for all items in a node's suggestions. How does your design optimize this, and how can it scale further?
**Answer:**
* **Our Optimization**:
  - We store the decayed score at `lastUpdated` and only recalculate decay dynamically on query reads.
  - Since each node is capped at **10 suggestions**, the read decay calculation is $O(1)$ constant time (exactly 10 operations), which is highly performant (our telemetry shows lookup latencies of `0.002 ms`).
* **Scale-Out Options**:
  - **Pre-computed Read Caching**: Let the background flush worker pre-compute and store the decayed suggestion lists periodically.
  - **Approximate Top-K Algorithms**: Use space-efficient probabilistic data structures like Count-Min Sketch or Heavy Hitters to track trends if we need to scale to billions of items.

---

### Q5: How does Javascript's single-threaded nature affect Trie write and read performance when handling concurrent API connections? How would you implement concurrency controls?
**Answer:**
* **Single Thread Impact**: Because Node.js runs on a single event loop, a heavy synchronous write or deep Trie traversal can block the CPU, delaying concurrent read requests.
* **Concurrency Controls & Optimizations**:
  1. **Asynchronous Batching**: The Batch Writes layer yields the main thread and runs updates in small CPU slices (using `setImmediate` or microtasks) to prevent event loop blocking.
  2. **Node.js Cluster Mode / Worker Threads**: Spawn multiple OS processes (Cluster module) sharing the same port. Each worker handles reads using its own CPU core.
  3. **Separation of Read/Write Paths (CQRS)**: Run read suggestions and write updates on separate microservices. Updates are synced asynchronously, ensuring write transactions never block query lookups.
