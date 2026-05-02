/**
 * Types for the driver cockpit UI.
 * Matches the shape returned by GET /api/driver-deliveries.
 */

export interface CockpitAddress {
  id: string;
  street1: string | null;
  street2?: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CockpitDelivery {
  id: string;
  orderNumber: string;
  delivery_type: 'catering' | 'on_demand';
  status: string;
  driverStatus?: string | null;
  pickupDateTime: string;
  arrivalDateTime: string;
  completeDateTime?: string | null;
  order_total?: string | number;
  client_attention?: string | null;
  address: CockpitAddress;
  delivery_address?: CockpitAddress | null;
  specialNotes?: string | null;
  pickupNotes?: string | null;
  createdAt: string;
  headcount?: number | null;
  needHost?: string | null;
  hoursNeeded?: number | null;
  vehicleType?: string | null;
  itemDelivered?: string | null;
  user?: {
    name?: string | null;
    email: string;
  };
  fileUploads?: Array<{
    id: string;
    fileUrl: string;
    category?: string | null;
    uploadedAt?: string;
  }>;
  deliveryTimestamps?: {
    assignedAt?: string | null;
    enRouteToVendorAt?: string | null;
    arrivedAtVendorAt?: string | null;
    pickedUpAt?: string | null;
    enRouteAt?: string | null;
    arrivedAtClientAt?: string | null;
    deliveredAt?: string | null;
  };
}

export type QueueSection = 'now' | 'up_next' | 'done_today';
