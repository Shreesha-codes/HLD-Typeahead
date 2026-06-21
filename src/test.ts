import { Trie } from './trie';
import { generateMockQueries } from './generator';
import { ConsistentHashRing } from './consistentHashRing';
import { CacheNode } from './cacheNode';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runTests() {
  console.log('Running Search Typeahead Trie tests...\n');

  // Test 1: Basic Trie Insertion & Search
  const trie = new Trie();
  trie.insert('laptop', 100);
  trie.insert('laptop charger', 250);
  trie.insert('lap desk', 50);

  const lapResults = trie.search('lap');
  assert(lapResults.length === 3, 'Should find all 3 matching queries starting with "lap"');
  assert(lapResults[0].query === 'laptop charger', 'Top suggestion should be "laptop charger" (count 250)');
  assert(lapResults[1].query === 'laptop', 'Second suggestion should be "laptop" (count 100)');
  assert(lapResults[2].query === 'lap desk', 'Third suggestion should be "lap desk" (count 50)');

  // Test 2: Case insensitivity
  const mixedCaseResults = trie.search('LaPtOp');
  assert(mixedCaseResults.length === 2, 'Should find "laptop" and "laptop charger" regardless of query case');
  assert(mixedCaseResults[0].query === 'laptop charger', 'Top suggestions for mixed case query');

  // Test 3: Limits suggestions to 10
  const trie2 = new Trie();
  for (let i = 1; i <= 15; i++) {
    trie2.insert(`query-${i}`, i * 10);
  }
  const suggestionsLimit = trie2.search('query');
  assert(suggestionsLimit.length === 10, 'Suggestions list must be capped at 10 items');
  assert(suggestionsLimit[0].query === 'query-15', 'Highest count item (query-15) must be first');
  assert(suggestionsLimit[9].query === 'query-6', '10th item should be query-6 (count 60)');

  // Test 4: Tie breaker (alphabetical)
  const trie3 = new Trie();
  trie3.insert('apple', 100);
  trie3.insert('apricot', 100);
  trie3.insert('ape', 100);
  const tieResults = trie3.search('ap');
  assert(tieResults.length === 3, 'Should return 3 suggestions for prefix "ap"');
  assert(tieResults[0].query === 'ape', 'Tie breaker should select "ape" first alphabetically');
  assert(tieResults[1].query === 'apple', 'Tie breaker should select "apple" second alphabetically');
  assert(tieResults[2].query === 'apricot', 'Tie breaker should select "apricot" third');

  // Test 5: Empty prefix
  // Empty prefix should return top overall suggestions cached at root
  const rootSuggestions = trie3.search('');
  assert(rootSuggestions.length === 3, 'Empty prefix should return cached root suggestions');
  assert(rootSuggestions[0].query === 'ape', 'Root should have ape (first alphabetically among equal counts)');

  // Test 6: Ingest data generator check
  console.log('\nTesting Mock Data Generator...');
  const mockDataset = generateMockQueries(1000);
  assert(mockDataset.length === 1000, 'Generator should produce exact count requested');
  assert(mockDataset[0].count >= mockDataset[999].count, 'Mock dataset should be pre-sorted descending by count');

  // Test 7: Consistent Hashing Ring test
  console.log('\nTesting Consistent Hashing Ring...');
  const ring = new ConsistentHashRing(50);
  const nodes = ['node-1', 'node-2', 'node-3', 'node-4'];
  nodes.forEach(n => ring.addNode(n));

  const target1 = ring.getNode('hello');
  const target2 = ring.getNode('hello');
  assert(target1 === target2, 'Same key should consistently route to same node');

  // Check key distribution across nodes to prove virtual nodes work
  const distribution: { [node: string]: number } = {};
  nodes.forEach(n => { distribution[n] = 0; });

  for (let i = 0; i < 2000; i++) {
    const node = ring.getNode(`query-string-prefix-${i}`);
    distribution[node]++;
  }

  console.log('Key Distribution across 4 nodes for 2000 keys:');
  nodes.forEach(n => {
    const share = ((distribution[n] / 2000) * 100).toFixed(1);
    console.log(`  - ${n}: ${distribution[n]} keys (${share}%)`);
    assert(distribution[n] > 300, `Node ${n} should receive a fair share of keys (got ${distribution[n]})`);
  });

  // Test 8: Cache Node with TTL
  console.log('\nTesting Cache Node Expiration...');
  const cacheNode = new CacheNode('test-node');
  cacheNode.set('key-1', { data: 'test-value' }, 50); // 50ms TTL

  assert(cacheNode.get<{ data: string }>('key-1')?.data === 'test-value', 'Cache should hit immediately after setting');

  // Force synchronous sleep to wait for TTL expiration
  const start = Date.now();
  while (Date.now() - start < 70) {
    // wait 70ms
  }

  assert(cacheNode.get('key-1') === null, 'Cache should return null (MISS) after TTL expiration');

  console.log('\nAll unit tests passed successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (error: any) {
  console.error('\nTest execution failed:', error.message);
  process.exit(1);
}
