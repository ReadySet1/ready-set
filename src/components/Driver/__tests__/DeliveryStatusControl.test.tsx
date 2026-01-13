import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeliveryStatusControl } from '../DeliveryStatusControl';
import { DriverStatus } from '@/types/user';

// Mock the delivery-status-transitions module
jest.mock('@/lib/delivery-status-transitions', () => ({
  getStatusLabel: jest.fn((status) => {
    const labels: Record<string, string> = {
      ASSIGNED: 'Assigned',
      ARRIVED_AT_VENDOR: 'At Vendor',
      PICKED_UP: 'Picked Up',
      EN_ROUTE_TO_CLIENT: 'En Route',
      ARRIVED_TO_CLIENT: 'Arrived',
      COMPLETED: 'Completed',
    };
    return labels[status] || 'Not Started';
  }),
  getNextActionLabel: jest.fn((status) => {
    const labels: Record<string, string> = {
      ASSIGNED: 'Start',
      ARRIVED_AT_VENDOR: 'Confirm Pickup',
      PICKED_UP: 'Start Delivery',
      EN_ROUTE_TO_CLIENT: 'Arrived',
      ARRIVED_TO_CLIENT: 'Complete',
    };
    return labels[status as string] || 'Start';
  }),
  getNextStatus: jest.fn((status) => {
    const transitions: Record<string, string | null> = {
      ASSIGNED: 'ARRIVED_AT_VENDOR',
      ARRIVED_AT_VENDOR: 'PICKED_UP',
      PICKED_UP: 'EN_ROUTE_TO_CLIENT',
      EN_ROUTE_TO_CLIENT: 'ARRIVED_TO_CLIENT',
      ARRIVED_TO_CLIENT: 'COMPLETED',
      COMPLETED: null,
    };
    if (!status) return 'ASSIGNED';
    return transitions[status as string] || null;
  }),
  canAdvanceStatus: jest.fn((status) => {
    return status !== 'COMPLETED';
  }),
  getStatusProgress: jest.fn((status) => {
    const progress: Record<string, number> = {
      ASSIGNED: 0,
      ARRIVED_AT_VENDOR: 20,
      PICKED_UP: 40,
      EN_ROUTE_TO_CLIENT: 60,
      ARRIVED_TO_CLIENT: 80,
      COMPLETED: 100,
    };
    return progress[status as string] || 0;
  }),
  isDeliveryCompleted: jest.fn((status) => status === 'COMPLETED'),
}));

describe('DeliveryStatusControl', () => {
  const defaultProps = {
    deliveryId: 'test-delivery-id',
    orderNumber: 'ORD-001',
    orderType: 'catering' as const,
    currentStatus: DriverStatus.ASSIGNED,
    onStatusChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders current status badge', () => {
      render(<DeliveryStatusControl {...defaultProps} />);
      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });

    it('renders advance button when status can be advanced', () => {
      render(<DeliveryStatusControl {...defaultProps} />);
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    });

    it('shows "Done" when delivery is completed', () => {
      render(
        <DeliveryStatusControl
          {...defaultProps}
          currentStatus={DriverStatus.COMPLETED}
        />
      );
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('renders in compact mode', () => {
      render(<DeliveryStatusControl {...defaultProps} compact />);
      expect(screen.getByText('Assigned')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('status advancement', () => {
    it('calls onStatusChange with next status when button is clicked', async () => {
      const onStatusChange = jest.fn().mockResolvedValue(undefined);
      render(
        <DeliveryStatusControl {...defaultProps} onStatusChange={onStatusChange} />
      );

      const button = screen.getByRole('button', { name: /start/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('ARRIVED_AT_VENDOR');
      });
    });

    it('triggers POD request when advancing to COMPLETED', async () => {
      const onPODRequest = jest.fn();
      const onStatusChange = jest.fn().mockResolvedValue(undefined);

      render(
        <DeliveryStatusControl
          {...defaultProps}
          currentStatus={DriverStatus.ARRIVED_TO_CLIENT}
          onStatusChange={onStatusChange}
          onPODRequest={onPODRequest}
        />
      );

      const button = screen.getByRole('button', { name: /complete/i });
      fireEvent.click(button);

      expect(onPODRequest).toHaveBeenCalled();
      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled states', () => {
    it('disables button when isLoading is true', () => {
      render(<DeliveryStatusControl {...defaultProps} isLoading />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('disables button when disabled prop is true', () => {
      render(<DeliveryStatusControl {...defaultProps} disabled />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading spinner when isLoading is true', () => {
      render(<DeliveryStatusControl {...defaultProps} isLoading />);
      // The Loader2 component renders with animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('progress display', () => {
    it('shows progress bar in non-compact mode', () => {
      render(<DeliveryStatusControl {...defaultProps} compact={false} />);
      // Progress bar should be visible
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });
  });
});
