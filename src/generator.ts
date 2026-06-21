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

/**
 * Generates a realistic mock dataset of queries with frequencies.
 * Uses a Zipfian/power-law distribution for counts to mimic real-world search behavior.
 */
export function generateMockQueries(count: number = 100000): { query: string; count: number }[] {
  const dataset: { query: string; count: number }[] = [];
  const seenQueries = new Set<string>();

  // Ensure we can generate enough unique queries
  // Max possible unique combinations = adjectives.length * nouns.length * suffixes.length
  // 30 * 50 * 30 = 45,000
  // To reach 100,000+, we can use variations:
  // - "noun"
  // - "adj noun"
  // - "noun suffix"
  // - "adj noun suffix"
  // Let's generate them programmatically.

  const queryTemplates: (() => string)[] = [
    // Template 1: noun
    () => getRandomElement(nouns),
    // Template 2: adj + noun
    () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`,
    // Template 3: noun + suffix
    () => `${getRandomElement(nouns)} ${getRandomElement(suffixes)}`,
    // Template 4: adj + noun + suffix
    () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)} ${getRandomElement(suffixes)}`,
    // Template 5: noun + "vs" + noun
    () => `${getRandomElement(nouns)} vs ${getRandomElement(nouns)}`,
    // Template 6: adj + noun + "vs" + adj + noun
    () => `${getRandomElement(adjectives)} ${getRandomElement(nouns)} vs ${getRandomElement(adjectives)} ${getRandomElement(nouns)}`
  ];

  function getRandomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // First generate unique query strings
  let attempts = 0;
  const maxAttempts = count * 10; // Avoid infinite loop if we hit limit
  while (seenQueries.size < count && attempts < maxAttempts) {
    attempts++;
    const template = getRandomElement(queryTemplates);
    const query = template();
    if (!seenQueries.has(query)) {
      seenQueries.add(query);
    }
  }

  // Convert to array and assign frequencies using Zipf's Law: count ~ C / rank^alpha
  const queryList = Array.from(seenQueries);
  // Shuffle to randomize which phrases get high ranks
  shuffleArray(queryList);

  const C = 5_000_000; // Constant factor
  const alpha = 0.75;  // Zipf parameter

  for (let i = 0; i < queryList.length; i++) {
    const rank = i + 1;
    // Calculate realistic search volume
    const searchVolume = Math.max(1, Math.floor(C / Math.pow(rank, alpha)));
    dataset.push({
      query: queryList[i],
      count: searchVolume
    });
  }

  // Sort descending by count to represent the actual rank order in the final output
  return dataset.sort((a, b) => b.count - a.count);
}

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
