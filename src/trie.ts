export interface Suggestion {
  query: string;
  count: number;
  score: number;
  lastUpdated: number;
}

export class TrieNode {
  children: Map<string, TrieNode>;
  suggestions: Suggestion[];
  isEndOfWord: boolean;
  wordCount: number;
  score: number;
  lastUpdated: number;

  constructor() {
    this.children = new Map();
    this.suggestions = [];
    this.isEndOfWord = false;
    this.wordCount = 0;
    this.score = 0;
    this.lastUpdated = Date.now();
  }
}

export class Trie {
  root: TrieNode;
  halfLifeMs: number;

  constructor(halfLifeMs: number = 3600000) { // Default half-life: 1 hour
    this.root = new TrieNode();
    this.halfLifeMs = halfLifeMs;
  }

  /**
   * Normalizes the query string: trims whitespace and converts to lowercase.
   */
  normalize(query: string): string {
    return query.trim().toLowerCase();
  }

  /**
   * Decays a score exponentially based on elapsed time.
   */
  public decay(score: number, lastUpdated: number, now: number): number {
    const elapsed = now - lastUpdated;
    if (elapsed <= 0) return score;
    const lambda = Math.LN2 / this.halfLifeMs;
    return score * Math.exp(-lambda * elapsed);
  }

  /**
   * Inserts or increments a query with its search count.
   * If updating, we calculate the dynamic decay.
   */
  insert(query: string, count: number, timestamp: number = Date.now()): void {
    const normalized = this.normalize(query);
    if (!normalized) return;

    let current = this.root;
    const path: TrieNode[] = [current];

    // 1. Traverse and build/find the path
    for (const char of normalized) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
      path.push(current);
    }

    // 2. Update end node status & score
    current.isEndOfWord = true;
    current.wordCount = count;
    
    // Decay old score of the node and add the count increment
    const decayedOldScore = this.decay(current.score, current.lastUpdated, timestamp);
    current.score = decayedOldScore + count;
    current.lastUpdated = timestamp;

    // 3. Update suggestions at all nodes along the path (including root)
    for (const node of path) {
      this.updateNodeSuggestions(node, normalized, count, timestamp);
    }
  }

  /**
   * Updates the top 10 suggestions list of a specific node by applying time decay to all items.
   */
  private updateNodeSuggestions(node: TrieNode, query: string, count: number, timestamp: number): void {
    const now = timestamp;
    
    // Decay all existing suggestions in this node to the current timestamp
    for (const item of node.suggestions) {
      item.score = this.decay(item.score, item.lastUpdated, now);
      item.lastUpdated = now;
    }

    const existingIndex = node.suggestions.findIndex(s => s.query === query);

    if (existingIndex !== -1) {
      // Add the new search count to the decayed score of existing query
      node.suggestions[existingIndex].score += count;
      node.suggestions[existingIndex].count += count;
    } else {
      // Add new suggestion
      node.suggestions.push({
        query,
        count,
        score: count,
        lastUpdated: now
      });
    }

    // Sort: descending by decayed score, then alphabetically to break ties
    node.suggestions.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.0001) { // Floating point safety
        return b.score - a.score;
      }
      return a.query.localeCompare(b.query);
    });

    // Keep only the top 10 suggestions
    if (node.suggestions.length > 10) {
      node.suggestions.pop();
    }
  }

  /**
   * Searches for a prefix and returns up to 10 suggestions decayed to the current time.
   */
  search(prefix: string, timestamp: number = Date.now()): Suggestion[] {
    const normalized = this.normalize(prefix);
    
    let targetNode = this.root;
    if (normalized) {
      let current = this.root;
      for (const char of normalized) {
        const next = current.children.get(char);
        if (!next) {
          return []; // No matches
        }
        current = next;
      }
      targetNode = current;
    }

    // Return the node's cached suggestions, decayed to the current timestamp
    // Copy the items to avoid mutating the source in-place during search reads
    return targetNode.suggestions.map(item => ({
      query: item.query,
      count: item.count,
      score: this.decay(item.score, item.lastUpdated, timestamp),
      lastUpdated: timestamp
    })).sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.0001) {
        return b.score - a.score;
      }
      return a.query.localeCompare(b.query);
    });
  }

  /**
   * Returns the exact search count frequency of a query in the Trie.
   */
  getWordCount(query: string): number {
    const normalized = this.normalize(query);
    if (!normalized) return 0;

    let current = this.root;
    for (const char of normalized) {
      const next = current.children.get(char);
      if (!next) return 0;
      current = next;
    }

    return current.isEndOfWord ? current.wordCount : 0;
  }
}
