import crypto from 'crypto';

export class ConsistentHashRing {
  private replicas: number;
  private ring: Map<number, string>; // hash -> nodeId
  private sortedHashes: number[];

  constructor(replicas: number = 50) {
    this.replicas = replicas;
    this.ring = new Map();
    this.sortedHashes = [];
  }

  /**
   * Generates a 32-bit integer hash from a string using MD5.
   */
  public hash(key: string): number {
    const hex = crypto.createHash('md5').update(key).digest('hex');
    // Take the first 8 characters (32 bits) and parse them as a hex integer
    return parseInt(hex.substring(0, 8), 16);
  }

  /**
   * Adds a logical node to the ring by generating virtual nodes (replicas) for it.
   */
  public addNode(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const virtualNodeName = `${node}-vnode-${i}`;
      const h = this.hash(virtualNodeName);
      this.ring.set(h, node);
      this.sortedHashes.push(h);
    }
    this.sortedHashes.sort((a, b) => a - b);
  }

  /**
   * Removes a logical node and its virtual nodes from the ring.
   */
  public removeNode(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const virtualNodeName = `${node}-vnode-${i}`;
      const h = this.hash(virtualNodeName);
      this.ring.delete(h);
    }
    this.sortedHashes = this.sortedHashes.filter(h => this.ring.has(h));
  }

  /**
   * Returns the responsible logical node ID for a given key.
   */
  public getNode(key: string): string {
    if (this.sortedHashes.length === 0) {
      throw new Error('Hash ring is empty');
    }

    const h = this.hash(key);
    
    // Binary search to find the first hash in sortedHashes that is >= h
    let low = 0;
    let high = this.sortedHashes.length - 1;
    let index = 0;

    if (h > this.sortedHashes[high]) {
      // Wrap around
      index = 0;
    } else {
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.sortedHashes[mid] >= h) {
          index = mid;
          high = mid - 1; // look for smaller matching hash
        } else {
          low = mid + 1;
        }
      }
    }

    const targetHash = this.sortedHashes[index];
    return this.ring.get(targetHash)!;
  }

  /**
   * Gets list of all registered virtual nodes for debug / test analysis.
   */
  public getRingDetails(): { hash: number; node: string }[] {
    return this.sortedHashes.map(h => ({
      hash: h,
      node: this.ring.get(h)!
    }));
  }
}
