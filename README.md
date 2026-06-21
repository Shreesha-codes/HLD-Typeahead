# High-Throughput Search Typeahead System

A high-performance, distributed, and recency-aware Search Typeahead suggestion engine written in TypeScript. 

It implements a manual **in-memory Trie index**, **Consistent Hashing Caching ring**, **Exponential Time Decay** for real-time trending searches, and a **Batch Writes buffer** to aggregate database insertions.

---

## Architecture Design

```
                     +---------------------------------------+
                     |         React TypeScript UI           |
                     +-------------------+-------------------+
                                         |
                                         | REST API
                                         v
                     +-------------------+-------------------+
                     |         Express API Gateway           |
                     +---------+-------------------+---------+
                               |                   |
                     POST /search                  GET /suggest?q=...
                               |                   |
                               v                   v
                     +---------+---------+  +------+-----------------+
                     | SearchBatchWriter |  | Consistent Hash Ring   |
                     |  (In-Memory Queue)|  | (vnodes: 50 per node)   |
                     +---------+---------+  +------+-----------------+
                               |                   |
             Aggregated        |                   | Route to Node
             Flush (5s / 50q)  |                   v
                               v            +------+-----------------+
                     +---------+---------+  | In-Memory Cache Nodes  |
                     |    Primary Trie   |<---+ (cache-node 1 to 4)    |
                     |  (Index & Decay)  |  |  (TTL: 5 seconds)      |
                     +-------------------+  +------------------------+
```

1. **In-Memory Trie Index** (`src/trie.ts`): Optimized prefix matching with cached lists of top 10 suggestions at each node for $O(L)$ constant-time lookup latencies.
2. **Consistent Hash Ring** (`src/consistentHashRing.ts`): Implemented from scratch using MD5 mapped to a 32-bit integer ring. Uses 50 virtual nodes per logical node to ensure uniform key distribution across 4 logical caches.
3. **Exponential Time Decay** (`src/trie.ts`): Recency-aware scoring mechanism which decays search rankings exponentially based on elapsed time:
   $$Score(t) = Score(t_0) \times e^{-\lambda(t - t_0)}$$
   This prevents historical trends from blocking new, rising search items.
4. **Batch Writes Layer** (`src/batchWriter.ts`): Aggregates search requests and flushes them to the Trie in bulk (when the buffer reaches 50 unique queries or after 5 seconds) to reduce write pressure.
5. **Proactive Invalidation**: Updates flush events proactively evict all matching cached prefixes and root trend suggestions from the consistent hashing nodes.

---

## Project Structure
- `/src/trie.ts` - In-memory Trie and node decay implementation.
- `/src/consistentHashRing.ts` - Consistent hashing ring with virtual nodes.
- `/src/cacheNode.ts` - In-memory cache partition with TTL eviction.
- `/src/batchWriter.ts` - Write aggregation buffer queue.
- `/src/server.ts` - Express HTTP gateway and APIs.
- `/src/test.ts` - Integrated test suite (Trie correctness, decay, caching, batching).
- `/src/telemetry.ts` - Performance and load simulation script.
- `/frontend/` - React TypeScript dashboard built on Vite.

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- npm

### 1. Start Backend Server
```bash
# Install dependencies in the root workspace
npm install

# Start the Express server
npm start
```
The server will initialize by generating 100,000 mock queries, ingesting them in the Trie, and starting at `http://localhost:3000`.

### 2. Start Frontend UI
```bash
# Navigate to the frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start the React dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Docker Deployment
Run the complete multi-container system (Express backend + React frontend) using Docker Compose:
```bash
# Build and start services
docker-compose up --build
```
- Frontend will be available at `http://localhost:5173`
- Backend will be available at `http://localhost:3000`

---

## Testing & Telemetry

### Run Verification Suite
Run the 10 core integration tests (Trie logic, mixed case, limits, consistent hashing, time-decay rank swap, buffer flushes):
```bash
npm test
```

### Run Telemetry Load Simulation
Execute the performance simulator to measure average/p95 latency, cache hit rates, and database write reduction under concurrent workload:
```bash
npm run telemetry
```

---

## API Specifications

### 1. Suggest Search Auto-Complete
- **Endpoint**: `GET /suggest?q=<prefix>`
- **Response**:
```json
{
  "query": "best phone",
  "source": "cache",
  "cacheNode": "cache-node-1",
  "suggestions": [
    { "query": "best phone vs classic art", "count": 9514, "score": 9514, "lastUpdated": 177949392239 },
    { "query": "best phone for kids", "count": 9331, "score": 9331, "lastUpdated": 177949392239 }
  ]
}
```

### 2. Submit Search Query
- **Endpoint**: `POST /search`
- **Payload**: `{ "q": "new search term" }`
- **Response**: `{ "message": "Searched", "query": "new search term" }`

### 3. Cache Debug Utility
- **Endpoint**: `GET /cache/debug?prefix=<prefix>`
- **Response**:
```json
{
  "prefix": "laptop",
  "nodeId": "cache-node-1",
  "status": "HIT",
  "suggestions": [...]
}
```
