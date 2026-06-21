import express, { Request, Response } from 'express';
import cors from 'cors';
import { Trie } from './trie';
import { generateMockQueries } from './generator';
import { ConsistentHashRing } from './consistentHashRing';
import { CacheNode } from './cacheNode';
import { SearchBatchWriter } from './batchWriter';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Trie and Ingest Mock Data
console.log('=== Search Typeahead System Initializing ===');
const trie = new Trie();

const DATASET_SIZE = 100000;

console.log(`Generating ${DATASET_SIZE.toLocaleString()} mock queries...`);
const generationStart = performance.now();
const mockData = generateMockQueries(DATASET_SIZE);
const generationEnd = performance.now();
console.log(`Generated mock data in ${(generationEnd - generationStart).toFixed(2)}ms`);

console.log(`Ingesting data into Trie...`);
const startMemory = process.memoryUsage().heapUsed;
const ingestionStart = performance.now();

for (const item of mockData) {
  trie.insert(item.query, item.count);
}

const ingestionEnd = performance.now();
const endMemory = process.memoryUsage().heapUsed;
const memoryUsedMB = ((endMemory - startMemory) / 1024 / 1024).toFixed(2);

console.log(`Successfully ingested ${mockData.length.toLocaleString()} queries.`);
console.log(`Ingestion Time: ${(ingestionEnd - ingestionStart).toFixed(2)}ms`);
console.log(`Approx. In-Memory Trie Heap Usage: ${memoryUsedMB} MB`);

// ============================================
// Setup Consistent Caching Layer
// ============================================
console.log('Initializing Consistent Hashing Caching Layer...');
const ring = new ConsistentHashRing(50); // 50 virtual nodes per physical node
const cacheNodes = new Map<string, CacheNode>();

// Spin up 4 logical cache nodes
const NODE_IDS = ['cache-node-1', 'cache-node-2', 'cache-node-3', 'cache-node-4'];
for (const nodeId of NODE_IDS) {
  cacheNodes.set(nodeId, new CacheNode(nodeId));
  ring.addNode(nodeId);
}

const CACHE_TTL_MS = 30000; // 30 seconds Time-To-Live
console.log(`Caching layer initialized with nodes: ${NODE_IDS.join(', ')} (TTL: ${CACHE_TTL_MS / 1000}s)`);

// ============================================
// Setup Batch Writes Layer
// ============================================
console.log('Initializing Batch Writes Layer...');
const batchWriter = new SearchBatchWriter(trie, 50, 5000); // Max capacity 50 unique queries, 5s interval
console.log('Batch Writes Layer initialized (Capacity: 50 unique queries, Interval: 5s)');
console.log('============================================\n');

// API Endpoint: GET /suggest
app.get('/suggest', (req: Request, res: Response) => {
  const queryParam = req.query.q;

  // Handle case where query is missing or not a string
  if (queryParam === undefined || typeof queryParam !== 'string') {
    return res.status(200).json({
      query: '',
      suggestions: []
    });
  }

  const prefix = queryParam.trim();
  const normalizedPrefix = trie.normalize(prefix);

  // Determine target node using Consistent Hashing Ring
  const nodeId = ring.getNode(normalizedPrefix);
  const cacheNode = cacheNodes.get(nodeId)!;

  // Check Cache Hit
  const cachedSuggestions = cacheNode.get<any[]>(normalizedPrefix);

  if (cachedSuggestions !== null) {
    // Cache HIT
    return res.json({
      query: prefix,
      source: 'cache',
      cacheNode: nodeId,
      suggestions: cachedSuggestions
    });
  }

  // Cache MISS -> Query primary Trie
  const results = trie.search(prefix);

  // Write to cache node
  cacheNode.set(normalizedPrefix, results, CACHE_TTL_MS);

  return res.json({
    query: prefix,
    source: 'trie',
    cacheNode: nodeId,
    suggestions: results
  });
});

// API Endpoint: GET /cache/debug
app.get('/cache/debug', (req: Request, res: Response) => {
  const queryParam = req.query.prefix || req.query.q;

  if (queryParam === undefined || typeof queryParam !== 'string') {
    return res.status(400).json({ error: 'Missing parameter: prefix' });
  }

  const prefix = queryParam.trim();
  const normalizedPrefix = trie.normalize(prefix);

  // Determine responsible node
  const nodeId = ring.getNode(normalizedPrefix);
  const cacheNode = cacheNodes.get(nodeId)!;

  // Check hit/miss status without side effects (don't query Trie on miss)
  const cachedValue = cacheNode.get(normalizedPrefix);
  const isHit = cachedValue !== null;

  return res.json({
    prefix: normalizedPrefix,
    nodeId: nodeId,
    status: isHit ? 'HIT' : 'MISS',
    suggestions: isHit ? cachedValue : []
  });
});

// API Endpoint: POST /search
app.post('/search', (req: Request, res: Response) => {
  const query = req.body.q || req.body.query || '';
  if (query) {
    batchWriter.addSearch(query);
  }
  return res.json({ message: 'Searched', query });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', size: DATASET_SIZE });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`Try a search suggestion query: http://localhost:${port}/suggest?q=best`);
});
