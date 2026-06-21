import { Trie } from './trie';

const adjectives = [
  'best', 'top', 'free', 'online', 'easy', 'simple', 'fast', 'quick', 'cheap', 'latest',
  'new', 'cool', 'smart', 'secure', 'modern', 'awesome', 'amazing', 'perfect', 'local', 'global',
  'digital', 'premium', 'pro', 'classic', 'luxury', 'essential', 'basic', 'creative', 'popular', 'healthy'
];

const nouns = [
  'laptop', 'phone', 'course', 'tutorial', 'recipe', 'game', 'movie', 'song', 'book', 'car',
  'bike', 'house', 'job', 'hotel', 'flight', 'restaurant', 'coffee', 'pizza', 'shoes', 'bag',
  'watch', 'camera', 'software', 'tool', 'service', 'app', 'website', 'guide', 'tips', 'ideas',
  'music', 'art', 'clothing', 'furniture', 'gift', 'toy', 'card', 'computer', 'keyboard', 'mouse',
  'monitor', 'headphone', 'speaker', 'table', 'chair', 'desk', 'bed', 'pillow', 'backpack', 'wallet'
];

const suffixes = [
  'for beginners', 'near me', 'under 100', 'with reviews', 'for kids', 'for sale', 'download',
  'reviews', 'price', 'deals', 'comparison', 'specs', 'guide', 'setup', 'tutorial', 'examples',
  'templates', 'solutions', 'classes', 'services', 'tools', 'resources', 'ideas', 'strategies',
  'checklist', 'tricks', 'hacks', 'questions', 'answers', 'support'
];

const queryTemplates: (() => string)[] = [
  () => getRandomElement(nouns),
  () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`,
  () => `${getRandomElement(nouns)} ${getRandomElement(suffixes)}`,
  () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)} ${getRandomElement(suffixes)}`,
  () => `${getRandomElement(nouns)} vs ${getRandomElement(nouns)}`,
  () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)} vs ${getRandomElement(adjectives)} ${getRandomElement(nouns)}`
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a realistic mock dataset of queries with frequencies.
 * Keeps memory low by generating and returning the dataset directly.
 */
export function generateMockQueries(count: number = 100000): { query: string; count: number }[] {
  const dataset: { query: string; count: number }[] = [];
  const seenQueries = new Set<string>();

  let attempts = 0;
  const maxAttempts = count * 10;
  while (seenQueries.size < count && attempts < maxAttempts) {
    attempts++;
    const query = getRandomElement(queryTemplates)();
    if (!seenQueries.has(query)) {
      seenQueries.add(query);
    }
  }

  const queryList = Array.from(seenQueries);
  const C = 5_000_000;
  const alpha = 0.75;

  for (let i = 0; i < queryList.length; i++) {
    dataset.push({
      query: queryList[i],
      count: Math.max(1, Math.floor(C / Math.pow(i + 1, alpha)))
    });
  }

  return dataset;
}

/**
 * Memory-optimized direct ingestion helper.
 * Generates queries on-the-fly and inserts them directly into the Trie
 * to avoid allocating massive temporary arrays, preventing Out-Of-Memory (OOM) crashes.
 */
export function ingestQueriesDirectly(trie: Trie, count: number): void {
  const seenQueries = new Set<string>();
  const C = 5_000_000;
  const alpha = 0.75;

  let i = 0;
  let attempts = 0;
  const maxAttempts = count * 10;

  while (i < count && attempts < maxAttempts) {
    attempts++;
    const query = getRandomElement(queryTemplates)();
    if (!seenQueries.has(query)) {
      seenQueries.add(query);
      const rank = i + 1;
      const searchVolume = Math.max(1, Math.floor(C / Math.pow(rank, alpha)));
      trie.insert(query, searchVolume);
      i++;
    }
  }
}
