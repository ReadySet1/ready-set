/**
 * Web Pricing Demo Page
 * Public route for interactive web development pricing tool
 */

import { Metadata } from 'next';
import WebPricingDemo from '@/components/web-pricing/WebPricingDemo';

export const metadata: Metadata = {
  title: 'Web Development Pricing | Ready Set',
  description:
    'Interactive pricing tool for web development services. Get instant quotes for marketing sites and e-commerce platforms with customizable add-ons.',
  openGraph: {
    title: 'Web Development Pricing Calculator | Ready Set',
    description:
      'Build your custom quote for marketing sites or e-commerce platforms. Select a package and customize with add-on features.',
    type: 'website',
  },
};

export default function WebPricingPage() {
  return <WebPricingDemo />;
}
