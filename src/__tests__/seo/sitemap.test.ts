/**
 * @jest-environment node
 */
import sitemap from '../../app/sitemap';

// Mock environment variable
const mockEnv = {
  NEXT_PUBLIC_SITE_URL: 'https://readysetllc.com'
};

describe('Sitemap Generation', () => {
  beforeEach(() => {
    // Mock process.env
    Object.defineProperty(process, 'env', {
      value: mockEnv,
      writable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate a sitemap with all expected URLs', () => {
    const sitemapData = sitemap();
    
    expect(Array.isArray(sitemapData)).toBe(true);
    expect(sitemapData.length).toBeGreaterThan(0);
    
    // Check that all expected URLs are present
    const urls = sitemapData.map(entry => entry.url);
    
    // Static pages
    expect(urls).toContain('https://readysetllc.com');
    expect(urls).toContain('https://readysetllc.com/about');
    expect(urls).toContain('https://readysetllc.com/contact');
    expect(urls).toContain('https://readysetllc.com/features');
    expect(urls).toContain('https://readysetllc.com/apply');
    
    // Service pages
    expect(urls).toContain('https://readysetllc.com/catering-deliveries');
    expect(urls).toContain('https://readysetllc.com/bakery-deliveries');
    expect(urls).toContain('https://readysetllc.com/flowers-deliveries');
    expect(urls).toContain('https://readysetllc.com/logistics');
    expect(urls).toContain('https://readysetllc.com/specialty-deliveries');
    expect(urls).toContain('https://readysetllc.com/on-demand');
    expect(urls).toContain('https://readysetllc.com/virtual-assistant');
    
    // Additional pages
    expect(urls).toContain('https://readysetllc.com/blog');
    expect(urls).toContain('https://readysetllc.com/free-resources');
    expect(urls).toContain('https://readysetllc.com/catering-request');
    expect(urls).toContain('https://readysetllc.com/addresses');
  });

  it('should set correct priorities for different page types', () => {
    const sitemapData = sitemap();
    
    // Home page should have highest priority
    const homePage = sitemapData.find(entry => entry.url === 'https://readysetllc.com');
    expect(homePage?.priority).toBe(1);
    
    // Service pages should have high priority (0.9)
    const servicePage = sitemapData.find(entry => entry.url === 'https://readysetllc.com/catering-deliveries');
    expect(servicePage?.priority).toBe(0.9);
    
    // About/Contact pages should have medium priority (0.8)
    const aboutPage = sitemapData.find(entry => entry.url === 'https://readysetllc.com/about');
    expect(aboutPage?.priority).toBe(0.8);
    
    // Blog should have lower priority (0.7)
    const blogPage = sitemapData.find(entry => entry.url === 'https://readysetllc.com/blog');
    expect(blogPage?.priority).toBe(0.7);
  });

  it('should set appropriate change frequencies', () => {
    const sitemapData = sitemap();
    
    // Home page should change weekly
    const homePage = sitemapData.find(entry => entry.url === 'https://readysetllc.com');
    expect(homePage?.changeFrequency).toBe('weekly');
    
    // Service pages should change weekly
    const servicePage = sitemapData.find(entry => entry.url === 'https://readysetllc.com/logistics');
    expect(servicePage?.changeFrequency).toBe('weekly');
    
    // Static pages should change monthly
    const aboutPage = sitemapData.find(entry => entry.url === 'https://readysetllc.com/about');
    expect(aboutPage?.changeFrequency).toBe('monthly');
  });

  it('should handle different base URLs correctly', () => {
    // Test with different base URL
    Object.defineProperty(process, 'env', {
      value: { NEXT_PUBLIC_SITE_URL: 'https://example.com/' },
      writable: true
    });
    
    const sitemapData = sitemap();
    const urls = sitemapData.map(entry => entry.url);
    
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://example.com/about');
    expect(urls).toContain('https://example.com/catering-deliveries');
  });

  it('should handle missing base URL with fallback', () => {
    // Test with no base URL
    Object.defineProperty(process, 'env', {
      value: {},
      writable: true
    });
    
    const sitemapData = sitemap();
    const urls = sitemapData.map(entry => entry.url);
    
    expect(urls).toContain('https://readysetllc.com');
    expect(urls).toContain('https://readysetllc.com/about');
  });

  it('should include lastModified date for all entries', () => {
    const sitemapData = sitemap();
    
    sitemapData.forEach(entry => {
      expect(entry.lastModified).toBeDefined();
      expect(typeof entry.lastModified).toBe('string');
      if (entry.lastModified) {
        expect(new Date(entry.lastModified).toISOString()).toBe(entry.lastModified);
      }
    });
  });

  it('should have valid MetadataRoute.Sitemap structure', () => {
    const sitemapData = sitemap();
    
    sitemapData.forEach(entry => {
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('lastModified');
      expect(entry).toHaveProperty('changeFrequency');
      expect(entry).toHaveProperty('priority');
      
      expect(typeof entry.url).toBe('string');
      expect(typeof entry.lastModified).toBe('string');
      expect(typeof entry.changeFrequency).toBe('string');
      expect(typeof entry.priority).toBe('number');
      
      // Validate change frequency values
      expect(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
        .toContain(entry.changeFrequency);
      
      // Validate priority range
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    });
  });

  it('should not have duplicate URLs', () => {
    const sitemapData = sitemap();
    const urls = sitemapData.map(entry => entry.url);
    const uniqueUrls = [...new Set(urls)];
    
    expect(urls.length).toBe(uniqueUrls.length);
  });
}); 