/**
 * Lightweight concurrency limiter / task queue for controlling in-flight
 * API requests (docs/plan.md §6: maximum 2 ASR + 2 translate in-flight).
 */

export class QueueCancelledError extends Error {
  constructor(message = 'Queue cleared / task cancelled') {
    super(message);
    this.name = 'QueueCancelledError';
  }
}

interface PendingQueueItem {
  resolve: () => void;
  reject: (err: Error) => void;
}

export class ConcurrencyQueue {
  private running = 0;
  private queue: PendingQueueItem[] = [];

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
      await new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject });
      });
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.resolve();
      }
    }
  }

  /**
   * Clears all pending (waiting) tasks in the queue and rejects their promises
   * with a QueueCancelledError so callers can cleanly release allocated buffers.
   */
  clear(reason?: string): void {
    const error = new QueueCancelledError(reason);
    const pending = this.queue;
    this.queue = [];
    for (const item of pending) {
      item.reject(error);
    }
  }
}
