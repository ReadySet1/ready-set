import { renderHook } from '@testing-library/react';
import { useCallbackRef } from '../use-callback-ref';

describe('useCallbackRef', () => {
  it('should return a stable function reference', () => {
    const callback = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useCallbackRef(cb),
      { initialProps: { cb: callback } }
    );

    const firstRef = result.current;

    // Rerender with same callback
    rerender({ cb: callback });

    // Reference should be stable
    expect(result.current).toBe(firstRef);
  });

  it('should call the latest callback', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    const { result, rerender } = renderHook(
      ({ cb }) => useCallbackRef(cb),
      { initialProps: { cb: callback1 } }
    );

    // Call with first callback
    result.current('arg1');
    expect(callback1).toHaveBeenCalledWith('arg1');
    expect(callback2).not.toHaveBeenCalled();

    // Update callback
    rerender({ cb: callback2 });

    // Call with updated callback (reference is same but calls new callback)
    result.current('arg2');
    expect(callback2).toHaveBeenCalledWith('arg2');
    expect(callback1).toHaveBeenCalledTimes(1); // Still only called once
  });

  it('should handle undefined callback', () => {
    const { result } = renderHook(() => useCallbackRef(undefined));

    // Should not throw when called
    expect(() => result.current()).not.toThrow();
  });

  it('should pass multiple arguments to callback', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useCallbackRef(callback));

    result.current('arg1', 'arg2', 'arg3');
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should return callback result', () => {
    const callback = jest.fn().mockReturnValue('result');
    const { result } = renderHook(() => useCallbackRef(callback));

    const returnValue = result.current();
    expect(returnValue).toBe('result');
  });

  it('should maintain reference across multiple rerenders', () => {
    const callback = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useCallbackRef(cb),
      { initialProps: { cb: callback } }
    );

    const initialRef = result.current;

    // Multiple rerenders
    for (let i = 0; i < 10; i++) {
      rerender({ cb: jest.fn() });
    }

    // Reference should still be same
    expect(result.current).toBe(initialRef);
  });

  it('should handle async callbacks', async () => {
    const asyncCallback = jest.fn().mockResolvedValue('async result');
    const { result } = renderHook(() => useCallbackRef(asyncCallback));

    const promise = result.current();
    await expect(promise).resolves.toBe('async result');
  });

  it('should handle callbacks that throw', () => {
    const throwingCallback = jest.fn().mockImplementation(() => {
      throw new Error('callback error');
    });

    const { result } = renderHook(() => useCallbackRef(throwingCallback));

    expect(() => result.current()).toThrow('callback error');
  });
});
