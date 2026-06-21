import { Trie } from './trie';

export class SearchBatchWriter {
  private trie: Trie;
  private maxBatchSize: number;
  private flushIntervalMs: number;
  private buffer: Map<string, number>;
  private intervalId: NodeJS.Timeout | null;
  private onFlushCallback?: (queries: string[]) => void;

  constructor(
    trie: Trie, 
    maxBatchSize: number = 50, 
    flushIntervalMs: number = 5000,
    onFlush?: (queries: string[]) => void
  ) {
    this.trie = trie;
    this.maxBatchSize = maxBatchSize;
    this.flushIntervalMs = flushIntervalMs;
    this.buffer = new Map();
    this.intervalId = null;
    this.onFlushCallback = onFlush;

    this.startInterval();
  }

  /**
   * Adds a search query to the in-memory buffer, incrementing its aggregated frequency.
   * If the number of unique queries in the buffer hits maxBatchSize, a flush is triggered immediately.
   */
  public addSearch(query: string): void {
    const normalized = this.trie.normalize(query);
    if (!normalized) return;

    const currentCount = this.buffer.get(normalized) || 0;
    this.buffer.set(normalized, currentCount + 1);

    if (this.buffer.size >= this.maxBatchSize) {
      console.log(`[BatchWriter] Buffer capacity reached (${this.buffer.size} unique queries). Flushing...`);
      this.flush();
    }
  }

  /**
   * Aggregates frequency counts in memory and performs bulk updates to the Trie.
   */
  public flush(): void {
    if (this.buffer.size === 0) return;

    const start = performance.now();
    const batchToFlush = new Map(this.buffer);
    this.buffer.clear();

    console.log(`[BatchWriter] Flushing batch of ${batchToFlush.size} unique queries to Trie...`);

    const flushedQueries: string[] = [];
    let totalUpdated = 0;
    for (const [query, count] of batchToFlush.entries()) {
      const currentTrieCount = this.trie.getWordCount(query);
      const newTrieCount = currentTrieCount + count;
      this.trie.insert(query, newTrieCount);
      flushedQueries.push(query);
      totalUpdated += count;
    }

    const end = performance.now();
    console.log(`[BatchWriter] Flushed ${totalUpdated} total operations (${batchToFlush.size} unique queries) in ${(end - start).toFixed(2)}ms`);

    // Trigger cache invalidation callback
    if (this.onFlushCallback) {
      this.onFlushCallback(flushedQueries);
    }
  }

  /**
   * Starts the periodic flush timer.
   */
  public startInterval(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Stops the periodic flush timer.
   */
  public stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Gets current size of the buffer for debug or testing.
   */
  public getBufferSize(): number {
    return this.buffer.size;
  }

  /**
   * Clears the current buffer without saving to database.
   */
  public clearBuffer(): void {
    this.buffer.clear();
  }
}
