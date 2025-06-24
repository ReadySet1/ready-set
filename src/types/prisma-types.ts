import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError, PrismaClientInitializationError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Decimal } from '@prisma/client/runtime/library';

// Export errors and Decimal for use in other files
export { 
  PrismaClientKnownRequestError, 
  PrismaClientInitializationError, 
  PrismaClientValidationError, 
  Decimal 
};

// Define constants for Prisma enum values (matching the Prisma schema exactly)
export const PRISMA_USER_TYPE = {
  VENDOR: 'VENDOR',
  CLIENT: 'CLIENT',
  DRIVER: 'DRIVER',
  ADMIN: 'ADMIN',
  HELPDESK: 'HELPDESK',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;

export const PRISMA_USER_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  DELETED: 'DELETED'
} as const;

export const PRISMA_DRIVER_STATUS = {
  ARRIVED_AT_VENDOR: 'ARRIVED_AT_VENDOR',
  EN_ROUTE_TO_CLIENT: 'EN_ROUTE_TO_CLIENT',
  ARRIVED_TO_CLIENT: 'ARRIVED_TO_CLIENT',
  ASSIGNED: 'ASSIGNED',
  COMPLETED: 'COMPLETED'
} as const;

export const PRISMA_CATERING_STATUS = {
  ACTIVE: 'ACTIVE',
  ASSIGNED: 'ASSIGNED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED'
} as const;

export const PRISMA_ON_DEMAND_STATUS = {
  ACTIVE: 'ACTIVE',
  ASSIGNED: 'ASSIGNED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED'
} as const;

export const PRISMA_CATERING_NEED_HOST = {
  YES: 'YES',
  NO: 'NO'
} as const;

export const PRISMA_VEHICLE_TYPE = {
  CAR: 'CAR',
  VAN: 'VAN',
  TRUCK: 'TRUCK'
} as const;

export const PRISMA_APPLICATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  INTERVIEWING: 'INTERVIEWING'
} as const;

export const PRISMA_FORM_TYPE = {
  FOOD: 'FOOD',
  FLOWER: 'FLOWER',
  BAKERY: 'BAKERY',
  SPECIALTY: 'SPECIALTY'
} as const;

// Type definitions for Prisma enum values
export type PrismaUserTypeValue = typeof PRISMA_USER_TYPE[keyof typeof PRISMA_USER_TYPE];
export type PrismaUserStatusValue = typeof PRISMA_USER_STATUS[keyof typeof PRISMA_USER_STATUS];
export type PrismaDriverStatusValue = typeof PRISMA_DRIVER_STATUS[keyof typeof PRISMA_DRIVER_STATUS];
export type PrismaCateringNeedHostValue = typeof PRISMA_CATERING_NEED_HOST[keyof typeof PRISMA_CATERING_NEED_HOST];
export type PrismaCateringStatusValue = typeof PRISMA_CATERING_STATUS[keyof typeof PRISMA_CATERING_STATUS];
export type PrismaOnDemandStatusValue = typeof PRISMA_ON_DEMAND_STATUS[keyof typeof PRISMA_ON_DEMAND_STATUS];
export type PrismaVehicleTypeValue = typeof PRISMA_VEHICLE_TYPE[keyof typeof PRISMA_VEHICLE_TYPE];
export type PrismaApplicationStatusValue = typeof PRISMA_APPLICATION_STATUS[keyof typeof PRISMA_APPLICATION_STATUS];
export type PrismaFormTypeValue = typeof PRISMA_FORM_TYPE[keyof typeof PRISMA_FORM_TYPE];

// Import application enums for converter functions
import { 
  UserType as AppUserType, 
  UserStatus as AppUserStatus, 
  DriverStatus as AppDriverStatus, 
  CateringNeedHost as AppCateringNeedHost, 
  CateringStatus as AppCateringStatus, 
  OnDemandStatus as AppOnDemandStatus,
  VehicleType as AppVehicleType,
  ApplicationStatus as AppApplicationStatus
} from './user';

// Helper functions to convert between application enums and Prisma enums
export function convertToPrismaUserType(type: AppUserType): PrismaUserTypeValue {
  switch(type) {
    case AppUserType.ADMIN: return PRISMA_USER_TYPE.ADMIN;
    case AppUserType.VENDOR: return PRISMA_USER_TYPE.VENDOR;
    case AppUserType.CLIENT: return PRISMA_USER_TYPE.CLIENT;
    case AppUserType.DRIVER: return PRISMA_USER_TYPE.DRIVER;
    case AppUserType.HELPDESK: return PRISMA_USER_TYPE.HELPDESK;
    case AppUserType.SUPER_ADMIN: return PRISMA_USER_TYPE.SUPER_ADMIN;
    default: return PRISMA_USER_TYPE.VENDOR;
  }
}

export function convertToPrismaUserStatus(status: AppUserStatus): PrismaUserStatusValue {
  switch(status) {
    case AppUserStatus.ACTIVE: return PRISMA_USER_STATUS.ACTIVE;
    case AppUserStatus.PENDING: return PRISMA_USER_STATUS.PENDING;
    case AppUserStatus.DELETED: return PRISMA_USER_STATUS.DELETED;
    default: return PRISMA_USER_STATUS.PENDING;
  }
}

export function convertToPrismaDriverStatus(status: AppDriverStatus): PrismaDriverStatusValue {
  switch(status) {
    case AppDriverStatus.ARRIVED_AT_VENDOR: return PRISMA_DRIVER_STATUS.ARRIVED_AT_VENDOR;
    case AppDriverStatus.EN_ROUTE_TO_CLIENT: return PRISMA_DRIVER_STATUS.EN_ROUTE_TO_CLIENT;
    case AppDriverStatus.ARRIVED_TO_CLIENT: return PRISMA_DRIVER_STATUS.ARRIVED_TO_CLIENT;
    case AppDriverStatus.ASSIGNED: return PRISMA_DRIVER_STATUS.ASSIGNED;
    case AppDriverStatus.COMPLETED: return PRISMA_DRIVER_STATUS.COMPLETED;
    default: return PRISMA_DRIVER_STATUS.ASSIGNED;
  }
}

export function convertToPrismaCateringStatus(status: AppCateringStatus): PrismaCateringStatusValue {
  switch(status) {
    case AppCateringStatus.ACTIVE: return PRISMA_CATERING_STATUS.ACTIVE;
    case AppCateringStatus.ASSIGNED: return PRISMA_CATERING_STATUS.ASSIGNED;
    case AppCateringStatus.CANCELLED: return PRISMA_CATERING_STATUS.CANCELLED;
    case AppCateringStatus.COMPLETED: return PRISMA_CATERING_STATUS.COMPLETED;
    case AppCateringStatus.PENDING: return PRISMA_CATERING_STATUS.PENDING;
    case AppCateringStatus.CONFIRMED: return PRISMA_CATERING_STATUS.CONFIRMED;
    case AppCateringStatus.IN_PROGRESS: return PRISMA_CATERING_STATUS.IN_PROGRESS;
    case AppCateringStatus.DELIVERED: return PRISMA_CATERING_STATUS.DELIVERED;
    default: return PRISMA_CATERING_STATUS.ACTIVE;
  }
}

export function convertToPrismaOnDemandStatus(status: AppOnDemandStatus): PrismaOnDemandStatusValue {
  switch(status) {
    case AppOnDemandStatus.ACTIVE: return PRISMA_ON_DEMAND_STATUS.ACTIVE;
    case AppOnDemandStatus.ASSIGNED: return PRISMA_ON_DEMAND_STATUS.ASSIGNED;
    case AppOnDemandStatus.CANCELLED: return PRISMA_ON_DEMAND_STATUS.CANCELLED;
    case AppOnDemandStatus.COMPLETED: return PRISMA_ON_DEMAND_STATUS.COMPLETED;
    case AppOnDemandStatus.PENDING: return PRISMA_ON_DEMAND_STATUS.PENDING;
    case AppOnDemandStatus.CONFIRMED: return PRISMA_ON_DEMAND_STATUS.CONFIRMED;
    case AppOnDemandStatus.IN_PROGRESS: return PRISMA_ON_DEMAND_STATUS.IN_PROGRESS;
    case AppOnDemandStatus.DELIVERED: return PRISMA_ON_DEMAND_STATUS.DELIVERED;
    default: return PRISMA_ON_DEMAND_STATUS.ACTIVE;
  }
}

export function convertToPrismaVehicleType(type: AppVehicleType): PrismaVehicleTypeValue {
  switch(type) {
    case AppVehicleType.CAR: return PRISMA_VEHICLE_TYPE.CAR;
    case AppVehicleType.VAN: return PRISMA_VEHICLE_TYPE.VAN;
    case AppVehicleType.TRUCK: return PRISMA_VEHICLE_TYPE.TRUCK;
    default: return PRISMA_VEHICLE_TYPE.CAR;
  }
}

export function convertToPrismaApplicationStatus(status: AppApplicationStatus): PrismaApplicationStatusValue {
  switch(status) {
    case AppApplicationStatus.PENDING: return PRISMA_APPLICATION_STATUS.PENDING;
    case AppApplicationStatus.APPROVED: return PRISMA_APPLICATION_STATUS.APPROVED;
    case AppApplicationStatus.REJECTED: return PRISMA_APPLICATION_STATUS.REJECTED;
    case AppApplicationStatus.INTERVIEWING: return PRISMA_APPLICATION_STATUS.INTERVIEWING;
    default: return PRISMA_APPLICATION_STATUS.PENDING;
  }
}

// Helper function to convert from Prisma to application enum
export function convertToCateringNeedHost(needHost: PrismaCateringNeedHostValue): AppCateringNeedHost {
  switch(needHost) {
    case PRISMA_CATERING_NEED_HOST.YES: return AppCateringNeedHost.YES;
    case PRISMA_CATERING_NEED_HOST.NO: return AppCateringNeedHost.NO;
    default: return AppCateringNeedHost.NO;
  }
}

// Prisma helper types
export type PrismaError = Error | PrismaClientKnownRequestError | PrismaClientInitializationError | PrismaClientValidationError;

/**
 * Type for Prisma transaction client
 * This type can be used for the transaction callback parameter to avoid 'any' type errors
 */
export type PrismaTransaction = Omit<
  Prisma.TransactionClient, 
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Note: SortOrder can be accessed directly from Prisma if needed

// Helper function for typesafe transactions
export function withTransaction<T>(
  callback: (tx: PrismaTransaction) => Promise<T>
): (tx: PrismaTransaction) => Promise<T> {
  return callback;
} 