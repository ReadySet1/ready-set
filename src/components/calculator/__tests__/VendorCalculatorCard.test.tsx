/**
 * Tests for VendorCalculatorCard
 *
 * Coverage:
 * 1. Renders all input controls.
 * 2. Entering values and triggering a calc shows the returned total.
 * 3. requiresCustomQuote response shows the contact-us message, not a total.
 * 4. isFallbackPricing response shows the standard-pricing note.
 * 5. Asserts no internal labels (driver pay / margin / RS fee) ever appear.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorCalculatorCard from '../VendorCalculatorCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock return value for useVendorQuote — tests mutate this
const mockHookReturn = {
  data: null as ReturnType<typeof import('@/hooks/useVendorQuote').useVendorQuote>['data'],
  isLoading: false,
  error: null as string | null,
};

jest.mock('@/hooks/useVendorQuote', () => ({
  useVendorQuote: () => mockHookReturn,
}));

// Radix Select uses pointer events; JSDOM needs this
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  // Radix checks for pointer events support
  Object.defineProperty(window, 'PointerEvent', {
    value: class PointerEvent extends Event {
      readonly pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    },
  });
});

beforeEach(() => {
  mockHookReturn.data = null;
  mockHookReturn.isLoading = false;
  mockHookReturn.error = null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard successful quote response */
const STANDARD_QUOTE = {
  deliveryCost: 90,
  mileageSurcharge: 12,
  multiDriveDiscount: 0,
  extraStopsCharge: 0,
  bridgeToll: 0,
  totalDeliveryFee: 102,
  pricingProfileLabel: 'Ready Set Food - Standard',
  isFallbackPricing: false,
  requiresCustomQuote: false,
};

// Forbidden terms that must NEVER appear in the rendered output
const FORBIDDEN_LABELS = [
  'Driver Pay',
  'Driver Base Pay',
  'Driver Bonus',
  'Driver Earnings',
  'Total Driver Pay',
  'Ready Set Fee',
  'RS Fee',
  'Margin',
  'Driver Mileage',
  'Addon Fee',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VendorCalculatorCard', () => {
  // ── Input rendering ───────────────────────────────────────────────────

  describe('input controls', () => {
    it('renders all expected input fields', () => {
      render(<VendorCalculatorCard />);

      expect(screen.getByLabelText(/headcount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/food cost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total mileage/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/drives scheduled today/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/number of stops/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bridge toll required/i)).toBeInTheDocument();
    });

    it('renders the card titles', () => {
      render(<VendorCalculatorCard />);

      expect(screen.getByText('Delivery Cost Estimator')).toBeInTheDocument();
      expect(screen.getByText('Estimated Delivery Fee')).toBeInTheDocument();
    });
  });

  // ── Displaying results ────────────────────────────────────────────────

  describe('result display', () => {
    it('shows the total delivery fee from the quote', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      const totalEl = screen.getByTestId('total-delivery-fee');
      expect(totalEl).toHaveTextContent('$102.00');
    });

    it('shows delivery cost in the breakdown', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Delivery Cost')).toBeInTheDocument();
      expect(screen.getByText('$90.00')).toBeInTheDocument();
    });

    it('shows mileage surcharge when > 0', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Mileage Surcharge')).toBeInTheDocument();
      expect(screen.getByText('$12.00')).toBeInTheDocument();
    });

    it('shows multi-drive discount as a credit line when > 0', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        multiDriveDiscount: 10,
        totalDeliveryFee: 92,
      };

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Multi-Drive Discount')).toBeInTheDocument();
      expect(screen.getByText('-$10.00')).toBeInTheDocument();
    });

    it('shows extra stops charge when > 0', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        extraStopsCharge: 10,
        totalDeliveryFee: 112,
      };

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Extra Stops')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('shows bridge toll when > 0', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        bridgeToll: 8.5,
        totalDeliveryFee: 110.5,
      };

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Bridge Toll')).toBeInTheDocument();
      expect(screen.getByText('$8.50')).toBeInTheDocument();
    });

    it('shows the pricing profile label', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      expect(
        screen.getByText(/Ready Set Food - Standard/),
      ).toBeInTheDocument();
    });
  });

  // ── Custom quote ──────────────────────────────────────────────────────

  describe('custom quote required', () => {
    it('shows the contact-us message when requiresCustomQuote is true', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        requiresCustomQuote: true,
        totalDeliveryFee: 0,
      };

      render(<VendorCalculatorCard />);

      expect(
        screen.getByText(/this order needs a custom quote/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/please contact us/i),
      ).toBeInTheDocument();
    });

    it('does NOT show a total fee when requiresCustomQuote is true', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        requiresCustomQuote: true,
        totalDeliveryFee: 0,
      };

      render(<VendorCalculatorCard />);

      expect(screen.queryByTestId('total-delivery-fee')).not.toBeInTheDocument();
    });
  });

  // ── Fallback pricing ──────────────────────────────────────────────────

  describe('fallback pricing', () => {
    it('shows "Showing standard pricing." when isFallbackPricing is true', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        isFallbackPricing: true,
      };

      render(<VendorCalculatorCard />);

      expect(screen.getByTestId('fallback-pricing-note')).toHaveTextContent(
        /showing standard pricing/i,
      );
    });

    it('does NOT show fallback note when isFallbackPricing is false', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      expect(
        screen.queryByTestId('fallback-pricing-note'),
      ).not.toBeInTheDocument();
    });
  });

  // ── Security: no internal labels ──────────────────────────────────────

  describe('security — no internal labels', () => {
    it('never renders driver pay, margin, or RS fee labels in a normal quote', () => {
      mockHookReturn.data = STANDARD_QUOTE;

      render(<VendorCalculatorCard />);

      for (const label of FORBIDDEN_LABELS) {
        expect(screen.queryByText(new RegExp(label, 'i'))).not.toBeInTheDocument();
      }
    });

    it('never renders driver pay, margin, or RS fee labels in a custom-quote response', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        requiresCustomQuote: true,
      };

      render(<VendorCalculatorCard />);

      for (const label of FORBIDDEN_LABELS) {
        expect(screen.queryByText(new RegExp(label, 'i'))).not.toBeInTheDocument();
      }
    });

    it('never renders driver pay, margin, or RS fee labels in a fallback-pricing response', () => {
      mockHookReturn.data = {
        ...STANDARD_QUOTE,
        isFallbackPricing: true,
      };

      render(<VendorCalculatorCard />);

      for (const label of FORBIDDEN_LABELS) {
        expect(screen.queryByText(new RegExp(label, 'i'))).not.toBeInTheDocument();
      }
    });
  });

  // ── Loading & error states ────────────────────────────────────────────

  describe('loading and error states', () => {
    it('shows a loading indicator when isLoading and no data', () => {
      mockHookReturn.isLoading = true;
      mockHookReturn.data = null;

      render(<VendorCalculatorCard />);

      expect(screen.getByText(/calculating/i)).toBeInTheDocument();
    });

    it('shows an error message when there is an error', () => {
      mockHookReturn.error = 'Something went wrong';

      render(<VendorCalculatorCard />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('shows empty state when no data, not loading, no error', () => {
      render(<VendorCalculatorCard />);

      expect(
        screen.getByText(/enter your delivery details/i),
      ).toBeInTheDocument();
    });
  });
});
