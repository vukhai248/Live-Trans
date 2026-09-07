import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays execution until after waitMs has passed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('collapses multiple rapid calls into a single execution with latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced('call 1');
    vi.advanceTimersByTime(200);
    debounced('call 2');
    vi.advanceTimersByTime(200);
    debounced('call 3');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('call 3');
  });

  it('cancels pending execution when cancel() is called', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced();
    vi.advanceTimersByTime(200);
    debounced.cancel();

    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
