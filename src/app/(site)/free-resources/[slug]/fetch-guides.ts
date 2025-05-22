import { notFound } from 'next/navigation';
import { safeFetch } from '@/lib/fetch-utils';
import { getGuideBySlug } from '@/sanity/lib/queries';

// Define types for Portable Text blocks
interface PortableTextSpan {
  _key?: string;
  _type: string;
  marks?: string[];
  text: string;
}

interface PortableTextBlock {
  _key?: string;
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: any[];
}

// Guide type definition
export interface Guide {
  _id: string;
  title: string;
  subtitle?: string;
  slug: { current: string };
  introduction?: PortableTextBlock[];
  coverImage?: any;
  mainContent?: Array<{
    title: string;
    content: PortableTextBlock[];
  }>;
  listSections?: Array<{
    title: string;
    items: Array<{
      title?: string;
      content: string;
    }>;
  }>;
  callToAction?: string;
  calendarUrl?: string;
  consultationCta?: string;
  _updatedAt: string;
  category?: string;
  downloadableFiles?: Array<{
    _key: string;
    asset: {
      _id: string;
      url: string;
      originalFilename: string;
    };
  }>;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    openGraph?: {
      title?: string;
      description?: string;
      image?: any;
      siteName?: string;
      url?: string;
    };
    twitter?: {
      _type: string;
      handle?: string;
      site?: string;
      cardType?: string;
      creator?: string;
    };
  };
}

/**
 * Safely fetches guide data with proper error handling
 * This utility handles the arrayBuffer error by using direct Sanity queries
 * during static generation to avoid API fetch issues
 */
export async function fetchGuideData(slug: string): Promise<Guide | null> {
  if (!slug) return null;
  
  try {
    // Always use direct Sanity query during static site generation
    // This completely avoids the arrayBuffer issue
    const guide = await getGuideBySlug(slug);
    return guide as unknown as Guide;
  } catch (error) {
    console.error(`Error fetching guide with slug ${slug}:`, error);
    return null;
  }
} 