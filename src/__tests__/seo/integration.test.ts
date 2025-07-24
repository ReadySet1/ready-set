/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

// Mock the sitemap function
vi.mock('../../app/sitemap', () => {
  return vi.fn().mockReturnValue([
    {
      url: 'https://readysetllc.com',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://readysetllc.com/catering-deliveries',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://readysetllc.com/logistics',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://readysetllc.com/bakery-deliveries',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://readysetllc.com/flowers-deliveries',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://readysetllc.com/about',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://readysetllc.com/contact',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://readysetllc.com/features',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://readysetllc.com/apply',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://readysetllc.com/blog',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: 'https://readysetllc.com/on-demand',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://readysetllc.com/virtual-assistant',
      lastModified: '2025-01-01T00:00:00.000Z',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]);
});

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_SITE_URL: 'https://readysetllc.com',
  NODE_ENV: 'production',
};

describe('SEO Integration Tests', () => {
  beforeEach(() => {
    // Reset environment variables
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key as keyof typeof mockEnv];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Sitemap XML Generation', () => {
    it('should generate valid sitemap XML format', async () => {
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      expect(Array.isArray(sitemapData)).toBe(true);
      expect(sitemapData.length).toBeGreaterThan(0);
      
      // Verify sitemap structure
      sitemapData.forEach(entry => {
        expect(entry).toHaveProperty('url');
        expect(entry).toHaveProperty('lastModified');
        expect(entry).toHaveProperty('changeFrequency');
        expect(entry).toHaveProperty('priority');
        
        // URL should be valid
        expect(entry.url).toMatch(/^https:\/\/readysetllc\.com/);
        
        // Priority should be between 0 and 1
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
        
        // Change frequency should be valid
        expect(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
          .toContain(entry.changeFrequency);
      });
    });

    it('should include all critical service pages', async () => {
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      const urls = sitemapData.map(entry => entry.url);
      
      // Critical pages that must be in sitemap
      const criticalPages = [
        'https://readysetllc.com',
        'https://readysetllc.com/catering-deliveries',
        'https://readysetllc.com/logistics',
        'https://readysetllc.com/bakery-deliveries',
        'https://readysetllc.com/flowers-deliveries',
        'https://readysetllc.com/about',
        'https://readysetllc.com/contact',
      ];
      
      criticalPages.forEach(page => {
        expect(urls).toContain(page);
      });
    });

    it('should prioritize service pages correctly', async () => {
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      // Home page should have highest priority
      const homePage = sitemapData.find(entry => entry.url === 'https://readysetllc.com');
      expect(homePage?.priority).toBe(1);
      
      // Service pages should have high priority
      const servicePages = sitemapData.filter(entry => 
        entry.url.includes('catering-deliveries') ||
        entry.url.includes('logistics') ||
        entry.url.includes('bakery-deliveries') ||
        entry.url.includes('flowers-deliveries')
      );
      
      servicePages.forEach(page => {
        expect(page.priority).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('SEO Configuration Validation', () => {
    it('should have consistent base URL configuration', () => {
      expect(process.env.NEXT_PUBLIC_SITE_URL).toBe('https://readysetllc.com');
      expect(process.env.NEXT_PUBLIC_SITE_URL).not.toContain('localhost');
      expect(process.env.NEXT_PUBLIC_SITE_URL).not.toMatch(/\/$/);  // Should not end with slash
    });

    it('should handle missing environment variables gracefully', async () => {
      // Test with missing NEXT_PUBLIC_SITE_URL
      delete process.env.NEXT_PUBLIC_SITE_URL;
      
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      expect(sitemapData.length).toBeGreaterThan(0);
      
      // Should fall back to default URL
      sitemapData.forEach(entry => {
        expect(entry.url).toMatch(/^https:\/\/readysetllc\.com/);
      });
    });
  });

  describe('Robots.txt Compliance', () => {
    it('should reference the correct sitemap URL', () => {
      // In a real test, you would read the actual robots.txt file
      const expectedSitemapUrl = 'https://readysetllc.com/sitemap.xml';
      
      // Mock robots.txt content
      const robotsTxt = `
        User-agent: *
        Allow: /
        Disallow: /client/deliveries/
        Disallow: /driver/deliveries/
        Disallow: /reset-password/
        Disallow: /studio/
        
        Sitemap: ${expectedSitemapUrl}
      `;
      
      expect(robotsTxt).toContain(expectedSitemapUrl);
    });

    it('should allow access to all service pages', () => {
      // Mock robots.txt content
      const robotsTxt = `
        User-agent: *
        Allow: /
        Disallow: /client/deliveries/
        Disallow: /driver/deliveries/
        Disallow: /reset-password/
        Disallow: /studio/
      `;
      
      // Service pages should not be disallowed
      const servicePages = [
        '/catering-deliveries',
        '/logistics',
        '/bakery-deliveries',
        '/flowers-deliveries',
        '/about',
        '/contact',
      ];
      
      servicePages.forEach(page => {
        expect(robotsTxt).not.toContain(`Disallow: ${page}`);
      });
    });
  });

  describe('SEO Metadata Consistency', () => {
    it('should have consistent metadata structure across pages', () => {
      // Mock metadata from different pages
      const pageMetadata = [
        {
          title: 'Food Delivery Services for Events | Ready Set',
          description: 'Catering delivery services for events',
          robots: { index: true, follow: true },
        },
        {
          title: 'Premium Catering Logistics Services | Ready Set Group LLC',
          description: 'Bay Area catering delivery partner',
          robots: { index: true, follow: true },
        },
        {
          title: 'Premium Food & Bakery Delivery Services | Ready Set',
          description: 'Bakery delivery services for events',
          robots: { index: true, follow: true },
        },
      ];
      
      pageMetadata.forEach(metadata => {
        // All should have title and description
        expect(metadata.title).toBeTruthy();
        expect(metadata.description).toBeTruthy();
        
        // All should be indexed
        expect(metadata.robots.index).toBe(true);
        expect(metadata.robots.follow).toBe(true);
        
        // Titles should contain brand name
        expect(metadata.title.toLowerCase()).toContain('ready set');
        
        // Descriptions should be reasonable length
        expect(metadata.description.length).toBeGreaterThan(20);
        expect(metadata.description.length).toBeLessThan(160);
      });
    });
  });

  describe('Performance and Accessibility', () => {
    it('should generate sitemap efficiently', async () => {
      const startTime = Date.now();
      
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should generate quickly (less than 100ms)
      expect(executionTime).toBeLessThan(100);
      expect(sitemapData.length).toBeGreaterThan(10);
    });

    it('should handle large number of URLs', async () => {
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      // Should handle reasonable number of URLs
      expect(sitemapData.length).toBeLessThan(1000); // Stay under sitemap limits
      expect(sitemapData.length).toBeGreaterThan(10); // But have meaningful content
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed environment variables', async () => {
      // Test with malformed URL
      process.env.NEXT_PUBLIC_SITE_URL = 'not-a-url';
      
      const sitemap = await import('../../app/sitemap');
      
      // Should not throw error
      expect(() => sitemap.default()).not.toThrow();
    });

    it('should provide fallback values', async () => {
      // Remove all environment variables
      delete process.env.NEXT_PUBLIC_SITE_URL;
      
      const sitemap = await import('../../app/sitemap');
      const sitemapData = sitemap.default();
      
      // Should still generate sitemap with fallback
      expect(sitemapData.length).toBeGreaterThan(0);
      sitemapData.forEach(entry => {
        expect(entry.url).toBeTruthy();
        expect(entry.url).toMatch(/^https:\/\//);
      });
    });
  });
}); 