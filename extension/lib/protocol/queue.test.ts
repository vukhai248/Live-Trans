import { describe, expect, it } from 'vitest';
import { ConcurrencyQueue } from './queue';

describe('ConcurrencyQueue', () => {
  it('limits concurrent tasks to the configured maximum', async () => {
    const queue = new ConcurrencyQueue(2);
    let active = 0;
    let maxObserved = 0;

    const makeTask = (delayMs: number) => () =>
      queue.run(async () => {
        active++;
        maxObserved = Math.max(maxObserved, active);
        await new Promise((r) => setTimeout(r, delayMs));
        active--;
        return true;
      });

    const results = await Promise.all([
      makeTask(30)(),
      makeTask(30)(),
      makeTask(20)(),
      makeTask(20)(),
    ]);

    expect(results).toEqual([true, true, true, true]);
    expect(maxObserved).toBe(2);
  });

  it('rejects non-positive concurrency', () => {
    expect(() => new ConcurrencyQueue(0)).toThrow();
    expect(() => new ConcurrencyQueue(-1)).toThrow();
  });
});
