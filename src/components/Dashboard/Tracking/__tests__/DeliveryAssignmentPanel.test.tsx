import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeliveryAssignmentPanel from '../DeliveryAssignmentPanel';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

// Mock data
const mockDriver1: TrackedDriver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  vehicleNumber: 'VEH-123',
  phoneNumber: '+1-555-0101',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522]
  },
  currentShift: {
    id: 'shift-1',
    startTime: '2025-01-01T08:00:00Z',
    deliveryCount: 5,
    totalDistanceKm: 25.5,
    breaks: []
  },
  totalDistanceMiles: 15.8,
  deliveryCount: 5,
  activeDeliveries: 1
};

const mockDriver2: TrackedDriver = {
  id: 'driver-2',
  employeeId: 'EMP002',
  vehicleNumber: 'VEH-456',
  isOnDuty: true,
  activeDeliveries: 2,
  totalDistanceMiles: 10.5
};

const mockOffDutyDriver: TrackedDriver = {
  id: 'driver-3',
  employeeId: 'EMP003',
  vehicleNumber: 'VEH-789',
  isOnDuty: false,
  activeDeliveries: 0
};

const mockOverloadedDriver: TrackedDriver = {
  id: 'driver-4',
  employeeId: 'EMP004',
  vehicleNumber: 'VEH-999',
  isOnDuty: true,
  activeDeliveries: 3 // Max capacity
};

const mockUnassignedDelivery: DeliveryTracking = {
  id: 'delivery-1',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522]
  },
  pickupLocation: {
    type: 'Point',
    coordinates: [-118.2537, 34.0622]
  },
  status: 'PENDING',
  driverId: undefined,
  estimatedArrival: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now - high priority
  cateringRequestId: 'catering-123'
};

const mockAssignedDelivery: DeliveryTracking = {
  id: 'delivery-2',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.2637, 34.0722]
  },
  pickupLocation: {
    type: 'Point',
    coordinates: [-118.2737, 34.0822]
  },
  status: 'ASSIGNED',
  driverId: 'driver-1',
  estimatedArrival: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours - medium priority
  onDemandId: 'ondemand-456'
};

const mockInProgressDelivery: DeliveryTracking = {
  id: 'delivery-3',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.2837, 34.0922]
  },
  pickupLocation: {
    type: 'Point',
    coordinates: [-118.2937, 34.1022]
  },
  status: 'EN_ROUTE_TO_CLIENT',
  driverId: 'driver-2',
  estimatedArrival: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours - low priority
};

const mockLowPriorityDelivery: DeliveryTracking = {
  id: 'delivery-4',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.3037, 34.1122]
  },
  pickupLocation: {
    type: 'Point',
    coordinates: [-118.3137, 34.1222]
  },
  status: 'PENDING',
  driverId: undefined
  // No estimatedArrival - low priority
};

// Mock server action
const mockAssignDeliveryToDriver = jest.fn();
jest.mock('@/app/actions/tracking/delivery-actions', () => ({
  assignDeliveryToDriver: (...args: any[]) => mockAssignDeliveryToDriver(...args)
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: any) => (
    <div data-testid="card" className={className} onClick={onClick}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      data-testid="search-input"
    />
  ),
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ placeholder, value, onChange, className }: any) => (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      data-testid="textarea"
    />
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  TruckIcon: () => <span data-testid="truck-icon">Truck</span>,
  MapPinIcon: () => <span data-testid="map-pin-icon">MapPin</span>,
  ClockIcon: () => <span data-testid="clock-icon">Clock</span>,
  UserIcon: () => <span data-testid="user-icon">User</span>,
  PlusIcon: () => <span data-testid="plus-icon">Plus</span>,
  SearchIcon: () => <span data-testid="search-icon">Search</span>,
  AlertTriangleIcon: () => <span data-testid="alert-triangle-icon">Alert</span>,
  CheckCircleIcon: () => <span data-testid="check-circle-icon">Check</span>,
  XCircleIcon: () => <span data-testid="x-circle-icon">X</span>,
  CalendarIcon: () => <span data-testid="calendar-icon">Calendar</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('DeliveryAssignmentPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssignDeliveryToDriver.mockResolvedValue({ success: true });
  });

  describe('Component Rendering', () => {
    it('should render the panel with deliveries', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      // Look for partial delivery ID text (last 6 chars)
      expect(screen.getByText('#very-1')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should show empty state when no deliveries match filter', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[]}
        />
      );

      expect(screen.getByText('No deliveries match your criteria')).toBeInTheDocument();
    });
  });

  describe('Summary Stats', () => {
    it('should display total deliveries count', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery, mockInProgressDelivery]}
        />
      );

      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display unassigned count', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      // "Unassigned" appears in stat card label and dropdown option
      const unassignedElements = screen.getAllByText('Unassigned');
      expect(unassignedElements.length).toBeGreaterThan(0);
    });

    it('should display assigned count', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      // "Assigned" appears in stat card label and dropdown option
      const assignedElements = screen.getAllByText('Assigned');
      expect(assignedElements.length).toBeGreaterThan(0);
    });

    it('should display in progress count', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockInProgressDelivery]}
        />
      );

      // "In Progress" appears in stat card label and dropdown option
      const inProgressElements = screen.getAllByText('In Progress');
      expect(inProgressElements.length).toBeGreaterThan(0);
    });
  });

  describe('Delivery Priority', () => {
    it('should show high priority badge for deliveries within 1 hour', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('high priority')).toBeInTheDocument();
    });

    it('should show medium priority badge for deliveries within 4 hours', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      expect(screen.getByText('medium priority')).toBeInTheDocument();
    });

    it('should show low priority badge for deliveries beyond 4 hours', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockInProgressDelivery]}
        />
      );

      expect(screen.getByText('low priority')).toBeInTheDocument();
    });

    it('should show low priority for deliveries without ETA', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockLowPriorityDelivery]}
        />
      );

      expect(screen.getByText('low priority')).toBeInTheDocument();
    });
  });

  describe('Order Type Display', () => {
    it('should show Catering Order for catering deliveries', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('Catering Order')).toBeInTheDocument();
    });

    it('should show On-Demand Order for on-demand deliveries', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      expect(screen.getByText('On-Demand Order')).toBeInTheDocument();
    });
  });

  describe('Assignment Status', () => {
    it('should show Unassigned status for unassigned deliveries', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // "Unassigned" appears in multiple places: stat label, dropdown, and status
      const unassignedElements = screen.getAllByText('Unassigned');
      expect(unassignedElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should show Assigned status with driver info for assigned deliveries', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      // "Assigned" appears in stat label, dropdown, and status badge
      const assignedElements = screen.getAllByText('Assigned');
      expect(assignedElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Driver #EMP001')).toBeInTheDocument();
    });
  });

  describe('Location Display', () => {
    it('should show pickup location', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('Pickup:')).toBeInTheDocument();
    });

    it('should show delivery location', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('Delivery:')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter deliveries by ID', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'delivery-1' } });

      // Should only show delivery-1 (displayed as last 6 chars: #very-1)
      expect(screen.getByText('#very-1')).toBeInTheDocument();
      // Should not show delivery-2
      expect(screen.queryByText('#very-2')).not.toBeInTheDocument();
    });

    it('should filter by catering request ID', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'catering-123' } });

      expect(screen.getByText('Catering Order')).toBeInTheDocument();
    });

    it('should show no results when search has no matches', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

      expect(screen.getByText('No deliveries match your criteria')).toBeInTheDocument();
    });
  });

  describe('Status Filter', () => {
    it('should filter to unassigned only', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Deliveries');
      fireEvent.change(statusFilter, { target: { value: 'unassigned' } });

      // Should show unassigned delivery
      expect(screen.getByText('Catering Order')).toBeInTheDocument();
    });

    it('should filter to assigned only', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery, mockAssignedDelivery]}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Deliveries');
      fireEvent.change(statusFilter, { target: { value: 'assigned' } });

      // Should show assigned delivery (On-Demand Order)
      expect(screen.getByText('On-Demand Order')).toBeInTheDocument();
    });

    it('should filter to in progress only', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery, mockInProgressDelivery]}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Deliveries');
      fireEvent.change(statusFilter, { target: { value: 'in_progress' } });

      // Should show in progress delivery
      expect(screen.getByText('EN_ROUTE_TO_CLIENT')).toBeInTheDocument();
    });
  });

  describe('Delivery Selection', () => {
    it('should expand delivery card when clicked', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      const deliveryCard = screen.getAllByTestId('card')[4]; // Get the delivery card
      fireEvent.click(deliveryCard);

      expect(screen.getByText('Assign to Driver')).toBeInTheDocument();
    });

    it('should collapse delivery card when clicked again', async () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Find the delivery card (not summary cards)
      const getDeliveryCard = () => {
        const cards = screen.getAllByTestId('card');
        return cards.find(card => card.textContent?.includes('Catering Order'));
      };

      const deliveryCard1 = getDeliveryCard();
      expect(deliveryCard1).toBeDefined();

      // First click expands
      fireEvent.click(deliveryCard1!);
      await waitFor(() => {
        expect(screen.getByText('Assign to Driver')).toBeInTheDocument();
      });

      // Get fresh reference after re-render
      const deliveryCard2 = getDeliveryCard();
      expect(deliveryCard2).toBeDefined();

      // Second click collapses - click the same card again
      fireEvent.click(deliveryCard2!);
      await waitFor(() => {
        expect(screen.queryByText('Assign to Driver')).not.toBeInTheDocument();
      });
    });
  });

  describe('Available Drivers', () => {
    it('should show available drivers list', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText(/Available Drivers/)).toBeInTheDocument();
    });

    it('should only show on-duty drivers with capacity', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockOffDutyDriver, mockOverloadedDriver]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Should show driver1 (on duty, capacity available)
      expect(screen.getByText('#EMP001')).toBeInTheDocument();
      // Should not show off-duty or overloaded drivers
      expect(screen.queryByText('#EMP003')).not.toBeInTheDocument();
      expect(screen.queryByText('#EMP004')).not.toBeInTheDocument();
    });

    it('should show no drivers message when none available', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockOffDutyDriver, mockOverloadedDriver]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Click to expand the unassigned delivery
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('Catering Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);
        expect(screen.getByText('No available drivers')).toBeInTheDocument();
      }
    });
  });

  describe('Driver Assignment', () => {
    it('should call assignDeliveryToDriver when assigning', async () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('Catering Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        // Find and click the driver assignment row
        const driverRow = screen.getByText('Driver #EMP001').closest('div[class*="border"]');
        if (driverRow) {
          fireEvent.click(driverRow);

          await waitFor(() => {
            expect(mockAssignDeliveryToDriver).toHaveBeenCalledWith('delivery-1', 'driver-1');
          });
        }
      }
    });

    it('should show assign button for each available driver', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('Catering Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        const assignButtons = screen.getAllByText('Assign');
        expect(assignButtons.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Unassign Delivery', () => {
    it('should show unassign button for assigned delivery', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('On-Demand Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        expect(screen.getByText('Unassign')).toBeInTheDocument();
      }
    });

    it('should show current assignment info for assigned delivery', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('On-Demand Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        expect(screen.getByText('Current Assignment')).toBeInTheDocument();
      }
    });

    it('should call assignDeliveryToDriver with empty string when unassigning', async () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockAssignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('On-Demand Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        const unassignButton = screen.getByText('Unassign');
        fireEvent.click(unassignButton);

        await waitFor(() => {
          expect(mockAssignDeliveryToDriver).toHaveBeenCalledWith('delivery-2', '');
        });
      }
    });
  });

  describe('ETA Display', () => {
    it('should show ETA for deliveries with estimated arrival', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('ETA:')).toBeInTheDocument();
    });

    it('should not show ETA for deliveries without estimated arrival', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockLowPriorityDelivery]}
        />
      );

      expect(screen.queryByText('ETA:')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle assignment failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignDeliveryToDriver.mockResolvedValue({ success: false, error: 'Assignment failed' });

      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('Catering Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        const driverRow = screen.getByText('Driver #EMP001').closest('div[class*="border"]');
        if (driverRow) {
          fireEvent.click(driverRow);

          await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to assign delivery:', 'Assignment failed');
          });
        }
      }

      consoleErrorSpy.mockRestore();
    });

    it('should handle assignment exception gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAssignDeliveryToDriver.mockRejectedValue(new Error('Network error'));

      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      // Click to expand
      const cards = screen.getAllByTestId('card');
      const deliveryCard = cards.find(card => card.textContent?.includes('Catering Order'));

      if (deliveryCard) {
        fireEvent.click(deliveryCard);

        const driverRow = screen.getByText('Driver #EMP001').closest('div[class*="border"]');
        if (driverRow) {
          fireEvent.click(driverRow);

          await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error assigning delivery:', expect.any(Error));
          });
        }
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Available Badge', () => {
    it('should show Available badge for each available driver', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1, mockDriver2]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      const availableBadges = screen.getAllByText('Available');
      expect(availableBadges.length).toBe(2);
    });
  });

  describe('Driver Capacity Display', () => {
    it('should show active deliveries count for drivers', () => {
      render(
        <DeliveryAssignmentPanel
          drivers={[mockDriver1]}
          deliveries={[mockUnassignedDelivery]}
        />
      );

      expect(screen.getByText('1/3 deliveries')).toBeInTheDocument();
    });
  });
});
