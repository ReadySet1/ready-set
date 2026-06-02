import { MetadataRoute } from 'next';
import { getAllPosts } from '@/sanity/lib/queries';

/**
 * Resolve a Sanity slug to a string.
 * The GROQ query projects `"slug": slug.current` which returns a string at
 * runtime, but the `SimpleBlogCard.slug` type is `{ current: string }`.
 * Handle both shapes defensively.
 */
function resolveSlug(slug: string | { current: string }): string {
  if (typeof slug === 'string') return slug;
  return slug.current;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || 'https://readysetllc.com';
  const currentDate = new Date().toISOString();

  // Static pages with high priority
  const staticPages = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/apply`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
  ];

  // Service pages with high priority
  const servicePages = [
    {
      url: `${baseUrl}/catering-deliveries`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/bakery-deliveries`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/flowers-deliveries`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/logistics`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/specialty-deliveries`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/on-demand`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/virtual-assistant`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ];

  // Additional pages
  const additionalPages = [
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/free-resources`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/catering-request`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/addresses`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ];

  // Dynamic blog posts from Sanity CMS
  let blogUrls: MetadataRoute.Sitemap = [];
  try {
    const posts = await getAllPosts();
    blogUrls = posts.map((post) => ({
      url: `${baseUrl}/blog/${resolveSlug(post.slug)}`,
      lastModified: post._updatedAt || currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Failed to fetch blog posts for sitemap:', error);
    // Degrade gracefully — static sitemap entries are still returned
  }

  return [
    ...staticPages,
    ...servicePages,
    ...additionalPages,
    ...blogUrls,
  ];
}
