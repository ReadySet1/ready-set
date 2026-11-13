/**
 * @jest-environment jsdom
 */
import {
  isSafeInternalPath,
  navigateAfterSignIn,
  signedInDestination,
} from '../post-sign-in';

const mockIsNative = jest.fn();
jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  isCapacitorNative: () => mockIsNative(),
}));

describe('post-sign-in navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative.mockReturnValue(false);
  });

  describe('on plain web (unchanged behavior)', () => {
    it.each(['/driver', '/admin', '/force-password-change', '/client?tab=orders'])(
      'goes straight to %s',
      (redirectTo) => {
        expect(signedInDestination(redirectTo)).toBe(redirectTo);
      },
    );

    it('falls back to / when the action returned no destination', () => {
      expect(signedInDestination('')).toBe('/');
    });
  });

  describe('inside the native shell', () => {
    beforeEach(() => mockIsNative.mockReturnValue(true));

    it('sends the driver home through /native-launch instead of a full load of /driver', () => {
      expect(signedInDestination('/driver')).toBe('/native-launch');
    });

    it('carries any other destination as ?next= so it is not lost', () => {
      expect(signedInDestination('/force-password-change')).toBe(
        '/native-launch?next=%2Fforce-password-change',
      );
      expect(signedInDestination('/driver/deliveries/abc')).toBe(
        '/native-launch?next=%2Fdriver%2Fdeliveries%2Fabc',
      );
    });

    it.each([
      '',
      '/',
      '//evil.example',
      'https://evil.example/driver',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
    ])(
      'drops an empty or off-site destination %p and lands on plain /native-launch',
      (redirectTo) => {
        expect(signedInDestination(redirectTo)).toBe('/native-launch');
      },
    );
  });

  describe('navigateAfterSignIn', () => {
    it('full-loads the web destination outside the shell', () => {
      const navigate = jest.fn();
      navigateAfterSignIn('/driver', navigate);
      expect(navigate).toHaveBeenCalledWith('/driver');
    });

    it('full-loads /native-launch inside the shell', () => {
      mockIsNative.mockReturnValue(true);
      const navigate = jest.fn();
      navigateAfterSignIn('/driver', navigate);
      expect(navigate).toHaveBeenCalledWith('/native-launch');
    });
  });

  describe('isSafeInternalPath', () => {
    it.each(['/driver', '/force-password-change', '/a?b=c', '/a#section'])('accepts %s', (path) => {
      expect(isSafeInternalPath(path)).toBe(true);
    });

    // URL parsing strips tab/LF/CR, so `/\t/host` resolves to `//host` (off-site).
    it.each([
      null,
      undefined,
      '',
      'driver',
      '//evil.example',
      '/\\evil.example',
      'https://x.y',
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r/evil.example',
      '/\t\\evil.example',
      '/\u0000/evil.example',
      '/ /evil.example',
    ])(
      'rejects %p',
      (path) => {
        expect(isSafeInternalPath(path)).toBe(false);
      },
    );
  });
});
