// __tests__/page.test.tsx
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Home, { metadata } from '@/app/page'
import { Metadata } from 'next'

// Mock the child components using jest.mock
jest.mock('@/components/Common/ScrollUp', () => ({
  default: () => <div data-testid="mock-scroll-up">ScrollUp Component</div>,
}));
jest.mock('@/components/Hero', () => ({
  default: () => <div data-testid="mock-hero">Hero Component</div>,
}));
jest.mock('@/components/Features', () => ({ default: () => <div data-testid="mock-features">Features</div> }));
jest.mock('@/components/About', () => ({ default: () => <div data-testid="mock-about">About</div> }));
jest.mock('@/components/FeaturesTab', () => ({ default: () => <div data-testid="mock-features-tab">FeaturesTab</div> }));
jest.mock('@/components/FunFact', () => ({ default: () => <div data-testid="mock-fun-fact">FunFact</div> }));
jest.mock('@/components/Integration', () => ({ default: () => <div data-testid="mock-integration">Integration</div> }));
jest.mock('@/components/CTA', () => ({ default: () => <div data-testid="mock-cta">CTA</div> }));
jest.mock('@/components/FAQ', () => ({ default: () => <div data-testid="mock-faq">FAQ</div> }));
jest.mock('@/components/Testimonial', () => ({ default: () => <div data-testid="mock-testimonial">Testimonial</div> }));
jest.mock('@/components/Contact', () => ({ default: () => <div data-testid="mock-contact">Contact</div> }));

describe('Home Page', () => {
  it('renders mocked components', () => {
    render(<Home />)

    // Check if mocked components are rendered
    expect(screen.getByTestId('mock-scroll-up')).toBeInTheDocument()
    expect(screen.getByTestId('mock-hero')).toBeInTheDocument()
    // expect(screen.getByTestId('mock-features')).toBeInTheDocument() // Removed as Features is not in Home
    // ... Add assertions for other mocked components that ARE rendered by Home
  })

  describe('Metadata', () => {
    const typedMetadata = metadata as Metadata

    it('has correct basic metadata', () => {
      expect(typedMetadata.title).toBe('Ready Set | Catering Delivery & Virtual Assistant Services')
      expect(typeof typedMetadata.description === 'string' && typedMetadata.description).toContain('Since 2019, Ready Set has been the trusted delivery partner')
    })

    it('has correct OpenGraph metadata', () => {
      const og = typedMetadata.openGraph
      expect(og?.title).toBe("Ready Set Group LLC | Bay Area's Premier Business Solutions Provider")
      expect(og?.siteName).toBe('Ready Set Group LLC')
      // Access other OpenGraph properties that are defined in the Metadata type
    })

    it('has correct Twitter metadata', () => {
      const twitter = typedMetadata.twitter
      expect(twitter?.title).toBe('Ready Set Group LLC | Catering Delivery & Virtual Assistant Services')
      // Access other Twitter properties that are defined in the Metadata type
    })

    it('has correct robot settings', () => {
      if (typeof typedMetadata.robots === 'object') {
        const robots = typedMetadata.robots
        expect(robots).toMatchObject({
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          }
        })
      }
    })

    it('has correct keywords', () => {
      const expectedKeywords = [
        'catering delivery',
        'virtual assistant services',
        'Bay Area logistics'
      ]
      
      const keywords = typedMetadata.keywords
      if (Array.isArray(keywords)) {
        expectedKeywords.forEach(keyword => {
          expect(keywords).toContain(keyword)
        })
      }
    })
  })
})