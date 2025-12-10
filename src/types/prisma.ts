import { Prisma } from '@prisma/client';
import { Decimal } from "@prisma/client/runtime/library";

// Export Decimal type for use in other files
export { Decimal, Prisma };

// Re-export enum types and values
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

// Prisma payload types - fallback definitions
export type CateringRequestGetPayload<T = {}> = {
  id: string;
  guid?: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  brokerage?: string | null;
  orderNumber: string;
  pickupDateTime?: Date | null;
  arrivalDateTime?: Date | null;
  completeDateTime?: Date | null;
  headcount?: number | null;
  needHost: CateringNeedHost;
  hoursNeeded?: number | null;
  numberOfHosts?: number | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  image?: string | null;
  status: CateringStatus;
  orderTotal?: Decimal | null;
  tip?: Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  driverStatus?: DriverStatus | null;
  deletedAt?: Date | null;
} & (T extends { include: { dispatches: true } }
  ? { dispatches: DispatchGetPayload<{ include: { driver: true } }>[] }
  : {}) &
  (T extends { include: { fileUploads: true } }
    ? { fileUploads: FileUploadGetPayload<{}>[] }
    : {}) &
  (T extends { include: { pickupAddress: true } }
    ? { pickupAddress: AddressGetPayload<{}> }
    : {}) &
  (T extends { include: { deliveryAddress: true } }
    ? { deliveryAddress: AddressGetPayload<{}> }
    : {}) &
  (T extends { include: { user: true } }
    ? { user: ProfileGetPayload<{}> }
    : {});

export type OnDemandGetPayload<T = {}> = {
  id: string;
  guid?: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  brokerage?: string | null;
  orderNumber: string;
  pickupDateTime?: Date | null;
  arrivalDateTime?: Date | null;
  completeDateTime?: Date | null;
  headcount?: number | null;
  vehicleType?: VehicleType | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  image?: string | null;
  status: OnDemandStatus;
  orderTotal?: Decimal | null;
  tip?: Decimal | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  createdAt: Date;
  updatedAt: Date;
  driverStatus?: DriverStatus | null;
  deletedAt?: Date | null;
} & (T extends { include: { dispatches: true } }
  ? { dispatches: DispatchGetPayload<{ include: { driver: true } }>[] }
  : {}) &
  (T extends { include: { fileUploads: true } }
    ? { fileUploads: FileUploadGetPayload<{}>[] }
    : {}) &
  (T extends { include: { pickupAddress: true } }
    ? { pickupAddress: AddressGetPayload<{}> }
    : {}) &
  (T extends { include: { deliveryAddress: true } }
    ? { deliveryAddress: AddressGetPayload<{}> }
    : {}) &
  (T extends { include: { user: true } }
    ? { user: ProfileGetPayload<{}> }
    : {});

export type DispatchGetPayload<T = {}> = {
  id: string;
  cateringRequestId?: string | null;
  createdAt: Date;
  driverId?: string | null;
  onDemandId?: string | null;
  updatedAt: Date;
  userId?: string | null;
} & (T extends { include: { driver: true } }
  ? { driver: ProfileGetPayload<{}> | null }
  : {});

export type FileUploadGetPayload<T = {}> = {
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
};

export type ProfileGetPayload<T = {}> = {
  id: string;
  guid?: string | null;
  name?: string | null;
  email: string;
  image?: string | null;
  type: UserType;
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
  status: UserStatus;
  sideNotes?: string | null;
  confirmationCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isTemporaryPassword: boolean;
  deletedAt?: Date | null;
};

export type AddressGetPayload<T = {}> = {
  id: string;
  county?: string | null;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  createdAt: Date;
  createdBy?: string | null;
  isRestaurant: boolean;
  isShared: boolean;
  locationNumber?: string | null;
  parkingLoading?: string | null;
  updatedAt: Date;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deletedAt?: Date | null;
};

// Prisma where input types - fallback definitions
export type CateringRequestWhereInput = {
  id?: string | { in?: string[]; notIn?: string[]; not?: string };
  userId?: string | { in?: string[]; notIn?: string[]; not?: string };
  status?: CateringStatus | { in?: CateringStatus[]; notIn?: CateringStatus[]; not?: CateringStatus };
  pickupDateTime?: Date | { gte?: Date; lte?: Date; gt?: Date; lt?: Date };
  createdAt?: Date | { gte?: Date; lte?: Date; gt?: Date; lt?: Date };
  AND?: CateringRequestWhereInput[];
  OR?: CateringRequestWhereInput[];
  NOT?: CateringRequestWhereInput[];
};

export type OnDemandWhereInput = {
  id?: string | { in?: string[]; notIn?: string[]; not?: string };
  userId?: string | { in?: string[]; notIn?: string[]; not?: string };
  status?: OnDemandStatus | { in?: OnDemandStatus[]; notIn?: OnDemandStatus[]; not?: OnDemandStatus };
  pickupDateTime?: Date | { gte?: Date; lte?: Date; gt?: Date; lt?: Date };
  createdAt?: Date | { gte?: Date; lte?: Date; gt?: Date; lt?: Date };
  vehicleType?: VehicleType | { in?: VehicleType[]; notIn?: VehicleType[]; not?: VehicleType };
  AND?: OnDemandWhereInput[];
  OR?: OnDemandWhereInput[];
  NOT?: OnDemandWhereInput[];
};

export type ProfileWhereInput = {
  id?: string | { in?: string[]; notIn?: string[]; not?: string };
  email?: string | { contains?: string; startsWith?: string; endsWith?: string; mode?: 'insensitive' };
  type?: UserType | { in?: UserType[]; notIn?: UserType[]; not?: UserType };
  status?: UserStatus | { in?: UserStatus[]; notIn?: UserStatus[]; not?: UserStatus };
  name?: string | { contains?: string; startsWith?: string; endsWith?: string; mode?: 'insensitive' };
  AND?: ProfileWhereInput[];
  OR?: ProfileWhereInput[];
  NOT?: ProfileWhereInput[];
};

// Prisma order by types
export type SortOrder = 'asc' | 'desc';

export type CateringRequestOrderByWithRelationInput = {
  id?: SortOrder;
  orderNumber?: SortOrder;
  pickupDateTime?: SortOrder;
  createdAt?: SortOrder;
  status?: SortOrder;
  user?: { name?: SortOrder };
};

export type OnDemandOrderByWithRelationInput = {
  id?: SortOrder;
  orderNumber?: SortOrder;
  pickupDateTime?: SortOrder;
  createdAt?: SortOrder;
  status?: SortOrder;
  vehicleType?: SortOrder;
  user?: { name?: SortOrder };
};

export type ProfileOrderByWithRelationInput = {
  id?: SortOrder;
  name?: SortOrder;
  email?: SortOrder;
  createdAt?: SortOrder;
  type?: SortOrder;
  status?: SortOrder;
};

// Prisma create/update input types
export type ProfileCreateInput = {
  id?: string;
  guid?: string | null;
  name?: string | null;
  email: string;
  image?: string | null;
  type?: UserType;
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
  status?: UserStatus;
  sideNotes?: string | null;
  confirmationCode?: string | null;
  isTemporaryPassword?: boolean;
  deletedAt?: Date | null;
};

export type ProfileUpdateInput = {
  guid?: string | null;
  name?: string | null;
  email?: string;
  image?: string | null;
  type?: UserType;
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
  status?: UserStatus;
  sideNotes?: string | null;
  confirmationCode?: string | null;
  isTemporaryPassword?: boolean;
  deletedAt?: Date | null;
};

// Prisma payload aliases for compatibility
export type $CateringRequestPayload<T> = CateringRequestGetPayload<T>;
export type $OnDemandPayload<T> = OnDemandGetPayload<T>;

// Export basic types using defined payload types
export type CateringRequest = CateringRequestGetPayload<{}>;
export type OnDemand = OnDemandGetPayload<{}>;
export type Profile = ProfileGetPayload<{}>;
export type Address = AddressGetPayload<{}>;
export type Dispatch = DispatchGetPayload<{}>;
export type FileUpload = FileUploadGetPayload<{}>;

// Types that don't need payload definitions - keep as any for now
export type UserAddress = any;
export type FormSubmission = any;
export type LeadCapture = any;
export type JobApplication = any;
export type Account = any;
export type Session = any;
export type VerificationToken = any;

// Export complex types - basic definitions for now
export type CateringRequestWithRelations = CateringRequestGetPayload<{
  include: {
    dispatches: { include: { driver: true } };
    fileUploads: true;
    pickupAddress: true;
    deliveryAddress: true;
    user: true;
  };
}>;

export type OnDemandWithRelations = OnDemandGetPayload<{
  include: {
    dispatches: { include: { driver: true } };
    fileUploads: true;
    pickupAddress: true;
    deliveryAddress: true;
    user: true;
  };
}>;

export type ProfileWithRelations = ProfileGetPayload<{}>;

// Note: All types are available as direct imports from this module

// Export Prisma Error classes for proper error handling
export class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: any;
  constructor(message: string, options: { code: string; meta?: any }) {
    super(message);
    this.code = options.code;
    this.meta = options.meta;
  }
}

export class PrismaClientUnknownRequestError extends Error {}
export class PrismaClientRustPanicError extends Error {}
export class PrismaClientInitializationError extends Error {}
export class PrismaClientValidationError extends Error {}

 