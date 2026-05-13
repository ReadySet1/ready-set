import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeliveryTimeline } from '../DeliveryTimeline';
import { DriverStatus } from '@/types/user';

jest.mock('@/lib/utils/date-display', () => ({
  formatTimeForDisplay: (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  },
  formatDateTimeForDisplay: (date: string | Date | null | undefined, fmt?: string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (fmt === 'MMM d, yyyy') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return d.toLocaleString();
  },
}));

const baseTimestamps = {
  createdAt: '2026-02-17T10:00:00Z',
  enRouteToVendorAt: '2026-02-17T10:05:00Z',
  arrivedAtVendorAt: '2026-02-17T10:20:00Z',
  pickedUpAt: '2026-02-17T10:25:00Z',
  enRouteAt: '2026-02-17T10:25:00Z',
  arrivedAtClientAt: '2026-02-17T10:45:00Z',
  deliveredAt: '2026-02-17T10:50:00Z',
};

describe('DeliveryTimeline', () => {
  it('renders all 7 stage labels', () => {
    render(<DeliveryTimeline createdAt={baseTimestamps.createdAt} />);

    expect(screen.getByText('Order Placed')).toBeInTheDocument();
    expect(screen.getByText('En Route to Resto')).toBeInTheDocument();
    expect(screen.getByText('Arrived at Vendor')).toBeInTheDocument();
    expect(screen.getByText('Pickup Completed')).toBeInTheDocument();
    expect(screen.getByText('En Route to Client')).toBeInTheDocument();
    expect(screen.getByText('Arrived at Client')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('does not render Driver Assigned stage', () => {
    render(<DeliveryTimeline createdAt={baseTimestamps.createdAt} />);
    expect(screen.queryByText('Driver Assigned')).not.toBeInTheDocument();
  });

  it('shows timestamps for completed stages', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        currentStatus={DriverStatus.ARRIVED_AT_VENDOR}
      />
    );

    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "In progress" for the current active stage', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        currentStatus={DriverStatus.ARRIVED_AT_VENDOR}
      />
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('does not show "In progress" when delivery is completed', () => {
    render(
      <DeliveryTimeline
        {...baseTimestamps}
        currentStatus={DriverStatus.COMPLETED}
      />
    );

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('shows duration between consecutive stages', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        currentStatus={DriverStatus.ARRIVED_AT_VENDOR}
      />
    );

    // 5 min between created and en route to vendor
    expect(screen.getByText('5 min')).toBeInTheDocument();
    // 15 min between en route to vendor and arrived at vendor
    expect(screen.getByText('15 min')).toBeInTheDocument();
  });

  it('shows late indicator when actual exceeds estimated pickup time', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        pickedUpAt="2026-02-17T10:30:00Z"
        enRouteAt="2026-02-17T10:30:00Z"
        estimatedPickupTime="2026-02-17T10:15:00Z"
        currentStatus={DriverStatus.EN_ROUTE_TO_CLIENT}
      />
    );

    expect(screen.getByText(/late/i)).toBeInTheDocument();
  });

  it('shows late indicator when actual exceeds estimated delivery time', () => {
    render(
      <DeliveryTimeline
        {...baseTimestamps}
        estimatedDeliveryTime="2026-02-17T10:40:00Z"
        currentStatus={DriverStatus.COMPLETED}
      />
    );

    expect(screen.getByText(/late/i)).toBeInTheDocument();
  });

  it('does not show late indicator when on time', () => {
    render(
      <DeliveryTimeline
        {...baseTimestamps}
        estimatedPickupTime="2026-02-17T11:00:00Z"
        estimatedDeliveryTime="2026-02-17T11:30:00Z"
        currentStatus={DriverStatus.COMPLETED}
      />
    );

    expect(screen.queryByText(/late/i)).not.toBeInTheDocument();
  });

  it('renders in compact mode with smaller layout', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        currentStatus={DriverStatus.ASSIGNED}
        compact
      />
    );

    expect(screen.getByText('Order Placed')).toBeInTheDocument();
  });

  it('handles null/undefined timestamps gracefully', () => {
    render(<DeliveryTimeline createdAt={null} />);

    expect(screen.getByText('Order Placed')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('renders with only createdAt for a new order', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        currentStatus={null}
      />
    );

    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(1);
  });

  it('shows full date for Order Placed and Delivered stages', () => {
    render(
      <DeliveryTimeline
        {...baseTimestamps}
        currentStatus={DriverStatus.COMPLETED}
      />
    );

    const dateElements = screen.getAllByText(/Feb 17, 2026/i);
    expect(dateElements.length).toBe(2);
  });

  it('updates correctly when props change (simulating real-time)', () => {
    const { rerender } = render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        currentStatus={DriverStatus.ASSIGNED}
      />
    );

    rerender(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        currentStatus={DriverStatus.EN_ROUTE_TO_VENDOR}
      />
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('preserves all previous timestamps when status advances', () => {
    const { rerender } = render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        currentStatus={DriverStatus.EN_ROUTE_TO_VENDOR}
      />
    );

    // Two timestamps visible: Order Placed + En Route to Resto
    let timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(2);

    // Advance to ARRIVED_AT_VENDOR – 3 timestamps visible
    rerender(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        currentStatus={DriverStatus.ARRIVED_AT_VENDOR}
      />
    );

    timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(3);

    // Advance to PICKED_UP – 4 timestamps visible
    rerender(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        pickedUpAt={baseTimestamps.pickedUpAt}
        currentStatus={DriverStatus.PICKED_UP}
      />
    );

    timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(4);

    // Advance to EN_ROUTE – 5 timestamps visible
    rerender(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        pickedUpAt={baseTimestamps.pickedUpAt}
        enRouteAt={baseTimestamps.enRouteAt}
        currentStatus={DriverStatus.EN_ROUTE_TO_CLIENT}
      />
    );

    timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(5);

    // Advance to COMPLETED – all 7 timestamps visible
    rerender(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        enRouteToVendorAt={baseTimestamps.enRouteToVendorAt}
        arrivedAtVendorAt={baseTimestamps.arrivedAtVendorAt}
        pickedUpAt={baseTimestamps.pickedUpAt}
        enRouteAt={baseTimestamps.enRouteAt}
        arrivedAtClientAt={baseTimestamps.arrivedAtClientAt}
        deliveredAt={baseTimestamps.deliveredAt}
        currentStatus={DriverStatus.COMPLETED}
      />
    );

    timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(timeElements.length).toBe(7);
  });

  it('does not show "Updating..." when no status update is in flight', () => {
    render(
      <DeliveryTimeline
        createdAt={baseTimestamps.createdAt}
        currentStatus={DriverStatus.ASSIGNED}
        canUpdateStatus={true}
        onStatusUpdate={async () => {}}
      />
    );

    expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
  });
});
