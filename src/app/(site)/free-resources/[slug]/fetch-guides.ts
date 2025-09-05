// src/app/(site)/free-resources/[slug]/fetch-guides.ts

import { notFound } from 'next/navigation';
import { safeFetch } from '@/lib/fetch-utils';
import { getGuideBySlug } from '@/sanity/lib/queries';
import { loggers } from '@/utils/logger';

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
  downloadCtaText?: string;        
  consultationCtaText?: string;  
  _updatedAt: string;
  category?: {
    _id: string;
    title: string;
    slug: {
      current: string;
    };
  };
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

// Static fallback guides for build time to avoid fetch issues
const STATIC_FALLBACK_GUIDES: Record<string, Guide> = {
  'what-is-email-marketing': {
    _id: 'static-email-marketing',
    title: 'What Is Email Marketing?',
    subtitle: 'A comprehensive guide to email marketing for business owners',
    slug: { current: 'what-is-email-marketing' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'marketing',
      title: 'Marketing',
      slug: {
        current: 'marketing'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Email marketing is one of the most effective digital marketing strategies for businesses of all sizes.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Getting Started with Email Marketing',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Email marketing allows you to reach your customers directly in their inbox with personalized, targeted messages.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'What Is Email Marketing? - Complete Guide | Ready Set LLC',
      metaDescription: 'Learn the fundamentals of email marketing and how it can help grow your business with this comprehensive guide.',
    }
  },
  'your-guide-to-delegation': {
    _id: 'static-delegation',
    title: 'Your Guide to Delegation',
    subtitle: 'How to effectively delegate tasks and grow your business',
    slug: { current: 'your-guide-to-delegation' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'management',
      title: 'Management',
      slug: {
        current: 'management'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Effective delegation is crucial for business growth and personal productivity.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'The Art of Delegation',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn how to delegate effectively to maximize your team\'s potential and focus on high-impact activities.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Your Guide to Delegation - Business Management | Ready Set LLC',
      metaDescription: 'Master the art of delegation with our comprehensive guide. Learn how to delegate effectively and grow your business.',
    }
  },
  'building-a-reliable-delivery-network': {
    _id: 'static-delivery-network',
    title: 'Building a Reliable Delivery Network',
    subtitle: 'Essential strategies for creating dependable logistics',
    slug: { current: 'building-a-reliable-delivery-network' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'logistics',
      title: 'Logistics',
      slug: {
        current: 'logistics'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'A reliable delivery network is the backbone of any successful logistics operation.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Network Infrastructure',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Build a robust delivery network that ensures timely and efficient service to your customers.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Building a Reliable Delivery Network - Logistics Guide | Ready Set LLC',
      metaDescription: 'Learn how to build and maintain a reliable delivery network for your business with proven strategies and best practices.',
    }
  },
  'the-complete-guide-to-choosing-the-right-delivery-partner': {
    _id: 'static-delivery-partner',
    title: 'The Complete Guide to Choosing the Right Delivery Partner',
    subtitle: 'How to select the best delivery service for your business',
    slug: { current: 'the-complete-guide-to-choosing-the-right-delivery-partner' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'business',
      title: 'Business',
      slug: {
        current: 'business'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Choosing the right delivery partner can make or break your customer experience.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Evaluation Criteria',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn the key factors to consider when selecting a delivery partner for your business needs.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Complete Guide to Choosing the Right Delivery Partner | Ready Set LLC',
      metaDescription: 'Find the perfect delivery partner for your business with our comprehensive selection guide and evaluation criteria.',
    }
  },
  'how-to-hire-the-right-virtual-assistant': {
    _id: 'static-virtual-assistant',
    title: 'How to Hire the Right Virtual Assistant',
    subtitle: 'Your complete guide to finding and hiring virtual assistants',
    slug: { current: 'how-to-hire-the-right-virtual-assistant' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'human-resources',
      title: 'Human Resources',
      slug: {
        current: 'human-resources'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Hiring the right virtual assistant can transform your business productivity and efficiency.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Finding the Perfect VA',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Discover the steps to identify, evaluate, and hire virtual assistants who will excel in your business.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'How to Hire the Right Virtual Assistant - Complete Guide | Ready Set LLC',
      metaDescription: 'Learn how to find, evaluate, and hire the perfect virtual assistant for your business with our step-by-step guide.',
    }
  },
  'how-to-start-social-media-marketing-made-simple': {
    _id: 'static-social-media',
    title: 'How to Start Social Media Marketing Made Simple',
    subtitle: 'A beginner-friendly approach to social media marketing',
    slug: { current: 'how-to-start-social-media-marketing-made-simple' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'marketing',
      title: 'Marketing',
      slug: {
        current: 'marketing'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Social media marketing doesn\'t have to be overwhelming. Start with these simple, effective strategies.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Getting Started',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn the fundamentals of social media marketing and how to create an effective strategy for your business.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'How to Start Social Media Marketing Made Simple | Ready Set LLC',
      metaDescription: 'Simple, effective social media marketing strategies for beginners. Start growing your business on social media today.',
    }
  },
  'why-email-metrics-matter': {
    _id: 'static-email-metrics',
    title: 'Why Email Metrics Matter',
    subtitle: 'Understanding and improving your email marketing performance',
    slug: { current: 'why-email-metrics-matter' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'analytics',
      title: 'Analytics',
      slug: {
        current: 'analytics'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Email metrics provide valuable insights into your marketing performance and customer engagement.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Key Email Metrics',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn which email metrics to track and how to use them to improve your marketing campaigns.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Why Email Metrics Matter - Email Marketing Analytics | Ready Set LLC',
      metaDescription: 'Understand the importance of email metrics and learn how to track and improve your email marketing performance.',
    }
  },
  'addressing-key-issues-in-delivery-logistics': {
    _id: 'static-delivery-logistics',
    title: 'Addressing Key Issues in Delivery Logistics',
    subtitle: 'Solving common delivery and logistics challenges',
    slug: { current: 'addressing-key-issues-in-delivery-logistics' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'logistics',
      title: 'Logistics',
      slug: {
        current: 'logistics'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Identify and solve the most common challenges in delivery logistics to improve your operations.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Common Logistics Issues',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn about typical delivery logistics problems and proven solutions to overcome them.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Addressing Key Issues in Delivery Logistics | Ready Set LLC',
      metaDescription: 'Solve common delivery logistics challenges with proven strategies and best practices for efficient operations.',
    }
  },
  'email-testing-made-simple': {
    _id: 'static-email-testing',
    title: 'Email Testing Made Simple',
    subtitle: 'A practical guide to testing your email campaigns',
    slug: { current: 'email-testing-made-simple' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'marketing',
      title: 'Marketing',
      slug: {
        current: 'marketing'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Effective email testing ensures your campaigns perform at their best and reach your audience successfully.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Testing Strategies',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn simple yet effective methods to test your email campaigns and improve their performance.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Email Testing Made Simple - Email Campaign Testing | Ready Set LLC',
      metaDescription: 'Learn simple and effective email testing strategies to improve your email campaign performance and deliverability.',
    }
  },
  'social-media-strategy-guide-and-template': {
    _id: 'static-social-strategy',
    title: 'Social Media Strategy Guide and Template',
    subtitle: 'Create a winning social media strategy for your business',
    slug: { current: 'social-media-strategy-guide-and-template' },
    _updatedAt: new Date().toISOString(),
    category: {
      _id: 'marketing',
      title: 'Marketing',
      slug: {
        current: 'marketing'
      }
    },
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'A well-planned social media strategy is essential for building brand awareness and engaging with your audience.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Strategy Development',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Use our comprehensive guide and template to create an effective social media strategy for your business.',
                marks: []
              }
            ]
          }
        ]
      }
    ],
         coverImage: {
       _type: 'image',
       asset: {
         _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
         _type: 'reference'
       }
     },
    seo: {
      metaTitle: 'Social Media Strategy Guide and Template | Ready Set LLC',
      metaDescription: 'Create an effective social media strategy with our comprehensive guide and free template. Boost your online presence today.',
    }
  }
};

//**

function shouldForceStaticFallback(): boolean {
  // This environment variable is true during `next build` AND in Vercel deployments.
  // It is UNDEFINED in `next dev`.
  const isBuilding = process.env.NEXT_BUILD_ID;

  // This environment variable is true during `npm run build`.
  const isLocalBuildCommand = process.env.npm_lifecycle_event === 'build';

  // This environment variable is defined when deployed on Vercel.
  const hasVercelUrl = !!process.env.VERCEL_URL;

  // We want to force static fallback ONLY if it's a local `npm run build`
  // AND it's NOT a Vercel deployment.
  return isLocalBuildCommand && !hasVercelUrl;
}

/**
 * Safely fetches guide data with proper error handling
 */
export async function fetchGuideData(slug: string): Promise<Guide | null> {
  if (!slug) return null;
  
  try {
    // If it's a local 'npm run build', use static fallbacks first.
    // This avoids hitting external APIs during a local static build explicitly.
    if (shouldForceStaticFallback()) {
      loggers.app.debug(`[fetchGuideData] Local 'npm run build' detected, forcing static fallback for guide: ${slug}`);
      const staticGuide = STATIC_FALLBACK_GUIDES[slug];
      if (staticGuide) {
        return staticGuide;
      }
      loggers.app.warn(`[fetchGuideData] No specific static fallback found for ${slug}, returning generic.`);
      // Return a generic fallback if no specific one exists
      return {
        _id: `static-${slug}`,
        title: 'Business Guide (Static Fallback)',
        subtitle: 'A helpful business guide from static data',
        slug: { current: slug },
        _updatedAt: new Date().toISOString(),
        category: {
          _id: 'business',
          title: 'Business',
          slug: {
            current: 'business'
          }
        },
        introduction: [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: 'This content is from a static fallback (generic).', marks: [] }] }],
        coverImage: { _type: 'image', asset: { _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg', _type: 'reference' } },
        seo: { metaTitle: `Static Guide for ${slug}`, metaDescription: 'This is a static fallback description (generic).' }
      };
    }
    
    // --- FROM HERE, IT WILL ALWAYS TRY TO FETCH FROM SANITY/API ---
    // This part runs in `npm run dev` and Vercel deployments.

    // Attempt to fetch from API route first (recommended if you have one)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const url = new URL(`/api/guides/${slug}`, baseUrl).toString();
      
      loggers.app.debug(`[fetchGuideData] Attempting to fetch guide ${slug} from API route: ${url}`);
      const response = await safeFetch<{data?: Guide}>(url);
      
      if (response && typeof response === 'object' && 'data' in response && response.data) {
        loggers.app.debug(`[fetchGuideData] Guide ${slug} fetched successfully from API route.`);
        return response.data;
      }
      
      if (response && typeof response === 'object' && '_id' in response) {
        loggers.app.debug(`[fetchGuideData] Guide ${slug} fetched successfully from API route (legacy format).`);
        return response as unknown as Guide;
      }
      
      loggers.app.warn(`[fetchGuideData] API route for guide ${slug} returned empty or invalid data, trying direct Sanity query.`);

    } catch (apiError) {
      loggers.app.warn(`[fetchGuideData] API fetch failed for guide ${slug}, falling back to direct Sanity query:`, apiError);
      // API route failed, trying direct Sanity query as fallback
    }
    
    // Fallback to direct Sanity query
    loggers.app.debug(`[fetchGuideData] Attempting to fetch guide ${slug} directly from Sanity.`);
    const guide = await getGuideBySlug(slug);
    
    if (!guide || guide._id === undefined || guide._id.startsWith("fallback-")) {
      loggers.app.warn(`[fetchGuideData] Direct Sanity query for guide ${slug} returned empty, null, or fallback. It might indicate a CORS/network issue or missing data.`);
      // If Sanity itself fails, as a last resort, return a static fallback
      const staticGuide = STATIC_FALLBACK_GUIDES[slug];
      if (staticGuide) {
        loggers.app.debug(`[fetchGuideData] Using static fallback for guide: ${slug} after direct Sanity query failure.`);
        return staticGuide;
      }
      console.error(`[fetchGuideData] No real data and no specific static fallback for ${slug}. Returning null.`);
      return null;
    }
    
    loggers.app.debug(`[fetchGuideData] Guide ${slug} fetched successfully directly from Sanity.`);
    return guide as unknown as Guide;
  } catch (error) {
    console.error(`[fetchGuideData] CRITICAL ERROR fetching guide with slug ${slug}:`, error);

    // Final fallback in case of ANY unhandled error during fetch
    const staticGuide = STATIC_FALLBACK_GUIDES[slug];
    if (staticGuide) {
      loggers.app.debug(`[fetchGuideData] Using static fallback for guide: ${slug} due to critical error.`);
      return staticGuide;
    }
    
    return null;
  }
}