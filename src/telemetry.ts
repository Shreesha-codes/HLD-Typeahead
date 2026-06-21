import { Trie } from './trie';
import { ConsistentHashRing } from './consistentHashRing';
import { CacheNode } from './cacheNode';
import { SearchBatchWriter } from './batchWriter';
import { generateMockQueries } from './generator';

function getP95(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index];
}

function runSimulation() {
  console.log('=== Starting Telemetry & Load Simulation ===\n');

  // 1. Initialize Trie & Ingest mock dataset
  const trie = new Trie(60000); // 1-minute decay half-life
  console.log('Ingesting 20,000 test queries into Trie...');
  const mockQueries = generateMockQueries(20000);
  for (const item of mockQueries) {
    trie.insert(item.query, item.count);
  }
  console.log('Ingestion complete.\n');

  // 2. Setup Caching layer
  const ring = new ConsistentHashRing(50);
  const cacheNodes = new Map<string, CacheNode>();
  const nodeIds = ['cache-node-1', 'cache-node-2', 'cache-node-3', 'cache-node-4'];
  for (const id of nodeIds) {
    cacheNodes.set(id, new CacheNode(id));
    ring.addNode(id);
  }

  // 3. Simulate suggestions traffic (skewed distribution)
  console.log('Simulating 15,000 suggestion lookups (skewed prefix traffic)...');
  const queryPool = ['best', 'laptop', 'free', 'online', 'easy', 'simple', 'fast', 'quick', 'deals', 'price', 'guide', 'tricks', 'specs', 'download', 'review'];
  
  // Distribute queries using Zipfian-like access patterns
  const trafficPool: string[] = [];
  queryPool.forEach((q, index) => {
    const frequency = Math.floor(2000 / (index + 1)); // High frequency for first terms
    for (let i = 0; i < frequency; i++) {
      trafficPool.push(q);
    }
  });

  const latencies: number[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;
  const CACHE_TTL_MS = 5000;

  for (let i = 0; i < 15000; i++) {
    // Select query prefix from traffic pool randomly
    const prefix = trafficPool[Math.floor(Math.random() * trafficPool.length)] || 'best';
    const normalizedPrefix = trie.normalize(prefix);

    const start = performance.now();

    // Cache routing
    const nodeId = ring.getNode(normalizedPrefix);
    const node = cacheNodes.get(nodeId)!;
    const cached = node.get(normalizedPrefix);

    if (cached !== null) {
      cacheHits++;
    } else {
      cacheMisses++;
      const results = trie.search(prefix);
      node.set(normalizedPrefix, results, CACHE_TTL_MS);
    }

    const end = performance.now();
    latencies.push(end - start);
  }

  const p95Latency = getP95(latencies);
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;

  console.log('--- Suggestions API Metrics ---');
  console.log(`Average Latency: ${avgLatency.toFixed(4)} ms`);
  console.log(`p95 Latency    : ${p95Latency.toFixed(4)} ms`);
  console.log(`Cache Hits     : ${cacheHits}`);
  console.log(`Cache Misses   : ${cacheMisses}`);
  console.log(`Cache Hit Rate : ${hitRate.toFixed(2)}%\n`);

  // 4. Simulate write reduction via Batch aggregate writer
  console.log('Simulating 10,000 search submissions (POST /search) with duplicates...');
  
  let dbWriteCount = 0;
  const testBatchWriter = new SearchBatchWriter(trie, 50, 1000, (flushed) => {
    // Each unique item flushed counts as a database update transaction
    dbWriteCount += flushed.length;
  });

  // Turn off background timer for clean simulation control
  testBatchWriter.stopInterval();

  const searchQueriesPool = ['laptop', 'laptop charger', 'laptop', 'best laptop', 'best laptop', 'laptop charger', 'specs', 'specs', 'specs', 'specs', 'guide'];
  
  for (let i = 0; i < 10000; i++) {
    const q = searchQueriesPool[Math.floor(Math.random() * searchQueriesPool.length)];
    testBatchWriter.addSearch(q);
  }

  // Force flush any leftovers in buffer
  testBatchWriter.flush();

  const reductionPercent = (1 - (dbWriteCount / 10000)) * 100;

  console.log('--- Batch Writes Telemetry ---');
  console.log(`Total Searches Submitted : 10,000`);
  console.log(`Database Write Operations: ${dbWriteCount}`);
  console.log(`Database Write Reduction : ${reductionPercent.toFixed(2)}%\n`);
  
  console.log('============================================');
}

runSimulation();
