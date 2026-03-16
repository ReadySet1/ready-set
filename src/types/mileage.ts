/**
 * Types for the Total Mileage Calculation tool.
 *
 * Used by the MileageCalculator UI components and the
 * admin mileage-calculator page.
 */

export interface MileageStop {
  address: string;
  lat?: number;
  lng?: number;
  label?: string;
}

export interface MileageLeg {
  from: string;
  to: string;
  distanceMiles: number;
  durationMinutes: number;
}

export interface MileageCalculation {
  pickup: MileageStop;
  dropoffs: MileageStop[];
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  legs: MileageLeg[];
  polyline?: string;
  calculatedAt: Date;
}

export type MileageCalculationStatus = 'idle' | 'loading' | 'success' | 'error';
