/**
 * Unit tests for CostEstimatorCard component
 * Tests the delivery cost estimator UI used in vendor order forms
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostEstimatorCard } from '../CostEstimatorCard';
import { calculateDeliveryCost } from '@/lib/calculator/delivery-cost-calculator';

// Mock the delivery cost calculator
jest.mock('@/lib/calculator/delivery-cost-calculator', () => ({
  calculateDeliveryCost: jest.fn(),
}));

const mockCalculateDeliveryCost = calculateDeliveryCost as jest.MockedFunction<
  typeof calculateDeliveryCost
>;

describe('CostEstimatorCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the component with header', () => {
      render(<CostEstimatorCard headcount={50} />);

      expect(screen.getByText('Delivery Cost Estimator')).toBeInTheDocument();
      expect(screen.getByText('Ready Set flat rate pricing')).toBeInTheDocument();
    });

    it('should render distance input field', () => {
      render(<CostEstimatorCard headcount={50} />);

      expect(screen.getByLabelText(/Delivery Distance/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Enter estimated distance/i)
      ).toBeInTheDocument();
    });

    it('should be collapsible', () => {
      render(<CostEstimatorCard headcount={50} />);

      const headerButton = screen.getByRole('button', {
        name: /Delivery Cost Estimator/i,
      });

      // Initially expanded
      expect(screen.getByLabelText(/Delivery Distance/i)).toBeInTheDocument();

      // Click to collapse (use fireEvent instead of userEvent to work with fake timers)
      fireEvent.click(headerButton);

      // Distance input should be hidden
      expect(
        screen.queryByLabelText(/Delivery Distance/i)
      ).not.toBeInTheDocument();

      // Click to expand again
      fireEvent.click(headerButton);

      expect(screen.getByLabelText(/Delivery Distance/i)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CostEstimatorCard headcount={50} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Validation Messages', () => {
    it('should show message when headcount is 0 or missing', () => {
      render(<CostEstimatorCard headcount={0} />);

      expect(
        screen.getByText(/Enter headcount above to see delivery estimate/i)
      ).toBeInTheDocument();
    });

    it('should show message when distance is not entered', () => {
      render(<CostEstimatorCard headcount={50} />);

      expect(
        screen.getByText(/Enter delivery distance to calculate estimate/i)
      ).toBeInTheDocument();
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost when headcount and distance are provided', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 15,
        bridgeToll: 0,
        deliveryFee: 70,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '15' } });

      // Advance timers for debounce (300ms)
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith({
          headcount: 50,
          foodCost: 0,
          totalMileage: 15,
          numberOfDrives: 1,
          clientConfigId: 'ready-set-food-standard',
        });
      });

      // Check breakdown is displayed
      expect(screen.getByText(/Base Delivery Fee/i)).toBeInTheDocument();
      expect(screen.getByText('$55.00')).toBeInTheDocument();
      expect(screen.getByText(/Mileage/i)).toBeInTheDocument();
      expect(screen.getByText('$15.00')).toBeInTheDocument();
      expect(screen.getByText('$70.00')).toBeInTheDocument();
    });

    it('should not show mileage when distance is under 10 miles', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 30,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 30,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={20} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '8' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Price appears twice when base equals total (base fee and total)
        expect(screen.getAllByText('$30.00')).toHaveLength(2);
      });

      // Mileage section should not appear when totalMileagePay is 0
      expect(screen.queryByText(/Mileage \(/)).not.toBeInTheDocument();
    });

    it('should show bridge toll when applicable', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 0,
        bridgeToll: 7.5,
        deliveryFee: 62.5,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Bridge Toll')).toBeInTheDocument();
        expect(screen.getByText('$7.50')).toBeInTheDocument();
      });
    });

    it('should debounce calculations', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 30,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 30,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={20} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);

      // Type multiple values quickly
      fireEvent.change(distanceInput, { target: { value: '5' } });
      fireEvent.change(distanceInput, { target: { value: '10' } });
      fireEvent.change(distanceInput, { target: { value: '15' } });

      // Before debounce completes
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(mockCalculateDeliveryCost).not.toHaveBeenCalled();

      // After debounce
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        // Should only be called once with final value
        expect(mockCalculateDeliveryCost).toHaveBeenCalledTimes(1);
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith(
          expect.objectContaining({ totalMileage: 15 })
        );
      });
    });
  });

  describe('Apply to Order Total', () => {
    it('should call onEstimatedCostChange when calculation completes', async () => {
      const onEstimatedCostChange = jest.fn();

      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 15,
        bridgeToll: 0,
        deliveryFee: 70,
        driverPay: 0,
        companyProfit: 0,
      });

      render(
        <CostEstimatorCard
          headcount={50}
          onEstimatedCostChange={onEstimatedCostChange}
        />
      );

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '15' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(onEstimatedCostChange).toHaveBeenCalledWith(70);
      });
    });

    it('should render Apply button when callback is provided', async () => {
      const onEstimatedCostChange = jest.fn();

      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 55,
        driverPay: 0,
        companyProfit: 0,
      });

      render(
        <CostEstimatorCard
          headcount={50}
          onEstimatedCostChange={onEstimatedCostChange}
        />
      );

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Apply to Order Total')).toBeInTheDocument();
      });
    });

    it('should call onEstimatedCostChange when Apply button is clicked', async () => {
      const onEstimatedCostChange = jest.fn();

      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 55,
        driverPay: 0,
        companyProfit: 0,
      });

      render(
        <CostEstimatorCard
          headcount={50}
          onEstimatedCostChange={onEstimatedCostChange}
        />
      );

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Apply to Order Total')).toBeInTheDocument();
      });

      // Clear previous calls
      onEstimatedCostChange.mockClear();

      const applyButton = screen.getByText('Apply to Order Total');
      // Use fireEvent instead of userEvent to work with fake timers
      fireEvent.click(applyButton);

      expect(onEstimatedCostChange).toHaveBeenCalledWith(55);
    });

    it('should not render Apply button when callback is not provided', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 55,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Price appears twice (base fee and total), so use getAllByText
        expect(screen.getAllByText('$55.00')).toHaveLength(2);
      });

      expect(screen.queryByText('Apply to Order Total')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle calculation errors gracefully', async () => {
      mockCalculateDeliveryCost.mockImplementation(() => {
        throw new Error('Calculation failed');
      });

      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '15' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Calculation failed')).toBeInTheDocument();
      });
    });

    it('should handle negative distance values', async () => {
      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '-5' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should not calculate with negative value
      expect(mockCalculateDeliveryCost).not.toHaveBeenCalled();
    });

    it('should handle invalid distance values', async () => {
      render(<CostEstimatorCard headcount={50} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: 'abc' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should not calculate with invalid value
      expect(mockCalculateDeliveryCost).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large headcount values', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 170,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 170,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={500} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith(
          expect.objectContaining({ headcount: 500 })
        );
      });
    });

    it('should handle decimal distance values', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 30,
        totalMileagePay: 1.5,
        bridgeToll: 0,
        deliveryFee: 31.5,
        driverPay: 0,
        companyProfit: 0,
      });

      render(<CostEstimatorCard headcount={20} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10.5' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith(
          expect.objectContaining({ totalMileage: 10.5 })
        );
      });
    });

    it('should update when headcount changes', async () => {
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 30,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 30,
        driverPay: 0,
        companyProfit: 0,
      });

      const { rerender } = render(<CostEstimatorCard headcount={20} />);

      const distanceInput = screen.getByLabelText(/Delivery Distance/i);
      fireEvent.change(distanceInput, { target: { value: '10' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith(
          expect.objectContaining({ headcount: 20 })
        );
      });

      mockCalculateDeliveryCost.mockClear();
      mockCalculateDeliveryCost.mockReturnValue({
        deliveryCost: 55,
        totalMileagePay: 0,
        bridgeToll: 0,
        deliveryFee: 55,
        driverPay: 0,
        companyProfit: 0,
      });

      // Update headcount
      rerender(<CostEstimatorCard headcount={50} />);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockCalculateDeliveryCost).toHaveBeenCalledWith(
          expect.objectContaining({ headcount: 50 })
        );
      });
    });
  });
});
