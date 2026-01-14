// Phase 1 Driver Tracking - TypeScript Types
// Comprehensive type definitions for the driver tracking system

import { DriverStatus } from '@/types/user';

// Core location and coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationUpdate {
  driverId: string;
  coordinates: Coordinates;
  accuracy: number;
  speed: number;
  heading: number;
  altitude?: number;
  batteryLevel?: number;
  activityType?: 'walking' | 'driving' | 'stationary';
  isMoving?: boolean;
  timestamp: Date;
}

// Shift management types
export interface ShiftBreak {
  id: string;
  shiftId: string;
  startTime: Date;
  endTime?: Date;
  breakType: 'rest' | 'meal' | 'fuel' | 'emergency';
  location?: Coordinates;
  createdAt: Date;
}

export interface DriverShift {
  id: string;
  driverId: string;
  startTime: Date;
  endTime?: Date;
  startLocation: Coordinates;
  endLocation?: Coordinates;
  totalDistanceMiles: number;
  deliveryCount: number;
  status: 'active' | 'paused' | 'completed';
  breaks: ShiftBreak[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Delivery tracking types
export interface DeliveryTracking {
  id: string;
  cateringRequestId?: string;  // Link to existing CateringRequest
  onDemandId?: string;         // Link to OnDemand orders
  driverId: string;
  dispatchDriverId?: string;   // Profile ID from dispatch assignment (for legacy dispatches)
  status: DriverStatus;        // Use existing enum
  pickupLocation: {
    coordinates: [number, number]; // [lng, lat]
  };
  deliveryLocation: {
    coordinates: [number, number]; // [lng, lat]
  };
  estimatedArrival?: Date;
  actualArrival?: Date;
  route: LocationUpdate[];
  proofOfDelivery?: string;
  actualDistanceMiles?: number;
  routePolyline?: string;
  metadata: Record<string, any>;
  assignedAt: Date;
  startedAt?: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Geofence types
export interface Geofence {
  id: string;
  name: string;
  type: 'pickup' | 'delivery' | 'restricted';
  polygon: Coordinates[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced driver type (extends existing User type)
export interface TrackedDriver {
  id: string;
  userId?: string;
  employeeId: string;
  name?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  phoneNumber: string;
  isActive: boolean;
  isOnDuty: boolean;
  lastKnownLocation?: {
    coordinates: [number, number]; // [lng, lat]
  };
  lastLocationUpdate?: Date;
  traccarDeviceId?: number;
  currentShift?: DriverShift;
  currentShiftId?: string;
  shiftStartTime?: Date;
  vehicleInfo?: {
    number: string;
    type: string;
  };
  // Additional computed fields from queries
  deliveryCount?: number;
  totalDistanceMiles?: number;
  activeDeliveries?: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Tracking events for audit trail
export interface TrackingEvent {
  id: string;
  deliveryId?: string;
  driverId: string;
  eventType: 'shift_start' | 'shift_end' | 'break_start' | 'break_end' | 
            'delivery_assigned' | 'pickup_arrived' | 'delivery_started' | 
            'delivery_arrived' | 'delivery_completed' | 'location_update';
  location?: Coordinates;
  metadata: Record<string, any>;
  createdAt: Date;
}

// API Request/Response types
export interface StartShiftRequest {
  driverId: string;
  location: LocationUpdate;
  vehicleCheck: boolean;
  metadata?: Record<string, any>;
}

export interface EndShiftRequest {
  shiftId: string;
  location: LocationUpdate;
  finalMileage?: number;
  metadata?: Record<string, any>;
}

export interface LocationBatchRequest {
  driverId: string;
  locations: LocationUpdate[];
}

export interface UpdateDeliveryStatusRequest {
  deliveryId: string;
  status: DriverStatus;
  location?: LocationUpdate;
  proofOfDelivery?: string;
  notes?: string;
}

// Dashboard and UI types
export interface DriverDashboardData {
  driver: TrackedDriver;
  currentShift?: DriverShift;
  activeDeliveries: DeliveryTracking[];
  todayStats: {
    distanceDriven: number;
    deliveriesCompleted: number;
    hoursWorked: number;
    earnings?: number;
  };
}

export interface AdminTrackingDashboard {
  activeDrivers: TrackedDriver[];
  totalDrivers: number;
  activeDeliveries: DeliveryTracking[];
  systemStats: {
    driversOnDuty: number;
    deliveriesInProgress: number;
    averageDeliveryTime: number;
    totalDistanceToday: number;
  };
}

// Real-time update types
export interface RealtimeLocationUpdate {
  type: 'location_update';
  driverId: string;
  location: LocationUpdate;
  timestamp: Date;
}

export interface RealtimeDriverStatus {
  type: 'driver_status';
  driverId: string;
  isOnDuty: boolean;
  currentShiftId?: string;
  timestamp: Date;
}

export interface RealtimeDeliveryUpdate {
  type: 'delivery_update';
  deliveryId: string;
  status: DriverStatus;
  location?: LocationUpdate;
  timestamp: Date;
}

export type RealtimeUpdate = RealtimeLocationUpdate | RealtimeDriverStatus | RealtimeDeliveryUpdate;

// Validation schemas (for Zod)
export interface LocationValidation {
  coordinates: {
    lat: number; // -90 to 90
    lng: number; // -180 to 180
  };
  accuracy: number; // positive, max 1000
  speed: number; // min 0, max 200
  heading: number; // 0 to 360
  timestamp: Date;
}

export interface ShiftValidation {
  driverId: string; // UUID
  location: LocationValidation;
  vehicleCheck: boolean;
  metadata?: Record<string, any>;
}

// Offline support types
export interface OfflineLocationQueue {
  id: string;
  driverId: string;
  location: LocationUpdate;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  createdAt: Date;
}

export interface OfflineCapability {
  isOnline: boolean;
  pendingUpdates: number;
  lastSync?: Date;
  syncInProgress: boolean;
}