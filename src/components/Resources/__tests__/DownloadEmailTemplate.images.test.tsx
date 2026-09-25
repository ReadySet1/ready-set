import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadEmailTemplate } from '../DownloadEmailTemplate';

describe('DownloadEmailTemplate social icons', () => {
  const html = renderToStaticMarkup(
    DownloadEmailTemplate({
      firstName: 'Ada',
      resourceTitle: 'Guide',
      downloadUrl: 'https://readysetllc.com/download/guide',
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
