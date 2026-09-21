/* eslint-disable @typescript-eslint/no-var-requires */

type RouteHas = { type: string; key?: string; value?: string };
type Redirect = {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
  has?: RouteHas[];
};

async function loadRedirects(): Promise<Redirect[]> {
  const nextConfig = require('../../next.config.js');
  return nextConfig.redirects();
}

describe('next.config.js redirects', () => {
  it('sends www.readysetllc.com to the apex domain with a permanent (308) redirect', async () => {
    const redirects = await loadRedirects();

    const wwwRedirect = redirects.find((redirect) =>
      redirect.has?.some(
        (has) => has.type === 'host' && has.value === 'www.readysetllc.com'
      )
    );

    expect(wwwRedirect).toBeDefined();
    expect(wwwRedirect?.source).toBe('/:path*');
    expect(wwwRedirect?.destination).toBe('https://readysetllc.com/:path*');
    // `permanent: true` is how Next.js expresses a 308.
    expect(wwwRedirect?.permanent).toBe(true);
  });

  it('applies the canonical host redirect before the marketing redirects', async () => {
    const redirects = await loadRedirects();

    const wwwIndex = redirects.findIndex((redirect) =>
      redirect.has?.some((has) => has.type === 'host')
    );
    const applyIndex = redirects.findIndex(
      (redirect) => redirect.source === '/careers'
    );

    expect(wwwIndex).toBeGreaterThanOrEqual(0);
    expect(applyIndex).toBeGreaterThanOrEqual(0);
    // Otherwise www.readysetllc.com/careers would land on www/apply.
    expect(wwwIndex).toBeLessThan(applyIndex);
  });

  it('keeps the existing hiring redirects intact', async () => {
    const redirects = await loadRedirects();
    const sources = redirects.map((redirect) => redirect.source);

    expect(sources).toEqual(
      expect.arrayContaining([
        '/join-the-team',
        '/join-the-us',
        '/join-the-team/:path*',
        '/join-us',
        '/careers',
      ])
    );
  });
});
