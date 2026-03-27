import React from 'react';
import { render, screen } from '@testing-library/react';
import MileageResults from '../MileageResults';
import type { MileageCalculation } from '@/types/mileage';

const mockSingleLegCalculation: MileageCalculation = {
  pickup: { address: '123 Main St, Austin, TX 78701', lat: 30.27, lng: -97.74 },
  dropoffs: [{ address: '456 Oak Ave, Dallas, TX 75201', lat: 32.78, lng: -96.80 }],
  totalDistanceMiles: 195.3,
  totalDurationMinutes: 175.5,
  legs: [
    {
      from: '123 Main St, Austin, TX 78701',
      to: '456 Oak Ave, Dallas, TX 75201',
      distanceMiles: 195.3,
      durationMinutes: 175.5,
    },
  ],
  calculatedAt: new Date('2026-03-15T10:00:00Z'),
};

const mockMultiLegCalculation: MileageCalculation = {
  pickup: { address: '123 Main St, Austin, TX', lat: 30.27, lng: -97.74 },
  dropoffs: [
    { address: '456 Oak Ave, San Antonio, TX', lat: 29.42, lng: -98.49 },
    { address: '789 Elm St, Houston, TX', lat: 29.76, lng: -95.37 },
  ],
  totalDistanceMiles: 275.8,
  totalDurationMinutes: 245.0,
  legs: [
    {
      from: '123 Main St, Austin, TX',
      to: '456 Oak Ave, San Antonio, TX',
      distanceMiles: 80.5,
      durationMinutes: 72.0,
    },
    {
      from: '456 Oak Ave, San Antonio, TX',
      to: '789 Elm St, Houston, TX',
      distanceMiles: 195.3,
      durationMinutes: 173.0,
    },
  ],
  calculatedAt: new Date('2026-03-15T10:00:00Z'),
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('MileageResults', () => {
  it('renders total distance correctly', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    expect(screen.getByText('195.3')).toBeInTheDocument();
    expect(screen.getByText('miles')).toBeInTheDocument();
  });

  it('formats duration as hours and minutes', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    // 175.5 minutes = 2h 56m — appears in both summary card and table
    const durationElements = screen.getAllByText('2h 56m');
    expect(durationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays number of stops', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    expect(screen.getByText('stop')).toBeInTheDocument();
  });

  it('shows plural "stops" for multiple drop-offs', () => {
    render(<MileageResults calculation={mockMultiLegCalculation} />);

    expect(screen.getByText('stops')).toBeInTheDocument();
  });

  it('calculates and displays average speed', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    // 195.3 miles / (175.5 / 60) hours = ~66.8 mph → rounds to 67
    expect(screen.getByText('67')).toBeInTheDocument();
    expect(screen.getByText('avg mph')).toBeInTheDocument();
  });

  it('renders per-leg breakdown table', () => {
    render(<MileageResults calculation={mockMultiLegCalculation} />);

    expect(screen.getByText('Route Breakdown')).toBeInTheDocument();
    expect(screen.getByText('80.5 mi')).toBeInTheDocument();
    expect(screen.getByText('195.3 mi')).toBeInTheDocument();
  });

  it('shows total row in the table footer', () => {
    render(<MileageResults calculation={mockMultiLegCalculation} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('275.8 mi')).toBeInTheDocument();
  });

  it('renders Copy Results button', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    expect(
      screen.getByRole('button', { name: /copy results/i }),
    ).toBeInTheDocument();
  });

  it('renders origin and destination addresses in the table', () => {
    render(<MileageResults calculation={mockSingleLegCalculation} />);

    expect(
      screen.getByText('123 Main St, Austin, TX 78701'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('456 Oak Ave, Dallas, TX 75201'),
    ).toBeInTheDocument();
  });

  it('formats duration under 60 minutes correctly', () => {
    const shortTrip: MileageCalculation = {
      ...mockSingleLegCalculation,
      totalDurationMinutes: 45,
      legs: [
        {
          ...mockSingleLegCalculation.legs[0]!,
          durationMinutes: 45,
        },
      ],
    };

    render(<MileageResults calculation={shortTrip} />);

    // "45 min" appears in summary card and per-leg table
    const durationElements = screen.getAllByText('45 min');
    expect(durationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('formats duration as exact hours when no remaining minutes', () => {
    const exactHourTrip: MileageCalculation = {
      ...mockSingleLegCalculation,
      totalDurationMinutes: 120,
      legs: [
        {
          ...mockSingleLegCalculation.legs[0]!,
          durationMinutes: 120,
        },
      ],
    };

    render(<MileageResults calculation={exactHourTrip} />);

    // "2h" appears in both summary and table when total = leg duration
    const durationElements = screen.getAllByText('2h');
    expect(durationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows 0 avg mph when duration is zero', () => {
    const zeroDuration: MileageCalculation = {
      ...mockSingleLegCalculation,
      totalDurationMinutes: 0,
      legs: [
        {
          ...mockSingleLegCalculation.legs[0]!,
          durationMinutes: 0,
        },
      ],
    };

    render(<MileageResults calculation={zeroDuration} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
