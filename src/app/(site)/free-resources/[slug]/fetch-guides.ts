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

interface PortableTextListItem {
  _type: 'listItem';
  children: Array<{
    _type: string;
    text?: string;
    children?: PortableTextSpan[];
  }>;
}

interface PortableTextBlock {
  _key?: string;
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: any[];
  listItem?: 'bullet' | 'number';
  level?: number;
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

// Static fallback guides for build time to avoid fetch issues
const STATIC_FALLBACK_GUIDES: Record<string, Guide> = {
  'what-is-email-marketing': {
    _id: 'static-email-marketing',
    title: 'What Is Email Marketing?',
    subtitle: 'A Business Owner\'s Guide to Getting Started',
    slug: { current: 'what-is-email-marketing' },
    _updatedAt: new Date().toISOString(),
    category: 'Marketing',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Does the idea of email marketing feel overwhelming or outdated? Many business owners mistakenly think email marketing is reserved for large corporations or struggle with ineffective campaigns. In reality, email marketing is a powerful tool to build meaningful customer relationships and drive sales—no matter your business size.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This guide breaks down email marketing essentials, from its benefits and types of campaigns to the key steps for launching a successful strategy. Whether you are new to email marketing or looking to optimize your approach, this guide is your starting point.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'What You Will Learn',
        content: [
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'What Is Email Marketing?',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'The Pros and Cons of Email Marketing',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Types of Email Marketing Campaigns',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'How to Build an Email List',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Getting Customer Consent',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Lead Magnets That Work',
                marks: ['strong']
              },
              {
                _type: 'span',
                text: ': Discover how to use free resources to attract and retain subscribers.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Email Authentication Essentials',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'Ready to Get Started?',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This guide offers clear steps to understand email marketing, grow your audience, and build meaningful connections with your customers. Use it to get started today.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['link']
              },
              {
                _type: 'span',
                text: ' now!',
                marks: []
              }
            ],
            markDefs: [
              {
                _key: 'link-ready-set-group',
                _type: 'link',
                href: '#' // Replace with actual URL
              }
            ]
          }
        ]
      }
    ],
    // ✅ Updated coverImage to use local image path
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
    subtitle: 'Mastering the Art of Delegating for Business Growth',
    slug: { current: 'your-guide-to-delegation' },
    _updatedAt: new Date().toISOString(),
    category: 'Management',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Does managing your business feel overwhelming? Many business owners struggle to balance daily operations while also focusing on growth. Holding onto too many tasks can lead to burnout, inefficiency, and stalled progress. However, delegation isn’t about losing control—it’s about gaining the freedom to focus on what truly matters.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This guide breaks down the essentials of delegating tasks, the benefits of delegation, and proven methods such as the Eisenhower Decision Matrix to help you determine what to delegate. Whether you’re new to delegation or looking to refine your approach, this guide will help you delegate smarter and work more efficiently.',
                marks: []
              }
            ]
          }
        ]
      }, 
       {
        title: 'What You Will Learn',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'What is Delegation? Understanding the delegate meaning and why it matters.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'The Benefits of Delegation: How handing off tasks can improve efficiency and business growth.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Effective Delegation Methods: A breakdown of strategies, including the Eisenhower Decision Matrix, to prioritize and delegate tasks effectively.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'How to Delegate Successfully: Steps to assign tasks, set expectations, and track progress.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Common Delegation Mistakes to Avoid: How to overcome trust issues and ensure accountability.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Delegating to Virtual Assistants: How VAs can help manage emails, scheduling, customer service, and more.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['link']
              },
              {
                _type: 'span',
                text: ' now!',
                marks: []
              }
            ],
            markDefs: [
              {
                _key: 'link-ready-set-group',
                _type: 'link',
                href: '#' // Replace with actual URL
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
    subtitle: 'Key Considerations for Business Owners',
    slug: { current: 'building-a-reliable-delivery-network' },
    _updatedAt: new Date().toISOString(),
    category: 'Logistics',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'This guide breaks down the key components of a strong delivery system, helping you optimize logistics, improve customer satisfaction, and cut costs without the confusion of technical jargon. You’ll discover the essential strategies to build a seamless delivery process that keeps your business running smoothly and customers coming back.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'What You Will Get',
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
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Why a Reliable Delivery Network Matters',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Key Components of an Efficient Delivery System',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Steps to Build & Optimize Your Network',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Cost Considerations & ROI Benefits',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Common Mistakes to Avoid',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Best Practices for Long-Term Success',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '✓ Future Trends in Delivery & Logistics',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This guide matters because it provides both strategic overview and tactical guidance for building a delivery network that drives business growth.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Download your Free Building Reliable Delivery Network Guide to get more insights!',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: [] // Puedes agregar marcas específicas si "Ready Set Group" es un enlace o tiene un formato especial
              },
              {
                _type: 'span',
                text: ' now!',
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
    subtitle: 'A Strategic Approach',
    slug: { current: 'the-complete-guide-to-choosing-the-right-delivery-partner' },
    _updatedAt: new Date().toISOString(),
    category: 'Business',
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
      },
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Whether you\'re running a small business or managing a larger operation, this guide provides a structured approach to making an informed decision that will support your business growth and customer satisfaction goals.',
            marks: []
          }
        ]
      },
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'This comprehensive resource helps businesses navigate the critical process of selecting the right delivery partner in today\'s evolving e-commerce landscape. The guide is particularly valuable because:',
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
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '1. The guide provides detailed frameworks for evaluating potential partners across four key areas:',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Cost structure analysis (both direct and indirect costs)',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Customer experience optimization',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Technology integration capabilities',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Support system evaluation',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '2. It includes practical implementation tools such as:',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Step-by-step checklists',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Industry-specific considerations for specialized deliveries',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Risk management strategies',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Performance measurement metrics',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This resource will help your business succeed by:',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Avoiding common pitfalls in delivery partner selection',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Ensuring comprehensive evaluation of potential partners',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Establishing clear metrics for success',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Maintaining quality control throughout the partnership',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Creating contingency plans for potential disruptions',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Download your Free Delivery Partner Selection Guide to get more insights!',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: [] // You might want to add a mark here if "Ready Set Group" is a link
              },
              {
                _type: 'span',
                text: ' now!',
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
    category: 'Human Resources',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Hiring a Virtual Assistant (VA) isn\'t just about ticking tasks off your list—it\'s about finding someone who fits your business and work style. Before you start, ask yourself: What tasks do I need help with? What skills should my VA have? This guide walks you through the process of finding the right VA who can help you work smarter and free up your time.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Learn how to hire the right Virtual Assistant for your business. This guide covers how to identify tasks to delegate, find qualified VAs, evaluate candidates, and onboard them into your workflow. You\'ll also learn how to manage and measure their performance effectively.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'What You Will Get',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Hiring the Perfect Virtual Assistant for Your Business\n• How to Find the Right Virtual Assistant (VA)\n• Checklist: What to Look for in a VA\n• Benefits of Having a Virtual Assistant for Your Business',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Hiring a VA is a smart move when you\'re ready to focus on the bigger picture. Let Ready Set Group LLC match you with professionals who fit your business needs. Get your free guide and start delegating today.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Want personalized support? Book a Discovery Call with Ready Set Group LLC and let us help you find the right VA.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'Next Steps',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact Ready Set Group now!',
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
    subtitle: 'Your Step-by-Step Guide',
    slug: { current: 'how-to-start-social-media-marketing-made-simple' },
    _updatedAt: new Date().toISOString(),
    category: 'Marketing',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'If you\'re a business owner, small business operator, or solopreneur struggling to maintain a consistent social media presence, this social media marketing guide is for you. You might feel overwhelmed by content creation, unsure of which platforms to focus on, or frustrated by low engagement. Social media doesn\'t have to be complicated—with the right approach, you can turn followers into loyal customers. Inside this guide, you\'ll learn how to build a results-driven social media strategy. You\'ll discover how to identify the best platforms for your business, create content that engages and converts, and use social media marketing metrics to refine your approach. Additionally, you\'ll learn how to leverage Virtual Assistants to stay consistent without the stress.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'What You Will Get',
        content: [
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'What Social Media Marketing Is',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Why Social Media Matters',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'How to Get Started',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Key Elements of a Social Media Strategy',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Common Mistakes to Avoid',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'Social Media Metrics to Track',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            listItem: 'bullet',
            children: [
              {
                _type: 'span',
                text: 'How Virtual Assistants Can Help',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This free guide provides a step-by-step roadmap to streamline your social media efforts, so you can focus on growing your business. Download your free Social Media Strategy Checklist now to get started.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact Ready Set Group now!',
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
    subtitle: 'A Business Owner’s Guide to Tracking Campaign Performance',
    slug: { current: 'why-email-metrics-matter' },
    _updatedAt: new Date().toISOString(),
    category: 'Analytics',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Are you sending email after email without seeing the results you want? You’re not alone. Too many business owners rely on guesswork and ‘gut feelings’ when it comes to their email campaigns—only to be left wondering why open rates are low, conversions are stalled, and unsubscribe rates keep climbing.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This comprehensive guide takes the mystery out of email marketing metrics, showing you exactly what to track and why it matters. Discover how to optimize your campaigns step by step—from pinpointing subject lines that boost open rates, to refining your message so you attract the right audience and grow your bottom line.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'What You Will Get',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• What Happens When You Ignore Your Email Metrics',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Key Email Reporting Metrics You Should Know',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Email Campaign Performance Checklist',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• How It Will Help Your Business',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• When to Gather and Report Email Metrics',
                marks: []
              }
            ]
          },
          // Content that previously had 'title: null' is now directly part of 'mainContent' without a separate title.
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This free guide is your roadmap for crafting a winning email strategy—but for monitoring, forecasting, and other ‘menial tasks, delegate it to us!',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Download your free Email Metrics Template report now to get started.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['strong']
              },
              {
                _type: 'span',
                text: ' now!',
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
    subtitle: 'A Practical Guide',
    slug: { current: 'addressing-key-issues-in-delivery-logistics' },
    _updatedAt: new Date().toISOString(),
    category: 'Logistics',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Are you navigating the complex world of delivery logistics? This guide equips business owners with practical solutions to the most pressing challenges in the delivery market, from optimizing operations to managing costs and ensuring customer satisfaction.',
            marks: []
          }
        ]
      },
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Whether you\'re launching a new delivery service or scaling your operations, this guide provides actionable insights to help you stay competitive in an ever-evolving industry.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'Why this guide is essential:',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Understand Key Challenges: Gain insight into the most common issues faced in delivery logistics, such as last-mile delivery, cost management, and route optimization.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Actionable Solutions: Learn practical strategies to overcome logistical hurdles and enhance operational efficiency.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Improve Customer Satisfaction: Implement tips to enhance delivery speed, accuracy, and overall customer experience.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Save Time and Money: Identify cost-effective methods to streamline your logistics processes and boost profitability.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Download this must-read resource to take a step forward in mastering delivery logistics.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['strong'] // Assuming "Ready Set Group" is meant to be bold based on visual emphasis
              },
              {
                _type: 'span',
                text: ' now!',
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
    title: 'Email A/B Testing Made Simple:',
    subtitle: 'A Guide for Business Owners',
    slug: { current: 'email-testing-made-simple' },
    _updatedAt: new Date().toISOString(),
    category: 'Marketing',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'If you are a business owner, small business owner, or solopreneur looking to improve your email campaigns but are not sure where to start, A/B testing is your new best friend. It is not as complicated as it sounds, and the insights it provides can help you make informed decisions about what works - and what doesn\'t.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Inside this guide, you will learn what A/B testing is and how it works - explained simply, without the jargon. You\'ll discover key areas to test, like subject lines, CTAs, visuals, and timing, along with practical tips to run tests that lead to better open rates, clicks and conversions.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'What You Will Get',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• What Email A/B Testing is',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Why A/B Testing Matters',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• How to Get Started',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Key Email Elements to Test',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• When to A/B Test',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• Biggest A/B Testing Challenges',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• A/B Testing Checklist',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: '• 7 High-Performing Subject Line Strategies',
                marks: []
              }
            ]
          },
          // Content that previously had 'title: null' is now directly part of 'mainContent' without a separate title.
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This free guide is your roadmap for crafting a winning email strategy-but for monitoring, forecasting and other menial tasks, delegate it to us!',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Download your free Email Metrics Template report now to get started',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['strong']
              },
              {
                _type: 'span',
                text: ' now!',
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
    title: 'Social Media Strategy Guide & Template',
    subtitle: 'Your Roadmap to a More Purposeful Social Media Approach',
    slug: { current: 'social-media-strategy-guide-and-template' },
    _updatedAt: new Date().toISOString(),
    category: 'Marketing',
    introduction: [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            text: 'Managing social media can feel challenging. Many business owners struggle with creating a clear, focused strategy that drives engagement and results. This social media strategy guide provides a step-by-step approach to help you define your goals, identify your audience, select the best platforms, and create a content plan that works for your business.',
            marks: []
          }
        ]
      }
    ],
    mainContent: [
      {
        title: 'How This Guide Helps You',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This guide takes the guesswork out of social media management, covering everything from goal setting to audience identification, platform selection, and content creation. By following the steps in this guide, you\'ll learn how to create your own social media strategy template that is tailored to your business goals and needs.',
                marks: []
              }
            ]
          }
        ]
      },
      {
        title: 'What You Will Learn',
        content: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Defining Your Social Media Purpose: Understand why you\'re on social media—whether it\'s to build brand awareness, drive traffic, or generate leads.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Identifying Your Target Audience: Learn how to define and connect with your ideal customers.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Choosing the Right Platforms: Focus your efforts on platforms that align with where your audience spends their time.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'Content Planning & Creation: Develop a content calendar that includes the right mix of content types and formats.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'By following this guide, you\'ll be able to optimize your social media efforts, track your progress with KPIs, and create a social media strategy template that supports your business goals.',
                marks: []
              }
            ]
          },
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'If you found this guide helpful, share it with your network or schedule a consultation call with us. Ready to take the next step? Contact ',
                marks: []
              },
              {
                _type: 'span',
                text: 'Ready Set Group',
                marks: ['strong'] // Assuming "Ready Set Group" is meant to be bold based on visual emphasis
              },
              {
                _type: 'span',
                text: ' now!',
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

/**
 * Detect if we're in build/static generation environment
 */
function isBuildTime(): boolean {
  // Multiple checks to ensure we catch build time scenarios
  const isNodeEnvProduction = process.env.NODE_ENV === 'production';
  const hasVercelUrl = !!process.env.VERCEL_URL;
  const isServerSide = typeof window === 'undefined';
  const isNextBuild = process.env.npm_lifecycle_event === 'build';
  const isStaticGeneration = isServerSide && !hasVercelUrl;
  
  return isStaticGeneration || isNextBuild || (isNodeEnvProduction && !hasVercelUrl);
}

/**
 * Safely fetches guide data with proper error handling
 * During build time, uses static fallbacks to avoid Edge Runtime fetch issues
 */
export async function fetchGuideData(slug: string): Promise<Guide | null> {
  if (!slug) return null;
  
  try {
    // During build time, use static fallbacks to completely avoid fetch operations
    if (isBuildTime()) {
      console.log(`Build time detected, using static fallback for guide: ${slug}`);
      const staticGuide = STATIC_FALLBACK_GUIDES[slug];
      if (staticGuide) {
        return staticGuide;
      }
      
      console.warn(`No static fallback found for guide: ${slug}`);
      // Return a generic fallback guide
      return {
        _id: `static-${slug}`,
        title: 'Business Guide',
        subtitle: 'A helpful business guide',
        slug: { current: slug },
        _updatedAt: new Date().toISOString(),
        category: 'Business',
        introduction: [
          {
            _type: 'block',
            style: 'normal',
            children: [
              {
                _type: 'span',
                text: 'This is a comprehensive business guide to help you succeed.',
                marks: []
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
          metaTitle: `Business Guide | Ready Set LLC`,
          metaDescription: 'A comprehensive business guide to help you succeed.',
        }
      };
    }
    
    // Runtime: Try API route first, then fallback to direct query
    try {
      // Convert to absolute URL to avoid parsing errors during static generation
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const url = new URL(`/api/guides/${slug}`, baseUrl).toString();
      
      const response = await safeFetch<{data?: Guide}>(url);
      
      // Handle the nested data structure from the API response
      if (response && typeof response === 'object' && 'data' in response && response.data) {
        return response.data;
      }
      
      // Handle older API format without nested data
      if (response && typeof response === 'object' && '_id' in response) {
        return response as unknown as Guide;
      }
    } catch (apiError) {
      console.warn(`API fetch failed for guide ${slug}, falling back to direct query:`, apiError);
      // API route failed, trying direct Sanity query as fallback
    }
    
    // Fallback to direct Sanity query
    const guide = await getGuideBySlug(slug);
    return guide as unknown as Guide;
  } catch (error) {
    console.error(`Error fetching guide with slug ${slug}:`, error);
    
    // Final fallback: check static guides even during runtime
    const staticGuide = STATIC_FALLBACK_GUIDES[slug];
    if (staticGuide) {
      console.log(`Using static fallback for guide: ${slug}`);
      return staticGuide;
    }
    
    return null;
  }
} 