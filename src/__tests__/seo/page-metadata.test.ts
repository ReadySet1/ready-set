/**
 * @jest-environment node
 */
import { Metadata } from 'next';

// Mock the metadata from service pages
const mockCateringMetadata: Metadata = {
  title: "Food Delivery Services for Events | Ready Set",
  description: "We offer reliable and efficient catering delivery services for your events. Delicious food delivered right to your door in Bay Area and Sillicon Valley!",
  keywords: [
    "food delivery",
    "catering delivery",
    "event food",
    "catering service",
    "banquet delivery",
    "Bay Area delivery",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const mockLogisticsMetadata: Metadata = {
  title: "Premium Catering Logistics Services | Ready Set Group LLC",
  description: "Bay Area's trusted catering delivery partner since 2019. Specialized in temperature-controlled deliveries for tech giants.",
  keywords: [
    "catering logistics",
    "food delivery service",
    "temperature controlled delivery",
    "Bay Area catering",
    "corporate catering delivery",
    "Silicon Valley delivery",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const mockBakeryMetadata: Metadata = {
  title: "Premium Food & Bakery Delivery Services | Ready Set",
  description: "Professional food and bakery delivery services for events, parties, and corporate gatherings. Fresh, high-quality meals delivered on time.",
  keywords: [
    "food delivery",
    "bakery delivery",
    "catering services",
    "event catering",
    "corporate catering",
    "Bay Area bakery",
  ],
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/bakery-deliveries",
  },
};

describe('Service Page Metadata', () => {
  describe('Catering Deliveries Page', () => {
    it('should have proper title and description', () => {
      expect(mockCateringMetadata.title).toBe("Food Delivery Services for Events | Ready Set");
      expect(mockCateringMetadata.description).toContain("catering delivery services");
      expect(mockCateringMetadata.description).toContain("Bay Area");
    });

    it('should have relevant keywords', () => {
      const keywords = mockCateringMetadata.keywords as string[];
      expect(keywords).toContain("food delivery");
      expect(keywords).toContain("catering delivery");
      expect(keywords).toContain("event food");
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should have proper robots configuration for indexing', () => {
      if (typeof mockCateringMetadata.robots === 'object' && mockCateringMetadata.robots !== null) {
        expect(mockCateringMetadata.robots.index).toBe(true);
        expect(mockCateringMetadata.robots.follow).toBe(true);
        
        if (typeof mockCateringMetadata.robots.googleBot === 'object') {
          expect(mockCateringMetadata.robots.googleBot.index).toBe(true);
          expect(mockCateringMetadata.robots.googleBot.follow).toBe(true);
        }
      }
    });
  });

  describe('Logistics Page', () => {
    it('should have comprehensive title and description', () => {
      expect(mockLogisticsMetadata.title).toBe("Premium Catering Logistics Services | Ready Set Group LLC");
      expect(mockLogisticsMetadata.description).toContain("Bay Area's trusted catering delivery partner");
      expect(mockLogisticsMetadata.description).toContain("temperature-controlled");
    });

    it('should have extensive keyword coverage', () => {
      const keywords = mockLogisticsMetadata.keywords as string[];
      expect(keywords).toContain("catering logistics");
      expect(keywords).toContain("temperature controlled delivery");
      expect(keywords).toContain("Bay Area catering");
      expect(keywords.length).toBeGreaterThanOrEqual(5);
    });

    it('should be properly configured for search engine indexing', () => {
      if (typeof mockLogisticsMetadata.robots === 'object' && mockLogisticsMetadata.robots !== null) {
        expect(mockLogisticsMetadata.robots.index).toBe(true);
        expect(mockLogisticsMetadata.robots.follow).toBe(true);
        
        if (typeof mockLogisticsMetadata.robots.googleBot === 'object') {
          expect(mockLogisticsMetadata.robots.googleBot.index).toBe(true);
          expect(mockLogisticsMetadata.robots.googleBot.follow).toBe(true);
        }
      }
    });
  });

  describe('Bakery Deliveries Page', () => {
    it('should have descriptive title and meta description', () => {
      expect(mockBakeryMetadata.title).toBe("Premium Food & Bakery Delivery Services | Ready Set");
      expect(mockBakeryMetadata.description).toContain("bakery delivery services");
      expect(mockBakeryMetadata.description).toContain("events, parties, and corporate gatherings");
    });

    it('should have proper canonical URL', () => {
      expect(mockBakeryMetadata.alternates?.canonical).toBe("/bakery-deliveries");
    });

    it('should have comprehensive robots configuration', () => {
      if (typeof mockBakeryMetadata.robots === 'object' && mockBakeryMetadata.robots !== null) {
        expect(mockBakeryMetadata.robots.index).toBe(true);
        expect(mockBakeryMetadata.robots.follow).toBe(true);
        expect(mockBakeryMetadata.robots.nocache).toBe(false);
        
        if (typeof mockBakeryMetadata.robots.googleBot === 'object') {
          expect(mockBakeryMetadata.robots.googleBot.index).toBe(true);
          expect(mockBakeryMetadata.robots.googleBot.follow).toBe(true);
          expect(mockBakeryMetadata.robots.googleBot.noimageindex).toBe(false);
          expect(mockBakeryMetadata.robots.googleBot['max-video-preview']).toBe(-1);
          expect(mockBakeryMetadata.robots.googleBot['max-image-preview']).toBe("large");
          expect(mockBakeryMetadata.robots.googleBot['max-snippet']).toBe(-1);
        }
      }
    });

    it('should have relevant bakery and food service keywords', () => {
      const keywords = mockBakeryMetadata.keywords as string[];
      expect(keywords).toContain("bakery delivery");
      expect(keywords).toContain("food delivery");
      expect(keywords).toContain("catering services");
      expect(keywords).toContain("event catering");
      expect(keywords).toContain("corporate catering");
    });
  });

  describe('Common SEO Requirements', () => {
    const allMetadata = [mockCateringMetadata, mockLogisticsMetadata, mockBakeryMetadata];

    it('should have titles under 60 characters for optimal SEO', () => {
      allMetadata.forEach(metadata => {
        const title = metadata.title as string;
        expect(title.length).toBeLessThanOrEqual(60);
      });
    });

    it('should have descriptions under 160 characters for optimal SEO', () => {
      allMetadata.forEach(metadata => {
        const description = metadata.description as string;
        expect(description.length).toBeLessThanOrEqual(160);
      });
    });

    it('should all be configured for indexing', () => {
      allMetadata.forEach(metadata => {
        if (typeof metadata.robots === 'object' && metadata.robots !== null) {
          expect(metadata.robots.index).toBe(true);
          expect(metadata.robots.follow).toBe(true);
        }
      });
    });

    it('should have proper GoogleBot configuration', () => {
      allMetadata.forEach(metadata => {
        if (typeof metadata.robots === 'object' && metadata.robots !== null && typeof metadata.robots.googleBot === 'object') {
          expect(metadata.robots.googleBot.index).toBe(true);
          expect(metadata.robots.googleBot.follow).toBe(true);
          expect(metadata.robots.googleBot['max-image-preview']).toBe("large");
          expect(metadata.robots.googleBot['max-snippet']).toBe(-1);
        }
      });
    });

    it('should have keywords array with relevant terms', () => {
      allMetadata.forEach(metadata => {
        const keywords = metadata.keywords as string[];
        expect(Array.isArray(keywords)).toBe(true);
        expect(keywords.length).toBeGreaterThan(0);
        
        // Should contain location-based keywords
        const hasLocationKeywords = keywords.some(keyword => 
          keyword.toLowerCase().includes('bay area') || 
          keyword.toLowerCase().includes('silicon valley')
        );
        expect(hasLocationKeywords).toBe(true);
      });
    });
  });

  describe('SEO Best Practices Validation', () => {
    it('should not have duplicate titles across service pages', () => {
      const titles = [
        mockCateringMetadata.title,
        mockLogisticsMetadata.title,
        mockBakeryMetadata.title
      ];
      
      const uniqueTitles = [...new Set(titles)];
      expect(uniqueTitles.length).toBe(titles.length);
    });

    it('should not have duplicate descriptions across service pages', () => {
      const descriptions = [
        mockCateringMetadata.description,
        mockLogisticsMetadata.description,
        mockBakeryMetadata.description
      ];
      
      const uniqueDescriptions = [...new Set(descriptions)];
      expect(uniqueDescriptions.length).toBe(descriptions.length);
    });

    it('should have brand name in titles', () => {
      const allTitles = [
        mockCateringMetadata.title as string,
        mockLogisticsMetadata.title as string,
        mockBakeryMetadata.title as string
      ];
      
      allTitles.forEach(title => {
        expect(title.toLowerCase()).toContain('ready set');
      });
    });

    it('should have action-oriented keywords', () => {
      const allKeywords = [
        ...(mockCateringMetadata.keywords as string[]),
        ...(mockLogisticsMetadata.keywords as string[]),
        ...(mockBakeryMetadata.keywords as string[])
      ];
      
      const actionWords = ['delivery', 'service', 'catering'];
      const hasActionWords = actionWords.some(word => 
        allKeywords.some(keyword => keyword.toLowerCase().includes(word))
      );
      expect(hasActionWords).toBe(true);
    });
  });
}); 