import { validateDownloadUrl } from '../DownloadEmailTemplate';

describe('validateDownloadUrl', () => {
  it('allows Uploadfly (ufs.sh) URLs and encodes them', () => {
    const url = 'https://jdjlkt28jx.ufs.sh/f/some-resource';
    const result = validateDownloadUrl(url);
    expect(result).not.toBe('#');
    expect(result).toContain('jdjlkt28jx.ufs.sh');
  });

  it('allows cdn.sanity.io URLs', () => {
    const url = 'https://cdn.sanity.io/files/abc123/production/document.pdf';
    const result = validateDownloadUrl(url);
    expect(result).not.toBe('#');
    expect(result).toContain('cdn.sanity.io');
  });

  it('blocks the parked ready-set.co domain', () => {
    expect(validateDownloadUrl('https://ready-set.co/x')).toBe('#');
  });

  it('blocks arbitrary external domains', () => {
    expect(validateDownloadUrl('https://evil.com/x')).toBe('#');
  });

  it('blocks javascript: protocol URLs', () => {
    expect(validateDownloadUrl('javascript:alert(1)')).toBe('#');
  });

  it('blocks malformed URLs', () => {
    expect(validateDownloadUrl('not-a-url')).toBe('#');
  });

  it('blocks empty string', () => {
    expect(validateDownloadUrl('')).toBe('#');
  });
});
