/**
 * MultiStopCalculatorDemo Component Tests
 *
 * Tests for the public-facing multi-stop delivery calculator demo component.
 *
 * Tests cover:
 * - Component rendering
 * - Form input interactions
 * - Multi-stop input controls (increment/decrement buttons)
 * - Real-time calculation display
 * - Extra stops highlighting
 * - CTA buttons
 * - Responsive behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiStopCalculatorDemo from '../MultiStopCalculatorDemo';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('MultiStopCalculatorDemo Component', () => {
  describe('Initial Rendering', () => {
    it('should render the calculator title', () => {
      render(<MultiStopCalculatorDemo />);
      expect(screen.getByText('Delivery Cost Calculator')).toBeInTheDocument();
    });

    it('should render the demo badge', () => {
      render(<MultiStopCalculatorDemo />);
      expect(screen.getByText('Interactive Demo')).toBeInTheDocument();
    });

    it('should render all input fields', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByLabelText('Headcount')).toBeInTheDocument();
      expect(screen.getByLabelText('Food Cost ($)')).toBeInTheDocument();
      // Address inputs are shown by default (not mileage input)
      expect(screen.getByText('Pickup Address')).toBeInTheDocument();
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Number of Stops')).toBeInTheDocument();
      expect(screen.getByLabelText('Requires Bridge Crossing')).toBeInTheDocument();
    });

    it('should render with default values', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByLabelText('Headcount')).toHaveValue(50);
      expect(screen.getByLabelText('Food Cost ($)')).toHaveValue(500);
      expect(screen.getByLabelText('Number of Stops')).toHaveValue(1);
    });

    it('should render manual mileage toggle', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByLabelText('Enter manually')).toBeInTheDocument();
    });

    it('should render the multi-stop feature badge', () => {
      render(<MultiStopCalculatorDemo />);
      expect(screen.getByText('New Feature')).toBeInTheDocument();
    });

    it('should render CTA buttons', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByRole('link', { name: /Sign Up Free/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Contact Sales/i })).toBeInTheDocument();
    });

    it('should render the pricing explanation section', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByText('How Multi-Stop Pricing Works')).toBeInTheDocument();
      expect(screen.getByText('First Stop')).toBeInTheDocument();
      expect(screen.getByText('Additional Stops')).toBeInTheDocument();
      expect(screen.getByText('Driver Bonus')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should update headcount input', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const headcountInput = screen.getByLabelText('Headcount');
      await user.clear(headcountInput);
      await user.type(headcountInput, '100');

      expect(headcountInput).toHaveValue(100);
    });

    it('should update food cost input', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const foodCostInput = screen.getByLabelText('Food Cost ($)');
      await user.clear(foodCostInput);
      await user.type(foodCostInput, '1000');

      expect(foodCostInput).toHaveValue(1000);
    });

    it('should update mileage input when in manual mode', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable manual mileage mode
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      const mileageInput = screen.getByLabelText('Total Mileage (round trip)');
      await user.clear(mileageInput);
      await user.type(mileageInput, '25');

      expect(mileageInput).toHaveValue(25);
    });

    it('should toggle bridge crossing switch', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const bridgeSwitch = screen.getByRole('switch', { name: /Requires Bridge Crossing/i });
      expect(bridgeSwitch).not.toBeChecked();

      await user.click(bridgeSwitch);
      expect(bridgeSwitch).toBeChecked();
    });
  });

  describe('Multi-Stop Input Controls', () => {
    it('should increment number of stops with + button', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const stopsInput = screen.getByLabelText('Number of Stops');
      const incrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '+'
      );

      expect(stopsInput).toHaveValue(1);

      await user.click(incrementButton!);
      expect(stopsInput).toHaveValue(2);

      await user.click(incrementButton!);
      expect(stopsInput).toHaveValue(3);
    });

    it('should decrement number of stops with - button', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const stopsInput = screen.getByLabelText('Number of Stops');
      const incrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '+'
      );
      const decrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '-'
      );

      // First increment to 3
      await user.click(incrementButton!);
      await user.click(incrementButton!);
      expect(stopsInput).toHaveValue(3);

      // Then decrement
      await user.click(decrementButton!);
      expect(stopsInput).toHaveValue(2);
    });

    it('should not allow decrement below 1', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const stopsInput = screen.getByLabelText('Number of Stops');
      const decrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '-'
      );

      expect(stopsInput).toHaveValue(1);

      // Should be disabled at 1
      expect(decrementButton).toBeDisabled();

      // Clicking should not change value
      await user.click(decrementButton!);
      expect(stopsInput).toHaveValue(1);
    });

    it('should have number type input for stops', () => {
      render(<MultiStopCalculatorDemo />);

      const stopsInput = screen.getByLabelText('Number of Stops');
      expect(stopsInput).toHaveAttribute('type', 'number');
      expect(stopsInput).toHaveAttribute('min', '1');
    });
  });

  describe('Real-time Calculation Display', () => {
    it('should display calculation results on initial render', () => {
      render(<MultiStopCalculatorDemo />);

      // Should show Customer Charges section
      expect(screen.getByText('Customer Charges')).toBeInTheDocument();

      // Should show Driver Earnings section
      expect(screen.getByText('Driver Earnings')).toBeInTheDocument();

      // Should show totals
      expect(screen.getByText('Total Delivery Fee:')).toBeInTheDocument();
      expect(screen.getByText('Total Driver Pay:')).toBeInTheDocument();
    });

    it('should display base delivery fee', () => {
      render(<MultiStopCalculatorDemo />);
      expect(screen.getByText('Base Delivery Fee:')).toBeInTheDocument();
    });

    it('should display driver base pay', () => {
      render(<MultiStopCalculatorDemo />);
      expect(screen.getByText('Base Pay:')).toBeInTheDocument();
    });

    it('should have calculation input fields that are editable', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Check headcount input is editable
      const headcountInput = screen.getByLabelText('Headcount');
      expect(headcountInput).not.toBeDisabled();

      // Check food cost input is editable
      const foodCostInput = screen.getByLabelText('Food Cost ($)');
      expect(foodCostInput).not.toBeDisabled();

      // Enable manual mileage mode first
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      // Check mileage input is editable when in manual mode
      const mileageInput = screen.getByLabelText('Total Mileage (round trip)');
      expect(mileageInput).not.toBeDisabled();
    });
  });

  describe('Extra Stops Display', () => {
    it('should have multi-stop delivery section', () => {
      render(<MultiStopCalculatorDemo />);

      // Check that the multi-stop section exists
      expect(screen.getByText('Multi-Stop Delivery')).toBeInTheDocument();
    });

    it('should display the number of stops input', () => {
      render(<MultiStopCalculatorDemo />);

      // Check that the stops input field exists
      const stopsInput = screen.getByLabelText('Number of Stops');
      expect(stopsInput).toBeInTheDocument();
      expect(stopsInput).toHaveValue(1);
    });

    it('should have increment and decrement buttons for stops', () => {
      render(<MultiStopCalculatorDemo />);

      // Should have + and - buttons
      const incrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '+'
      );
      const decrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '-'
      );

      expect(incrementButton).toBeInTheDocument();
      expect(decrementButton).toBeInTheDocument();
    });

    it('should have pricing explanation that mentions customer charge', () => {
      render(<MultiStopCalculatorDemo />);

      // Check the pricing info section mentions the charge
      expect(screen.getByText(/\$5\.00 per extra stop/i)).toBeInTheDocument();
    });

    it('should have pricing explanation that mentions driver bonus', () => {
      render(<MultiStopCalculatorDemo />);

      // Check the pricing info section mentions driver bonus
      expect(screen.getByText(/\$2\.50 bonus per additional stop/i)).toBeInTheDocument();
    });

    it('should explain first stop is included', () => {
      render(<MultiStopCalculatorDemo />);

      // Check the pricing info section explains first stop inclusion
      expect(screen.getByText(/First Stop/i)).toBeInTheDocument();
      expect(screen.getByText(/included in the base delivery fee/i)).toBeInTheDocument();
    });

    it('should explain additional stops pricing', () => {
      render(<MultiStopCalculatorDemo />);

      // Check the pricing info section explains additional stops
      expect(screen.getByText(/Additional Stops/i)).toBeInTheDocument();
    });
  });

  describe('CTA Links', () => {
    it('should have correct href for Sign Up button', () => {
      render(<MultiStopCalculatorDemo />);

      const signUpLink = screen.getByRole('link', { name: /Sign Up Free/i });
      expect(signUpLink).toHaveAttribute('href', '/sign-up');
    });

    it('should have correct href for Contact Sales button', () => {
      render(<MultiStopCalculatorDemo />);

      const contactLink = screen.getByRole('link', { name: /Contact Sales/i });
      expect(contactLink).toHaveAttribute('href', '/contact');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid headcount gracefully', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const headcountInput = screen.getByLabelText('Headcount');
      await user.clear(headcountInput);
      await user.type(headcountInput, '-10');

      // Should show error or handle gracefully
      // The component should not crash
      expect(screen.getByText('Delivery Cost Calculator')).toBeInTheDocument();
    });

    it('should handle invalid food cost gracefully', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      const foodCostInput = screen.getByLabelText('Food Cost ($)');
      await user.clear(foodCostInput);
      await user.type(foodCostInput, '-500');

      // Should show error or handle gracefully
      expect(screen.getByText('Delivery Cost Calculator')).toBeInTheDocument();
    });

    it('should handle invalid mileage gracefully', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable manual mileage mode first
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      const mileageInput = screen.getByLabelText('Total Mileage (round trip)');
      await user.clear(mileageInput);
      await user.type(mileageInput, '-20');

      // Should show error or handle gracefully
      expect(screen.getByText('Delivery Cost Calculator')).toBeInTheDocument();
    });
  });

  describe('Bridge Toll Calculation', () => {
    it('should show bridge toll in results when enabled', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable bridge crossing
      const bridgeSwitch = screen.getByRole('switch', { name: /Requires Bridge Crossing/i });
      await user.click(bridgeSwitch);

      await waitFor(() => {
        // Check that Bridge Toll text appears somewhere
        const bridgeTollElements = screen.queryAllByText(/Bridge Toll/i);
        expect(bridgeTollElements.length).toBeGreaterThan(0);
      });
    });

    it('should include bridge toll with extra stops', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Set to 2 stops
      const incrementButton = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '+'
      );
      await user.click(incrementButton!);

      // Enable bridge crossing
      const bridgeSwitch = screen.getByRole('switch', { name: /Requires Bridge Crossing/i });
      await user.click(bridgeSwitch);

      await waitFor(() => {
        // Should show extra stops
        expect(screen.getAllByText(/Extra Stops/i).length).toBeGreaterThan(0);
        // Bridge toll should be present in the component
        const bridgeTollElements = screen.queryAllByText(/Bridge Toll/i);
        expect(bridgeTollElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for all inputs', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByLabelText('Headcount')).toBeInTheDocument();
      expect(screen.getByLabelText('Food Cost ($)')).toBeInTheDocument();
      expect(screen.getByText('Pickup Address')).toBeInTheDocument();
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Number of Stops')).toBeInTheDocument();
      expect(screen.getByLabelText('Requires Bridge Crossing')).toBeInTheDocument();
    });

    it('should have accessible mileage input in manual mode', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable manual mileage mode
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      expect(screen.getByLabelText('Total Mileage (round trip)')).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      render(<MultiStopCalculatorDemo />);

      // Increment/decrement buttons should exist
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Address-Based Distance Calculation', () => {
    it('should show address inputs by default', () => {
      render(<MultiStopCalculatorDemo />);

      expect(screen.getByText('Pickup Address')).toBeInTheDocument();
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., 1 Market St, San Francisco, CA')).toBeInTheDocument();
    });

    it('should show manual mileage input when toggle is enabled', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable manual mode
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      // Should now show mileage input
      expect(screen.getByLabelText('Total Mileage (round trip)')).toBeInTheDocument();
      expect(screen.getByLabelText('Total Mileage (round trip)')).toHaveValue(15);
    });

    it('should hide address inputs when manual mode is enabled', async () => {
      const user = userEvent.setup();
      render(<MultiStopCalculatorDemo />);

      // Enable manual mode
      const manualToggle = screen.getByLabelText('Enter manually');
      await user.click(manualToggle);

      // Address inputs should be hidden
      expect(screen.queryByPlaceholderText('e.g., 1 Market St, San Francisco, CA')).not.toBeInTheDocument();
    });

    it('should have Check buttons for address inputs', () => {
      render(<MultiStopCalculatorDemo />);

      // Should have Check buttons for geocoding
      const checkButtons = screen.getAllByRole('button', { name: /^Check$/i });
      expect(checkButtons.length).toBe(2); // One for pickup, one for delivery
    });

    it('should show helper text about entering addresses', () => {
      render(<MultiStopCalculatorDemo />);

      expect(
        screen.getByText(/Enter both addresses and click "Check" to auto-calculate distance/i)
      ).toBeInTheDocument();
    });
  });
});
