/**
 * WebPricingDemo Component Tests
 *
 * Integration tests for the web development pricing tool component.
 *
 * Tests cover:
 * - Component rendering
 * - Package selection interactions
 * - Add-on selection and deselection
 * - Real-time pricing calculation display
 * - Discount badge display
 * - Incompatible add-on handling
 * - CTA buttons
 * - Responsive behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebPricingDemo from '../WebPricingDemo';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, style, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div className={className} onClick={onClick} style={style} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('WebPricingDemo Component', () => {
  describe('Initial Rendering', () => {
    it('should render the page title', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Web Development Pricing')).toBeInTheDocument();
    });

    it('should render the interactive pricing tool badge', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Interactive Pricing Tool')).toBeInTheDocument();
    });

    it('should render the section headers', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Choose Your Package')).toBeInTheDocument();
      expect(screen.getByText('Customize with Add-ons')).toBeInTheDocument();
    });

    it('should render Marketing Sites section', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Marketing Sites')).toBeInTheDocument();
      expect(screen.getByText('Showcase your brand online')).toBeInTheDocument();
    });

    it('should render E-commerce Sites section', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('E-commerce Sites')).toBeInTheDocument();
      expect(screen.getByText('Sell products online')).toBeInTheDocument();
    });

    it('should render all four package tiers', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Marketing Essential')).toBeInTheDocument();
      expect(screen.getByText('Marketing Professional')).toBeInTheDocument();
      expect(screen.getByText('E-commerce Starter')).toBeInTheDocument();
      expect(screen.getByText('E-commerce Growth')).toBeInTheDocument();
    });

    it('should render placeholder when no package is selected', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Select a package to see pricing')).toBeInTheDocument();
    });

    it('should render pricing placeholder', () => {
      render(<WebPricingDemo />);
      // The pricing section shows a placeholder initially
      const dollarIcons = document.querySelectorAll('svg');
      expect(dollarIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Package Pricing Display', () => {
    it('should display Marketing Essential pricing', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('$2,500')).toBeInTheDocument();
      expect(screen.getByText('$3,125')).toBeInTheDocument(); // Original price
    });

    it('should display Marketing Professional pricing', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('$6,250')).toBeInTheDocument(); // Original price
    });

    it('should display E-commerce Starter pricing', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('$7,500')).toBeInTheDocument();
    });

    it('should display E-commerce Growth pricing', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('$15,000')).toBeInTheDocument();
    });

    it('should show savings badge on discounted packages', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Save $625')).toBeInTheDocument(); // Marketing Essential savings
      expect(screen.getByText('Save $1,250')).toBeInTheDocument(); // Marketing Professional savings
    });

    it('should show Most Popular badge', () => {
      render(<WebPricingDemo />);
      expect(screen.getAllByText('Most Popular').length).toBeGreaterThan(0);
    });
  });

  describe('Package Selection', () => {
    it('should update pricing when Marketing Essential is selected', async () => {
      render(<WebPricingDemo />);

      // Click on Marketing Essential card
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      expect(marketingEssentialCard).toBeInTheDocument();
      fireEvent.click(marketingEssentialCard!);

      // Wait for pricing to update
      await waitFor(() => {
        expect(screen.getByText('Base package')).toBeInTheDocument();
      });

      // Check that one-time and monthly costs are displayed
      expect(screen.getByText('One-time')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('should show selected state on clicked package', async () => {
      render(<WebPricingDemo />);

      // Click on Marketing Essential card
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      // Should show "Selected" button state
      await waitFor(() => {
        expect(screen.getByText('Selected')).toBeInTheDocument();
      });
    });

    it('should calculate year one total correctly', async () => {
      render(<WebPricingDemo />);

      // Click on Marketing Essential ($2,500 + $75/mo = $3,400 year 1)
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('$3,400')).toBeInTheDocument();
      });
    });
  });

  describe('Add-on Features', () => {
    it('should show add-on placeholder when no package is selected', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Select a package above to customize with add-ons')).toBeInTheDocument();
    });

    it('should display add-on categories after package selection', async () => {
      render(<WebPricingDemo />);

      // Select a package first
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Development')).toBeInTheDocument();
        expect(screen.getByText('Integrations')).toBeInTheDocument();
        expect(screen.getByText('Hosting & Infrastructure')).toBeInTheDocument();
        expect(screen.getByText('Maintenance & Support')).toBeInTheDocument();
      });
    });

    it('should display add-on features with pricing', async () => {
      render(<WebPricingDemo />);

      // Select a package first
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('Custom Design Package')).toBeInTheDocument();
        expect(screen.getByText('Logo Design')).toBeInTheDocument();
        expect(screen.getByText('Member Portal')).toBeInTheDocument();
      });
    });

    it('should toggle add-on selection', async () => {
      const user = userEvent.setup();
      render(<WebPricingDemo />);

      // Select a package first
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('Custom Design Package')).toBeInTheDocument();
      });

      // Find and click the checkbox for Custom Design Package
      const checkbox = screen.getByRole('checkbox', { name: /Custom Design Package/i });
      await user.click(checkbox);

      // Pricing should update to include add-on
      await waitFor(() => {
        // $2,500 (package) + $1,500 (custom design) = $4,000 one-time
        expect(screen.getByText('$4,000')).toBeInTheDocument();
      });
    });

    it('should update add-on count in quote', async () => {
      const user = userEvent.setup();
      render(<WebPricingDemo />);

      // Select a package
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('0 add-ons selected')).toBeInTheDocument();
      });

      // Select an add-on
      const checkbox = screen.getByRole('checkbox', { name: /Custom Design Package/i });
      await user.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText('1 add-on selected')).toBeInTheDocument();
      });
    });
  });

  describe('Incompatible Add-ons', () => {
    it('should show disabled state for e-commerce-only add-ons with marketing tier', async () => {
      render(<WebPricingDemo />);

      // Select Marketing Essential
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        // ERP Integration should be disabled
        const erpCheckbox = screen.getByRole('checkbox', { name: /ERP Integration/i });
        expect(erpCheckbox).toBeDisabled();
      });
    });

    it('should show explanation for disabled add-ons', async () => {
      render(<WebPricingDemo />);

      // Select Marketing Essential
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        // Multiple add-ons may show this message
        const explanations = screen.getAllByText('Not available for this package');
        expect(explanations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Package Switching', () => {
    it('should allow switching between packages', async () => {
      render(<WebPricingDemo />);

      // Select E-commerce Starter
      const ecommerceStarterCard = screen.getByText('E-commerce Starter').closest('div[class*="cursor-pointer"]');
      fireEvent.click(ecommerceStarterCard!);

      await waitFor(() => {
        // Check that E-commerce Starter is reflected in the quote
        expect(screen.getByText('Base package')).toBeInTheDocument();
      });

      // Now switch to Marketing Essential
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      // The pricing should update for Marketing Essential
      await waitFor(() => {
        // Year 1 total for Marketing Essential: $2,500 + ($75 × 12) = $3,400
        expect(screen.getByText('$3,400')).toBeInTheDocument();
      });
    });
  });

  describe('What\'s Included Section', () => {
    it('should render the info footer section', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText("What's Included in Every Project")).toBeInTheDocument();
    });

    it('should display all included items', () => {
      render(<WebPricingDemo />);
      expect(screen.getByText('Development Process')).toBeInTheDocument();
      expect(screen.getByText('Training & Handoff')).toBeInTheDocument();
      expect(screen.getByText('Post-Launch Support')).toBeInTheDocument();
    });
  });

  describe('CTA Section', () => {
    it('should be rendered after package selection', async () => {
      render(<WebPricingDemo />);

      // Select a package to show the full quote card
      const marketingEssentialCard = screen.getByText('Marketing Essential').closest('div[class*="cursor-pointer"]');
      fireEvent.click(marketingEssentialCard!);

      await waitFor(() => {
        expect(screen.getByText('Ready to Get Started?')).toBeInTheDocument();
      });
    });
  });

  describe('Tier Features Display', () => {
    it('should display page count for packages', () => {
      render(<WebPricingDemo />);
      // Marketing Essential has 5 pages
      expect(screen.getByText('5')).toBeInTheDocument();
      // Marketing Professional has 15 pages
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should display product limit for e-commerce packages', () => {
      render(<WebPricingDemo />);
      // E-commerce Starter has 50 products
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should display unlimited indicator for unlimited values', () => {
      render(<WebPricingDemo />);
      // E-commerce Growth has unlimited pages and products
      expect(screen.getAllByText('∞').length).toBeGreaterThan(0);
    });
  });

  describe('Feature List', () => {
    it('should show "more included" indicator for packages with many features', () => {
      render(<WebPricingDemo />);
      // Multiple packages show "more included" text
      const moreIncludedElements = screen.getAllByText(/more included/);
      expect(moreIncludedElements.length).toBeGreaterThan(0);
    });
  });
});
