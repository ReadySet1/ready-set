import { renderHook, act } from '@testing-library/react';
import { useControllableState } from '../use-controllable-state';

describe('useControllableState', () => {
  describe('uncontrolled mode', () => {
    it('should use defaultProp as initial value', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 'initial' })
      );

      const [value] = result.current;
      expect(value).toBe('initial');
    });

    it('should update value with setValue', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 'initial' })
      );

      act(() => {
        const [, setValue] = result.current;
        setValue('updated');
      });

      const [value] = result.current;
      expect(value).toBe('updated');
    });

    it('should call onChange when value changes', () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 'initial', onChange })
      );

      act(() => {
        const [, setValue] = result.current;
        setValue('updated');
      });

      expect(onChange).toHaveBeenCalledWith('updated');
    });

    it('should handle functional updates', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 0 })
      );

      act(() => {
        const [, setValue] = result.current;
        setValue((prev) => (prev || 0) + 1);
      });

      const [value] = result.current;
      expect(value).toBe(1);
    });

    it('should return undefined if no defaultProp', () => {
      const { result } = renderHook(() =>
        useControllableState({})
      );

      const [value] = result.current;
      expect(value).toBeUndefined();
    });
  });

  describe('controlled mode', () => {
    it('should use prop as value', () => {
      const { result } = renderHook(() =>
        useControllableState({ prop: 'controlled' })
      );

      const [value] = result.current;
      expect(value).toBe('controlled');
    });

    it('should not update internal state in controlled mode', () => {
      const onChange = jest.fn();
      const { result, rerender } = renderHook(
        ({ prop }) => useControllableState({ prop, onChange }),
        { initialProps: { prop: 'controlled' } }
      );

      act(() => {
        const [, setValue] = result.current;
        setValue('new value');
      });

      // Value should still be the controlled prop
      const [value] = result.current;
      expect(value).toBe('controlled');

      // But onChange should have been called
      expect(onChange).toHaveBeenCalledWith('new value');
    });

    it('should reflect prop changes', () => {
      const { result, rerender } = renderHook(
        ({ prop }) => useControllableState({ prop }),
        { initialProps: { prop: 'initial' } }
      );

      expect(result.current[0]).toBe('initial');

      rerender({ prop: 'updated' });

      expect(result.current[0]).toBe('updated');
    });

    it('should not call onChange when value is same as prop', () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useControllableState({ prop: 'same', onChange })
      );

      act(() => {
        const [, setValue] = result.current;
        setValue('same');
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should handle functional updates in controlled mode', () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        useControllableState({ prop: 5, onChange })
      );

      act(() => {
        const [, setValue] = result.current;
        setValue((prev) => (prev || 0) + 1);
      });

      expect(onChange).toHaveBeenCalledWith(6);
    });
  });

  describe('type handling', () => {
    it('should handle string values', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 'string' })
      );

      expect(result.current[0]).toBe('string');
    });

    it('should handle number values', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 42 })
      );

      expect(result.current[0]).toBe(42);
    });

    it('should handle boolean values', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: true })
      );

      expect(result.current[0]).toBe(true);
    });

    it('should handle object values', () => {
      const obj = { name: 'test', count: 1 };
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: obj })
      );

      expect(result.current[0]).toEqual(obj);
    });

    it('should handle array values', () => {
      const arr = [1, 2, 3];
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: arr })
      );

      expect(result.current[0]).toEqual(arr);
    });
  });

  describe('edge cases', () => {
    it('should handle switching from uncontrolled to controlled', () => {
      const { result, rerender } = renderHook(
        ({ prop }) => useControllableState({ prop, defaultProp: 'default' }),
        { initialProps: { prop: undefined as string | undefined } }
      );

      // Uncontrolled - uses default
      expect(result.current[0]).toBe('default');

      // Switch to controlled
      rerender({ prop: 'controlled' });
      expect(result.current[0]).toBe('controlled');
    });

    it('should handle null values', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: null as string | null })
      );

      expect(result.current[0]).toBeNull();
    });

    it('should not call onChange if not provided', () => {
      const { result } = renderHook(() =>
        useControllableState({ defaultProp: 'initial' })
      );

      // Should not throw
      expect(() => {
        act(() => {
          const [, setValue] = result.current;
          setValue('updated');
        });
      }).not.toThrow();
    });
  });
});
