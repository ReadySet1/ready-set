/**
 * DELETE /api/testimonials wiped every row and had no caller; the method is
 * removed rather than gated. GET remains public (marketing site).
 */
import * as route from '../route';

describe('/api/testimonials', () => {
  it('exposes GET', () => {
    expect(typeof route.GET).toBe('function');
  });

  it('no longer exposes DELETE', () => {
    expect((route as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
