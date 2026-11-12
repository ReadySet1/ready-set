import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeliveryTimeline } from '../DeliveryTimeline';
import { DriverStatus } from '@/types/user';

// No date-display mock here: this file checks the real zone conversion.
// 2026-11-20T17:00Z = 11:00 AM Central (CST) = 9:00 AM Pacific (PST).
const pickedUpAt = '2026-11-20T17:00:00Z';
const estimatedPickupTime = '2026-11-20T16:45:00Z';

describe('DeliveryTimeline order time zone', () => {
  it('shows a Central order on the Central clock', () => {
    render(
      <DeliveryTimeline
        createdAt="2026-11-20T15:00:00Z"
        enRouteToVendorAt="2026-11-20T16:30:00Z"
        arrivedAtVendorAt="2026-11-20T16:50:00Z"
        pickedUpAt={pickedUpAt}
        estimatedPickupTime={estimatedPickupTime}
        currentStatus={DriverStatus.PICKED_UP}
        timeZone="America/Chicago"
      />,
    );

    expect(screen.getByText('11:00 AM')).toBeInTheDocument();
    expect(screen.getByText(/Est\. 10:45 AM CT/)).toBeInTheDocument();
  });

  it('keeps the Pacific clock when no zone is given', () => {
    render(
      <DeliveryTimeline
        createdAt="2026-11-20T15:00:00Z"
        enRouteToVendorAt="2026-11-20T16:30:00Z"
        arrivedAtVendorAt="2026-11-20T16:50:00Z"
        pickedUpAt={pickedUpAt}
        currentStatus={DriverStatus.PICKED_UP}
      />,
    );

    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
  });
});
