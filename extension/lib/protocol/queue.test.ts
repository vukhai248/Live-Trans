import { describe, expect, it } from 'vitest';
import { ConcurrencyQueue, QueueCancelledError } from './queue';

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

  it('rejects pending queued tasks with QueueCancelledError when clear() is called', async () => {
    const queue = new ConcurrencyQueue(1);
    let task1Started = false;
    let task1Finished = false;
    let task2Started = false;

    // Task 1 runs immediately and takes 50ms
    const p1 = queue.run(async () => {
      task1Started = true;
      await new Promise((r) => setTimeout(r, 50));
      task1Finished = true;
      return 'task1-ok';
    });

    // Task 2 is queued waiting for task 1
    const p2 = queue.run(async () => {
      task2Started = true;
      return 'task2-ok';
    });

    expect(queue.pendingCount).toBe(1);
    expect(queue.activeCount).toBe(1);

    // Cancel / clear the queue while task 1 is running and task 2 is waiting
    queue.clear('Session stopped');

    expect(queue.pendingCount).toBe(0);

    // Task 2 must reject with QueueCancelledError instead of hanging forever
    await expect(p2).rejects.toThrow(QueueCancelledError);
    expect(task2Started).toBe(false);

    // Task 1 was already running so it finishes normally
    const res1 = await p1;
    expect(res1).toBe('task1-ok');
    expect(task1Started).toBe(true);
    expect(task1Finished).toBe(true);
  });

  it('allows new tasks to run smoothly after clear()', async () => {
    const queue = new ConcurrencyQueue(1);

    // Start a task and clear
    const p1 = queue.run(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 1;
    });
    const p2 = queue.run(async () => 2);
    queue.clear();
    await expect(p2).rejects.toThrow(QueueCancelledError);
    await p1;

    // After clear, queue is completely operational
    const res = await queue.run(async () => 'fresh-task');
    expect(res).toBe('fresh-task');
    expect(queue.activeCount).toBe(0);
    expect(queue.pendingCount).toBe(0);
  });
});
