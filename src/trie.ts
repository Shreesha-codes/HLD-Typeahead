export interface Suggestion {
  query: string;
  count: number;
}

export class TrieNode {
  children: Map<string, TrieNode>;
  suggestions: Suggestion[];
  isEndOfWord: boolean;
  wordCount: number; // stores the count if this node is the end of a word

  constructor() {
    this.children = new Map();
    this.suggestions = [];
    this.isEndOfWord = false;
    this.wordCount = 0;
  }
}

export class Trie {
  root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Normalizes the query string: trims whitespace and converts to lowercase.
   */
  normalize(query: string): string {
    return query.trim().toLowerCase();
  }

  /**
   * Inserts a query with its search count into the Trie.
   * Updates the pre-computed top suggestions for all nodes along the insertion path.
   */
  insert(query: string, count: number): void {
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

    // Update the end node status
    current.isEndOfWord = true;
    current.wordCount = count;

    // 2. Update suggestions at all nodes along the path (including root)
    for (const node of path) {
      this.updateNodeSuggestions(node, normalized, count);
    }
  }

  /**
   * Updates the top 10 suggestions list of a specific node.
   */
  private updateNodeSuggestions(node: TrieNode, query: string, count: number): void {
    const existingIndex = node.suggestions.findIndex(s => s.query === query);

    if (existingIndex !== -1) {
      // Update count of existing suggestion
      node.suggestions[existingIndex].count = count;
    } else {
      // Add new suggestion
      node.suggestions.push({ query, count });
    }

    // Sort: descending by count, then alphabetically to break ties
    node.suggestions.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.query.localeCompare(b.query);
    });

    // Keep only the top 10 suggestions
    if (node.suggestions.length > 10) {
      node.suggestions.pop();
    }
  }

  /**
   * Searches for a prefix and returns up to 10 suggestions sorted by count.
   */
  search(prefix: string): Suggestion[] {
    const normalized = this.normalize(prefix);
    
    // For empty prefix, return the top overall suggestions cached at the root node
    if (!normalized) {
      return this.root.suggestions;
    }

    let current = this.root;
    for (const char of normalized) {
      const next = current.children.get(char);
      if (!next) {
        return []; // No matches for this prefix
      }
      current = next;
    }

    return current.suggestions;
  }
}
