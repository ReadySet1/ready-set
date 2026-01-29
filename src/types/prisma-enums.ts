/**
 * Client-safe Prisma enum types and constants.
 * This file contains only pure TypeScript types without any Prisma runtime imports,
 * making it safe to use in client components.
 */

// User types
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

export type DriverStatus = 'ARRIVED_AT_VENDOR' | 'PICKED_UP' | 'EN_ROUTE_TO_CLIENT' | 'ARRIVED_TO_CLIENT' | 'ASSIGNED' | 'COMPLETED';
export const DriverStatus = {
  ARRIVED_AT_VENDOR: 'ARRIVED_AT_VENDOR' as const,
  PICKED_UP: 'PICKED_UP' as const,
  EN_ROUTE_TO_CLIENT: 'EN_ROUTE_TO_CLIENT' as const,
  ARRIVED_TO_CLIENT: 'ARRIVED_TO_CLIENT' as const,
  ASSIGNED: 'ASSIGNED' as const,
  COMPLETED: 'COMPLETED' as const,
};

export type CateringNeedHost = 'YES' | 'NO';
export const CateringNeedHost = {
  YES: 'YES' as const,
  NO: 'NO' as const,
};

export type CateringStatus = 'ACTIVE' | 'ASSIGNED' | 'CANCELLED' | 'COMPLETED' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED';
export const CateringStatus = {
  ACTIVE: 'ACTIVE' as const,
  ASSIGNED: 'ASSIGNED' as const,
  CANCELLED: 'CANCELLED' as const,
  COMPLETED: 'COMPLETED' as const,
  PENDING: 'PENDING' as const,
  CONFIRMED: 'CONFIRMED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  DELIVERED: 'DELIVERED' as const,
};

export type OnDemandStatus = 'ACTIVE' | 'ASSIGNED' | 'CANCELLED' | 'COMPLETED' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED';
export const OnDemandStatus = {
  ACTIVE: 'ACTIVE' as const,
  ASSIGNED: 'ASSIGNED' as const,
  CANCELLED: 'CANCELLED' as const,
  COMPLETED: 'COMPLETED' as const,
  PENDING: 'PENDING' as const,
  CONFIRMED: 'CONFIRMED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  DELIVERED: 'DELIVERED' as const,
};

export type VehicleType = 'CAR' | 'VAN' | 'TRUCK';
export const VehicleType = {
  CAR: 'CAR' as const,
  VAN: 'VAN' as const,
  TRUCK: 'TRUCK' as const,
};

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INTERVIEWING';
export const ApplicationStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  INTERVIEWING: 'INTERVIEWING' as const,
};

export type FormType = 'FOOD' | 'FLOWER' | 'BAKERY' | 'SPECIALTY';
export const FormType = {
  FOOD: 'FOOD' as const,
  FLOWER: 'FLOWER' as const,
  BAKERY: 'BAKERY' as const,
  SPECIALTY: 'SPECIALTY' as const,
};

export type SortOrder = 'asc' | 'desc';
