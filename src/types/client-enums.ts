// Client-side safe enums (no Prisma imports)
// These should match the database values exactly

export type UserType = 'VENDOR' | 'CLIENT' | 'DRIVER' | 'ADMIN' | 'HELPDESK' | 'SUPER_ADMIN';
export const UserType = {
  VENDOR: 'VENDOR' as const,
  CLIENT: 'CLIENT' as const,
  DRIVER: 'DRIVER' as const,
  ADMIN: 'ADMIN' as const,
  HELPDESK: 'HELPDESK' as const,
  SUPER_ADMIN: 'SUPER_ADMIN' as const,
};

export type UserStatus = 'ACTIVE' | 'PENDING' | 'DELETED';
export const UserStatus = {
  ACTIVE: 'ACTIVE' as const,
  PENDING: 'PENDING' as const,
  DELETED: 'DELETED' as const,
};

export type DriverStatus = 'ARRIVED_AT_VENDOR' | 'EN_ROUTE_TO_CLIENT' | 'ARRIVED_TO_CLIENT' | 'ASSIGNED' | 'COMPLETED';
export const DriverStatus = {
  ARRIVED_AT_VENDOR: 'ARRIVED_AT_VENDOR' as const,
  EN_ROUTE_TO_CLIENT: 'EN_ROUTE_TO_CLIENT' as const,
  ARRIVED_TO_CLIENT: 'ARRIVED_TO_CLIENT' as const,
  ASSIGNED: 'ASSIGNED' as const,
  COMPLETED: 'COMPLETED' as const,
};

export type VehicleType = 'CAR' | 'VAN' | 'TRUCK';
export const VehicleType = {
  CAR: 'CAR' as const,
  VAN: 'VAN' as const,
  TRUCK: 'TRUCK' as const,
};

export type CateringNeedHost = 'YES' | 'NO';
export const CateringNeedHost = {
  YES: 'YES' as const,
  NO: 'NO' as const,
};
