import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

jest.useFakeTimers();

/**
 * TODO: REA-211 - useDebounce tests have fake timer issues
 */
describe.skip('useDebounce', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now the value should be updated
    expect(result.current).toBe('updated');
  });

  it('cancels previous timeout on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 'initial' },
      }
    );

    // Rapid updates
    rerender({ value: 'first' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'second' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'third' });

    // Only 200ms passed, value should still be initial
    expect(result.current).toBe('initial');

    // Advance to 300ms from last update
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should have the last value
    expect(result.current).toBe('third');
  });

  it('works with different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('handles object values', () => {
    const initialObj = { name: 'John', age: 30 };
    const updatedObj = { name: 'Jane', age: 25 };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: initialObj },
      }
    );

    expect(result.current).toBe(initialObj);

    rerender({ value: updatedObj });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(updatedObj);
  });

  it('handles null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: null as string | null },
      }
    );

    expect(result.current).toBe(null);

    rerender({ value: 'test' });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('test');

    rerender({ value: undefined as string | undefined });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe(undefined);
  });

  it('cleans up timeout on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 'initial' },
      }
    );

    rerender({ value: 'updated' });

    // Unmount before timeout completes
    unmount();

    // Advance time - this should not cause any issues
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // If cleanup wasn't working, this could cause a memory leak or error
    // The test passing means cleanup is working correctly
  });

  it('uses default delay of 300ms when not specified', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: 'initial' },
      }
    );

    rerender({ value: 'updated' });

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });
});
