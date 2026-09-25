import { generateEmailHeader } from '../email-templates';

describe('generateEmailHeader logo', () => {
  const srcOf = (html: string) => /<img[^>]*src="([^"]+)"/.exec(html)?.[1] ?? '';

  it('serves the logo from Cloudinary as an explicit PNG', () => {
    const src = srcOf(generateEmailHeader('Test'));
    expect(src).toMatch(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_png\/ready-set\/logo\/full-logo-dark$/);
  });

  it('does not point at the www host, which now redirects and has no /images folder', () => {
    expect(generateEmailHeader('Test')).not.toContain('www.readysetllc.com/images');
  });
});
