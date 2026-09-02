/**
 * Lightweight concurrency limiter / task queue for controlling in-flight
 * API requests (docs/plan.md §6: maximum 2 ASR + 2 translate in-flight).
 */
export class ConcurrencyQueue {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(public readonly maxConcurrency: number) {
    if (maxConcurrency <= 0) {
      throw new Error('maxConcurrency must be greater than 0');
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }

  clear(): void {
    this.queue = [];
  }
}
