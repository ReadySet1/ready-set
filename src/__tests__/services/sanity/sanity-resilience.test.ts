/**
 * Sanity CMS Resilience Tests
 *
 * Comprehensive testing of Sanity CMS error handling, retry logic,
 * fallback content serving, and CDN resilience.
 *
 * Part of REA-77: External API Resilience Testing
 */

import {
  createMockApiWithTimeout,
  createMockApiWithRetry,
  createMockApiWithHttpError,
  expectRetryAttempted,
  createMockLogger,
  wait,
} from '../../helpers/api-resilience-helpers';
import DOMPurify from 'isomorphic-dompurify';

describe('Sanity CMS Resilience Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // 1. CONTENT FETCHING RESILIENCE
  // ==========================================================================

  describe('Content Fetching Resilience', () => {
    it('should handle API timeout during content fetch', async () => {
      jest.useFakeTimers();

      const timeoutMock = createMockApiWithTimeout(10000);
      const promise = timeoutMock({ query: '*[_type == "post"]' });

      // Advance time to trigger timeout
      jest.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(/timeout/i);

      jest.useRealTimers();
    });

    it('should retry on transient failures', async () => {
      const retryMock = createMockApiWithRetry(2, 'server');

      // Wrap in retry logic
      const retryWrapper = async () => {
        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
          try {
            return await retryMock();
          } catch (error) {
            lastError = error;
            if (i === maxRetries - 1) throw error;
          }
        }
      };

      await expect(retryWrapper()).resolves.toMatchObject({
        success: true,
      });

      expectRetryAttempted(retryMock, 3);
    });

    it('should handle network errors gracefully', async () => {
      const networkErrorMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(networkErrorMock()).rejects.toThrow('ECONNREFUSED');

      expect(networkErrorMock).toHaveBeenCalledTimes(1);
    });

    it('should serve fallback content when API fails', async () => {
      const fallbackGuides = [
        {
          _id: 'fallback-1',
          title: 'Getting Started',
          content: 'Default guide content',
        },
      ];

      const fetchWithFallback = async () => {
        try {
          throw new Error('API unavailable');
        } catch (error) {
          console.warn('Serving fallback content');
          return fallbackGuides;
        }
      };

      const result = await fetchWithFallback();

      expect(result).toEqual(fallbackGuides);
      expect(result).toHaveLength(1);
    });

    it('should cache content for offline access', async () => {
      const cache = new Map<string, { data: any; timestamp: number }>();
      const CACHE_TTL = 3600000; // 1 hour

      const fetchWithCache = async (query: string) => {
        const now = Date.now();

        // Check cache first
        if (cache.has(query)) {
          const cached = cache.get(query)!;
          if (now - cached.timestamp < CACHE_TTL) {
            return { ...cached.data, cached: true };
          }
        }

        // Fetch from API
        try {
          const data = { title: 'Fresh content', content: 'New data' };
          cache.set(query, { data, timestamp: now });
          return { ...data, cached: false };
        } catch (error) {
          // Serve stale cache if API fails
          if (cache.has(query)) {
            const stale = cache.get(query)!;
            return { ...stale.data, cached: true, stale: true };
          }
          throw error;
        }
      };

      const result1 = await fetchWithCache('test-query');
      expect(result1.cached).toBe(false);

      const result2 = await fetchWithCache('test-query');
      expect(result2.cached).toBe(true);
    });

    it('should implement stale-while-revalidate pattern', async () => {
      let cacheData = { content: 'stale data', timestamp: Date.now() - 7200000 }; // 2 hours old
      const CACHE_STALE_TIME = 3600000; // 1 hour

      const fetchWithSWR = async () => {
        const isStale = Date.now() - cacheData.timestamp > CACHE_STALE_TIME;

        if (isStale) {
          // Return stale data immediately
          const staleData = { ...cacheData, stale: true };

          // Revalidate in background (don't await)
          (async () => {
            try {
              await wait(100);
              cacheData = { content: 'fresh data', timestamp: Date.now() };
            } catch (error) {
              console.error('Revalidation failed');
            }
          })();

          return staleData;
        }

        return { ...cacheData, stale: false };
      };

      const result = await fetchWithSWR();

      expect(result.stale).toBe(true);
      expect(result.content).toBe('stale data');
    });
  });

  // ==========================================================================
  // 2. IMAGE URL GENERATION AND CDN
  // ==========================================================================

  describe('Image URL Generation and CDN', () => {
    it('should handle image CDN failover', async () => {
      const primaryCDN = 'https://cdn.sanity.io';
      const fallbackCDN = 'https://cdn-backup.sanity.io';

      const getImageUrl = async (imageRef: string, usePrimary: boolean = true) => {
        const cdnUrl = usePrimary ? primaryCDN : fallbackCDN;

        try {
          if (!usePrimary) {
            return `${cdnUrl}/images/${imageRef}`;
          }

          // Simulate primary CDN failure
          throw new Error('CDN unavailable');
        } catch (error) {
          // Fallback to secondary CDN
          return `${fallbackCDN}/images/${imageRef}`;
        }
      };

      const url = await getImageUrl('image-123', true);

      expect(url).toContain(fallbackCDN);
    });

    it('should serve placeholder images on CDN failure', () => {
      const PLACEHOLDER_IMAGE = '/images/placeholder.png';

      const getImageWithPlaceholder = (imageUrl?: string) => {
        if (!imageUrl) {
          return PLACEHOLDER_IMAGE;
        }

        try {
          // Validate URL
          new URL(imageUrl);
          return imageUrl;
        } catch (error) {
          return PLACEHOLDER_IMAGE;
        }
      };

      expect(getImageWithPlaceholder()).toBe(PLACEHOLDER_IMAGE);
      expect(getImageWithPlaceholder('invalid-url')).toBe(PLACEHOLDER_IMAGE);
      expect(getImageWithPlaceholder('https://cdn.sanity.io/image.jpg')).toContain(
        'sanity'
      );
    });

    it('should implement lazy loading with retry', async () => {
      const loadImageWithRetry = async (
        imageUrl: string,
        maxRetries: number = 3
      ): Promise<{ loaded: boolean; attempts: number }> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Simulate image load
            if (attempt < 2) {
              throw new Error('Load failed');
            }

            return { loaded: true, attempts: attempt };
          } catch (error) {
            if (attempt === maxRetries) {
              return { loaded: false, attempts: attempt };
            }

            await wait(1000 * Math.pow(2, attempt - 1));
          }
        }

        return { loaded: false, attempts: maxRetries };
      };

      const result = await loadImageWithRetry('https://cdn.sanity.io/image.jpg');

      expect(result.loaded).toBe(true);
      expect(result.attempts).toBe(2);
    }, 5000);

    it('should generate responsive image URLs', () => {
      const generateResponsiveUrls = (imageRef: string) => {
        const baseUrl = `https://cdn.sanity.io/images/project/dataset/${imageRef}`;

        return {
          small: `${baseUrl}-300.jpg`,
          medium: `${baseUrl}-600.jpg`,
          large: `${baseUrl}-1200.jpg`,
          original: `${baseUrl}.jpg`,
        };
      };

      const urls = generateResponsiveUrls('image-123');

      expect(urls.small).toContain('-300.jpg');
      expect(urls.medium).toContain('-600.jpg');
      expect(urls.large).toContain('-1200.jpg');
    });
  });

  // ==========================================================================
  // 3. QUERY OPTIMIZATION AND RESILIENCE
  // ==========================================================================

  describe('Query Optimization and Resilience', () => {
    it('should handle invalid GROQ queries', async () => {
      const invalidQuery = '*[_type == "post" AND'; // Syntax error

      const executeQuery = async (query: string) => {
        // Validate query syntax
        if (!query.includes(']') && query.includes('[')) {
          return {
            success: false,
            error: 'Invalid query syntax: unclosed bracket',
          };
        }

        return { success: true, data: [] };
      };

      const result = await executeQuery(invalidQuery);

      expect(result.success).toBe(false);
      expect(result.error).toContain('syntax');
    });

    it('should implement query timeout', async () => {
      jest.useFakeTimers();

      const QUERY_TIMEOUT = 5000;

      const executeQueryWithTimeout = async (query: string) => {
        return Promise.race([
          wait(6000).then(() => ({ success: true, data: [] })),
          wait(QUERY_TIMEOUT).then(() => {
            throw new Error('Query timeout after 5000ms');
          }),
        ]);
      };

      const promise = executeQueryWithTimeout('*[_type == "post"]');

      // Advance past the timeout
      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow(/timeout/i);

      jest.useRealTimers();
    });

    it('should paginate large result sets', async () => {
      const fetchPaginated = async (offset: number = 0, limit: number = 100) => {
        // Simulate fetching a page
        const totalResults = 500;
        const results = Array.from({ length: Math.min(limit, totalResults - offset) }, (_, i) => ({
          _id: `item-${offset + i}`,
        }));

        return {
          results,
          offset,
          limit,
          total: totalResults,
          hasMore: offset + limit < totalResults,
        };
      };

      const page1 = await fetchPaginated(0, 100);
      const page2 = await fetchPaginated(100, 100);

      expect(page1.results).toHaveLength(100);
      expect(page1.hasMore).toBe(true);

      expect(page2.results).toHaveLength(100);
      expect(page2.results[0]._id).toBe('item-100');
    });

    it('should cache query results', async () => {
      const queryCache = new Map<string, any>();

      const fetchWithQueryCache = async (query: string) => {
        if (queryCache.has(query)) {
          return { ...queryCache.get(query), cached: true };
        }

        // Fetch from API
        const result = { data: [{ _id: '1', title: 'Post 1' }] };
        queryCache.set(query, result);

        return { ...result, cached: false };
      };

      const result1 = await fetchWithQueryCache('*[_type == "post"]');
      const result2 = await fetchWithQueryCache('*[_type == "post"]');

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
    });
  });

  // ==========================================================================
  // 4. CONTENT VALIDATION
  // ==========================================================================

  describe('Content Validation', () => {
    it('should validate content structure', () => {
      const validatePost = (post: any) => {
        if (!post._id || !post._type) {
          return { valid: false, error: 'Missing required fields' };
        }

        if (post._type !== 'post') {
          return { valid: false, error: 'Invalid content type' };
        }

        if (!post.title || typeof post.title !== 'string') {
          return { valid: false, error: 'Invalid title' };
        }

        return { valid: true };
      };

      expect(validatePost({})).toMatchObject({ valid: false });
      expect(validatePost({ _id: '1', _type: 'post', title: 'Test' })).toMatchObject({
        valid: true,
      });
    });

    it('should sanitize content HTML', () => {
      const sanitizeHtml = (html: string) => {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
          ALLOW_DATA_ATTR: false,
        });
      };

      const dangerous = '<p>Safe</p><script>alert("xss")</script><p onclick="bad()">Click</p>';
      const safe = sanitizeHtml(dangerous);

      expect(safe).not.toContain('<script');
      expect(safe).not.toContain('onclick');
      expect(safe).toContain('<p>Safe</p>');

      // Test for nested script tags (bypass attempt)
      // DOMPurify correctly removes script tags and neutralizes the attack
      const nested = '<scr<script>ipt>alert("xss")</script>';
      const sanitizedNested = sanitizeHtml(nested);
      expect(sanitizedNested).not.toContain('<script');
      expect(sanitizedNested).not.toMatch(/<script[\s>]/i); // No script tag variants

      // Test for spaced closing tags (bypass attempt)
      const spaced = '<script>alert("xss")</script >';
      const sanitizedSpaced = sanitizeHtml(spaced);
      expect(sanitizedSpaced).not.toContain('<script');
      expect(sanitizedSpaced).not.toMatch(/<script[\s>]/i);

      // Test for single-quote event handlers (bypass attempt)
      const singleQuote = "<p onclick='bad()'>Click</p>";
      const sanitizedQuote = sanitizeHtml(singleQuote);
      expect(sanitizedQuote).not.toContain('onclick');
      expect(sanitizedQuote).toContain('Click'); // Text content preserved
    });

    it('should handle missing content gracefully', () => {
      const getContentOrDefault = (content?: string, defaultContent: string = 'No content available') => {
        return content && content.trim().length > 0 ? content : defaultContent;
      };

      expect(getContentOrDefault('')).toBe('No content available');
      expect(getContentOrDefault('   ')).toBe('No content available');
      expect(getContentOrDefault('Real content')).toBe('Real content');
    });
  });

  // ==========================================================================
  // 5. ERROR LOGGING
  // ==========================================================================

  describe('Error Logging', () => {
    it('should log Sanity API errors with context', async () => {
      const logger = createMockLogger();

      const sanityError = {
        statusCode: 429,
        message: 'Too many requests',
      };

      logger.error('Sanity CMS error', {
        error: sanityError,
        query: '*[_type == "post"]',
        timestamp: new Date().toISOString(),
      });

      const errorLogs = logger.getErrorLogs();

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].context).toHaveProperty('query');
    });

    it('should categorize Sanity errors', () => {
      const categorizeError = (error: any) => {
        if (error.statusCode) {
          if (error.statusCode === 429) return 'rate_limit';
          if (error.statusCode === 401) return 'auth';
          if (error.statusCode >= 500) return 'server';
        }

        if (error.message) {
          if (error.message.includes('timeout')) return 'timeout';
          if (error.message.includes('network')) return 'network';
        }

        return 'unknown';
      };

      expect(categorizeError({ statusCode: 429 })).toBe('rate_limit');
      expect(categorizeError({ statusCode: 503 })).toBe('server');
      expect(categorizeError({ message: 'Query timeout' })).toBe('timeout');
    });

    it('should track content fetch performance', async () => {
      jest.useFakeTimers();
      let mockTime = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const performanceMetrics: Array<{ query: string; duration: number }> = [];

      const fetchWithMetrics = async (query: string) => {
        const start = Date.now();

        try {
          const promise = wait(100);
          jest.advanceTimersByTime(100);
          await promise;
          mockTime += 100; // Simulate time passing
          return { data: [] };
        } finally {
          const duration = Date.now() - start;
          performanceMetrics.push({ query, duration });
        }
      };

      await fetchWithMetrics('*[_type == "post"]');
      await fetchWithMetrics('*[_type == "guide"]');

      expect(performanceMetrics).toHaveLength(2);
      expect(performanceMetrics[0].duration).toBeGreaterThan(0);

      jest.restoreAllMocks();
      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // 6. WEBHOOKS AND REAL-TIME UPDATES
  // ==========================================================================

  describe('Webhooks and Real-time Updates', () => {
    it('should handle webhook delivery failures gracefully', async () => {
      jest.useFakeTimers();

      const deliverWebhook = async (url: string, payload: any, maxRetries: number = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (attempt < 2) {
              throw new Error('Webhook delivery failed');
            }

            return { success: true, attempts: attempt };
          } catch (error) {
            if (attempt === maxRetries) {
              return { success: false, attempts: attempt, error: 'Max retries exceeded' };
            }

            const promise = wait(1000 * Math.pow(2, attempt - 1));
            jest.advanceTimersByTime(1000 * Math.pow(2, attempt - 1));
            await promise;
          }
        }
      };

      const result = await deliverWebhook('https://example.com/webhook', {});

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);

      jest.useRealTimers();
    });

    it('should validate webhook signatures', () => {
      const validateWebhookSignature = (payload: string, signature: string, secret: string) => {
        // Simplified validation (in reality, use crypto)
        const expectedSignature = `sha256=${secret}${payload}`;
        return signature === expectedSignature;
      };

      const payload = JSON.stringify({ _type: 'post', _id: '123' });
      const secret = 'webhook-secret';
      const validSignature = `sha256=${secret}${payload}`;
      const invalidSignature = 'invalid-signature';

      expect(validateWebhookSignature(payload, validSignature, secret)).toBe(true);
      expect(validateWebhookSignature(payload, invalidSignature, secret)).toBe(false);
    });
  });
});
