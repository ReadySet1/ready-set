/**
 * Mock Data Factories
 *
 * Reusable factory functions for creating test data with sensible defaults.
 * All factories support partial overrides for customization.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import { UserType, UserStatus, CateringStatus, OnDemandStatus, VehicleType, CateringNeedHost } from '@/types/prisma';
import { OrderStatus, DriverStatus } from '@/types/order';

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockProfile {
  id: string;
  guid?: string | null;
  name: string | null;
  email: string;
  type: typeof UserType[keyof typeof UserType];
  status: typeof UserStatus[keyof typeof UserStatus];
  companyName?: string | null;
  contactName?: string | null;
  contactNumber?: string | null;
  website?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  locationNumber?: string | null;
  parkingLoading?: string | null;
  counties?: any | null;
  timeNeeded?: string | null;
  cateringBrokerage?: string | null;
  frequency?: string | null;
  provide?: string | null;
  headCount?: number | null;
  sideNotes?: string | null;
  confirmationCode?: string | null;
  isTemporaryPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
}

export interface MockAddress {
  id: string;
  name?: string | null;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  county?: string | null;
  locationNumber?: string | null;
  parkingLoading?: string | null;
  isRestaurant: boolean;
  isShared: boolean;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  deletedAt?: Date | null;
}

export interface MockCateringRequest {
  id: string;
  guid?: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  orderNumber: string;
  brokerage?: string | null;
  pickupDateTime: Date | null;
  arrivalDateTime: Date | null;
  completeDateTime?: Date | null;
  headcount?: number | null;
  needHost: typeof CateringNeedHost[keyof typeof CateringNeedHost];
  hoursNeeded?: number | null;
  numberOfHosts?: number | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  image?: string | null;
  status: typeof CateringStatus[keyof typeof CateringStatus];
  orderTotal: any;
  tip?: any;
  driverStatus?: typeof DriverStatus[keyof typeof DriverStatus] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  pickupAddress?: MockAddress;
  deliveryAddress?: MockAddress;
  user?: MockProfile;
}

export interface MockOnDemand {
  id: string;
  guid?: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  orderNumber: string;
  pickupDateTime: Date | null;
  arrivalDateTime: Date | null;
  completeDateTime?: Date | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  image?: string | null;
  status: typeof OnDemandStatus[keyof typeof OnDemandStatus];
  orderTotal: any;
  tip?: any;
  vehicleType: typeof VehicleType[keyof typeof VehicleType];
  itemDelivered?: string | null;
  hoursNeeded?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  driverStatus?: typeof DriverStatus[keyof typeof DriverStatus] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  pickupAddress?: MockAddress;
  deliveryAddress?: MockAddress;
  user?: MockProfile;
}

export interface MockDispatch {
  id: string;
  cateringRequestId?: string | null;
  onDemandId?: string | null;
  driverId?: string | null;
  userId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  driver?: MockProfile | null;
}

export interface MockFileUpload {
  id: string;
  userId?: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: Date;
  updatedAt: Date;
  cateringRequestId?: string | null;
  onDemandId?: string | null;
  jobApplicationId?: string | null;
  category?: string | null;
  isTemporary: boolean;
}

export interface MockUserAudit {
  id: string;
  userId: string;
  action: string;
  performedBy: string | null;
  changes: any;
  reason?: string | null;
  metadata?: any;
  createdAt: Date;
}

// ============================================================================
// Counter for Unique IDs
// ============================================================================

let idCounter = 0;

/**
 * Reset the ID counter (useful in beforeEach)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Generate a unique mock ID
 */
function generateId(prefix: string = 'mock'): string {
  idCounter++;
  return `${prefix}-${idCounter.toString().padStart(4, '0')}`;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a mock user profile with sensible defaults.
 * Supports soft-delete fields.
 */
export function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  const now = new Date();
  const id = overrides.id || generateId('user');

  return {
    id,
    guid: `guid-${id}`,
    name: `Test User ${id}`,
    email: `${id}@example.com`,
    type: UserType.CLIENT,
    status: UserStatus.ACTIVE,
    companyName: null,
    contactName: null,
    contactNumber: '555-0100',
    website: null,
    street1: '123 Test Street',
    street2: null,
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    locationNumber: null,
    parkingLoading: null,
    counties: null,
    timeNeeded: null,
    cateringBrokerage: null,
    frequency: null,
    provide: null,
    headCount: null,
    sideNotes: null,
    confirmationCode: null,
    isTemporaryPassword: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
    ...overrides,
  };
}

/**
 * Creates a mock address with sensible defaults.
 */
export function createMockAddress(overrides: Partial<MockAddress> = {}): MockAddress {
  const now = new Date();
  const id = overrides.id || generateId('addr');

  return {
    id,
    name: `Address ${id}`,
    street1: '456 Main Street',
    street2: null,
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    county: 'San Francisco',
    locationNumber: null,
    parkingLoading: 'Street parking available',
    isRestaurant: false,
    isShared: false,
    latitude: 37.7749,
    longitude: -122.4194,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Creates a mock catering request with sensible defaults.
 */
export function createMockCateringRequest(overrides: Partial<MockCateringRequest> = {}): MockCateringRequest {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const id = overrides.id || generateId('catering');
  const userId = overrides.userId || generateId('user');
  const pickupAddressId = overrides.pickupAddressId || generateId('addr');
  const deliveryAddressId = overrides.deliveryAddressId || generateId('addr');

  return {
    id,
    guid: `guid-${id}`,
    userId,
    pickupAddressId,
    deliveryAddressId,
    orderNumber: `CV-${Date.now().toString(36).toUpperCase()}`,
    brokerage: null,
    pickupDateTime: tomorrow,
    arrivalDateTime: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    completeDateTime: null,
    headcount: 25,
    needHost: CateringNeedHost.NO,
    hoursNeeded: null,
    numberOfHosts: null,
    clientAttention: 'Test Client',
    pickupNotes: null,
    specialNotes: null,
    image: null,
    status: CateringStatus.ACTIVE,
    orderTotal: 350.00,
    tip: 35.00,
    driverStatus: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Creates a mock on-demand order with sensible defaults.
 */
export function createMockOnDemand(overrides: Partial<MockOnDemand> = {}): MockOnDemand {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const id = overrides.id || generateId('ondemand');
  const userId = overrides.userId || generateId('user');
  const pickupAddressId = overrides.pickupAddressId || generateId('addr');
  const deliveryAddressId = overrides.deliveryAddressId || generateId('addr');

  return {
    id,
    guid: `guid-${id}`,
    userId,
    pickupAddressId,
    deliveryAddressId,
    orderNumber: `OD-${Date.now().toString(36).toUpperCase()}`,
    pickupDateTime: tomorrow,
    arrivalDateTime: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    completeDateTime: null,
    clientAttention: 'Test Client',
    pickupNotes: null,
    specialNotes: null,
    image: null,
    status: OnDemandStatus.ACTIVE,
    orderTotal: 75.00,
    tip: 10.00,
    vehicleType: VehicleType.CAR,
    itemDelivered: 'Package',
    hoursNeeded: null,
    length: null,
    width: null,
    height: null,
    weight: null,
    driverStatus: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Creates a mock dispatch record with sensible defaults.
 */
export function createMockDispatch(overrides: Partial<MockDispatch> = {}): MockDispatch {
  const now = new Date();
  const id = overrides.id || generateId('dispatch');

  return {
    id,
    cateringRequestId: null,
    onDemandId: null,
    driverId: null,
    userId: null,
    createdAt: now,
    updatedAt: now,
    driver: null,
    ...overrides,
  };
}

/**
 * Creates a mock file upload record with sensible defaults.
 */
export function createMockFileUpload(overrides: Partial<MockFileUpload> = {}): MockFileUpload {
  const now = new Date();
  const id = overrides.id || generateId('file');

  return {
    id,
    userId: null,
    fileName: `document-${id}.pdf`,
    fileType: 'application/pdf',
    fileSize: 1024 * 100, // 100KB
    fileUrl: `https://storage.example.com/uploads/${id}.pdf`,
    uploadedAt: now,
    updatedAt: now,
    cateringRequestId: null,
    onDemandId: null,
    jobApplicationId: null,
    category: 'document',
    isTemporary: false,
    ...overrides,
  };
}

/**
 * Creates a mock user audit record with sensible defaults.
 */
export function createMockUserAudit(overrides: Partial<MockUserAudit> = {}): MockUserAudit {
  const now = new Date();
  const id = overrides.id || generateId('audit');

  return {
    id,
    userId: overrides.userId || generateId('user'),
    action: 'UPDATE',
    performedBy: null,
    changes: {},
    reason: null,
    metadata: null,
    createdAt: now,
    ...overrides,
  };
}

// ============================================================================
// Convenience Functions for Common Scenarios
// ============================================================================

/**
 * Creates a mock profile that has been soft-deleted
 */
export function createMockDeletedProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  const deletedAt = overrides.deletedAt || new Date();
  return createMockProfile({
    deletedAt,
    deletedBy: overrides.deletedBy || generateId('admin'),
    deletionReason: overrides.deletionReason || 'Test deletion',
    ...overrides,
  });
}

/**
 * Creates a mock profile with SUPER_ADMIN type
 */
export function createMockSuperAdmin(overrides: Partial<MockProfile> = {}): MockProfile {
  return createMockProfile({
    type: UserType.SUPER_ADMIN,
    name: 'Super Admin',
    ...overrides,
  });
}

/**
 * Creates a mock profile with VENDOR type
 */
export function createMockVendor(overrides: Partial<MockProfile> = {}): MockProfile {
  return createMockProfile({
    type: UserType.VENDOR,
    companyName: 'Test Vendor Inc.',
    ...overrides,
  });
}

/**
 * Creates a mock profile with DRIVER type
 */
export function createMockDriver(overrides: Partial<MockProfile> = {}): MockProfile {
  return createMockProfile({
    type: UserType.DRIVER,
    name: 'Test Driver',
    ...overrides,
  });
}

/**
 * Creates a mock catering request from CaterValley
 */
export function createMockCaterValleyOrder(overrides: Partial<MockCateringRequest> = {}): MockCateringRequest {
  return createMockCateringRequest({
    brokerage: 'CaterValley',
    orderNumber: `CV-${Date.now().toString(36).toUpperCase()}`,
    ...overrides,
  });
}

/**
 * Creates a mock catering request with related data
 */
export function createMockCateringRequestWithRelations(
  overrides: Partial<MockCateringRequest> = {},
  includeUser: boolean = true,
  includeAddresses: boolean = true
): MockCateringRequest {
  const userId = overrides.userId || generateId('user');
  const pickupAddressId = overrides.pickupAddressId || generateId('addr');
  const deliveryAddressId = overrides.deliveryAddressId || generateId('addr');

  const request = createMockCateringRequest({
    userId,
    pickupAddressId,
    deliveryAddressId,
    ...overrides,
  });

  if (includeUser) {
    request.user = createMockProfile({ id: userId });
  }

  if (includeAddresses) {
    request.pickupAddress = createMockAddress({
      id: pickupAddressId,
      isRestaurant: true,
      name: 'Pickup Restaurant',
    });
    request.deliveryAddress = createMockAddress({
      id: deliveryAddressId,
      name: 'Delivery Location',
    });
  }

  return request;
}

/**
 * Creates a mock on-demand order with related data
 */
export function createMockOnDemandWithRelations(
  overrides: Partial<MockOnDemand> = {},
  includeUser: boolean = true,
  includeAddresses: boolean = true
): MockOnDemand {
  const userId = overrides.userId || generateId('user');
  const pickupAddressId = overrides.pickupAddressId || generateId('addr');
  const deliveryAddressId = overrides.deliveryAddressId || generateId('addr');

  const request = createMockOnDemand({
    userId,
    pickupAddressId,
    deliveryAddressId,
    ...overrides,
  });

  if (includeUser) {
    request.user = createMockProfile({ id: userId });
  }

  if (includeAddresses) {
    request.pickupAddress = createMockAddress({
      id: pickupAddressId,
      name: 'Pickup Location',
    });
    request.deliveryAddress = createMockAddress({
      id: deliveryAddressId,
      name: 'Delivery Location',
    });
  }

  return request;
}
