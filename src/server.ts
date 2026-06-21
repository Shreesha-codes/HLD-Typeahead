import express, { Request, Response } from 'express';
import cors from 'cors';
import { Trie } from './trie';
import { generateMockQueries } from './generator';

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

  // If query is empty, return top overall suggestions cached at the root
  // (Handling edge case gracefully: empty strings)
  const results = trie.search(prefix);

  return res.json({
    query: prefix,
    suggestions: results
  });
});

// API Endpoint: POST /search
app.post('/search', (req: Request, res: Response) => {
  const query = req.body.q || req.body.query || '';
  console.log(`[Search Request] Query: "${query}"`);
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
