import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadEmailTemplate } from '../DownloadEmailTemplate';
import { siteUrl } from '@/lib/site-url';

const TEST_SITE_URL = 'https://test.readysetllc.com';

describe('DownloadEmailTemplate footer links', () => {
  let originalSiteUrl: string | undefined;

  beforeEach(() => {
    originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = TEST_SITE_URL;
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  const render = () =>
    renderToStaticMarkup(
      DownloadEmailTemplate({
        firstName: 'Ada',
        resourceTitle: 'Guide',
        downloadUrl: 'https://jdjlkt28jx.ufs.sh/f/test',
        userEmail: 'ada@example.com',
      }) as React.ReactElement,
    );

  it('links the consultation button to siteUrl("/contact")', () => {
    const html = render();
    expect(html).toContain(`href="${siteUrl('/contact')}"`);
  });

  it('links the unsubscribe text to siteUrl("/unsubscribe")', () => {
    const html = render();
    expect(html).toContain(`href="${siteUrl('/unsubscribe')}"`);
  });

  it('links the privacy policy text to siteUrl("/privacy-policy")', () => {
    const html = render();
    expect(html).toContain(`href="${siteUrl('/privacy-policy')}"`);
  });
});
