import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadEmailTemplate } from '../DownloadEmailTemplate';

describe('DownloadEmailTemplate social icons', () => {
  const html = renderToStaticMarkup(
    DownloadEmailTemplate({
      firstName: 'Ada',
      resourceTitle: 'Guide',
      downloadUrl: 'https://jdjlkt28jx.ufs.sh/f/test',
      userEmail: 'ada@example.com',
    }) as React.ReactElement,
  );
  const imgSrcs = Array.from(html.matchAll(/<img[^>]*src="([^"]+)"/g), (m) => m[1]);
  const social = imgSrcs.filter((s) => /social\//.test(s));

  it('renders the four social icons from Cloudinary', () => {
    expect(social).toHaveLength(4);
    for (const s of social) {
      expect(s).toMatch(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_png\/ready-set\/social\/[1-4]$/);
    }
  });

  it('does not reference the site /images folder, which returns 404', () => {
    expect(html).not.toContain('readysetllc.com/images/');
  });
});

describe('DownloadEmailTemplate logo', () => {
  const html = renderToStaticMarkup(
    DownloadEmailTemplate({
      firstName: 'Ada',
      resourceTitle: 'Guide',
      downloadUrl: 'https://jdjlkt28jx.ufs.sh/f/test',
      userEmail: 'ada@example.com',
    }) as React.ReactElement,
  );
  const imgSrcs = Array.from(html.matchAll(/<img[^>]*src="([^"]+)"/g), (m) => m[1]);

  it('serves the header logo from Cloudinary as an explicit PNG', () => {
    const logo = imgSrcs.find((s) => /logo/.test(s) && /full-logo-dark/.test(s));
    expect(logo).toMatch(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_png\/ready-set\/logo\/full-logo-dark$/);
  });

  it('does not contain ready-set.co anywhere in the rendered HTML', () => {
    expect(html).not.toContain('ready-set.co');
  });

  it('renders the download button with the provided URL', () => {
    const hrefMatch = html.match(/href="([^"]*)"[^>]*>Download Guide</);
    expect(hrefMatch).not.toBeNull();
    // The URL is HTML-encoded by the `he` library but should resolve to the original
    expect(hrefMatch![1]).toBe('https://jdjlkt28jx.ufs.sh/f/test');
  });
});
