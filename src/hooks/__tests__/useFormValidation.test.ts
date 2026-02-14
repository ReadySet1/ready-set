import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';

describe('useFormValidation', () => {
  it('should initialize with empty errors', () => {
    const { result } = renderHook(() => useFormValidation());

    expect(result.current.errors).toEqual([]);
  });

  it('should return false and add error when password is too short', () => {
    const { result } = renderHook(() => useFormValidation());

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm('Ab1!');
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors).toContain(
      'Password must be at least 8 characters long'
    );
  });

  it('should return false when password has no uppercase letter', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('abcdefg1!');
    });

    expect(result.current.errors).toContain(
      'Password must contain at least one uppercase letter'
    );
  });

  it('should return false when password has no lowercase letter', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('ABCDEFG1!');
    });

    expect(result.current.errors).toContain(
      'Password must contain at least one lowercase letter'
    );
  });

  it('should return false when password has no number', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('Abcdefgh!');
    });

    expect(result.current.errors).toContain(
      'Password must contain at least one number'
    );
  });

  it('should return false when password has no special character', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('Abcdefg1');
    });

    expect(result.current.errors).toContain(
      'Password must contain at least one special character'
    );
  });

  it('should return true and clear errors for a valid password', () => {
    const { result } = renderHook(() => useFormValidation());

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm('Abcdef1!');
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual([]);
  });

  it('should accumulate multiple errors for a completely invalid password', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('abc');
    });

    // Too short, no uppercase, no number, no special char
    expect(result.current.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.current.errors).toContain(
      'Password must be at least 8 characters long'
    );
    expect(result.current.errors).toContain(
      'Password must contain at least one uppercase letter'
    );
    expect(result.current.errors).toContain(
      'Password must contain at least one number'
    );
    expect(result.current.errors).toContain(
      'Password must contain at least one special character'
    );
  });

  it('should clear previous errors on re-validation', () => {
    const { result } = renderHook(() => useFormValidation());

    act(() => {
      result.current.validateForm('abc');
    });

    expect(result.current.errors.length).toBeGreaterThan(0);

    act(() => {
      result.current.validateForm('Abcdef1!');
    });

    expect(result.current.errors).toEqual([]);
  });
});
