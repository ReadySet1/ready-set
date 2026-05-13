import { CateringStatus, OnDemandStatus, DriverStatus } from '@/types/user';

export type OrderType = 'catering' | 'on_demand';

export type OrderStatus = CateringStatus | OnDemandStatus;

export interface TransitionRequest {
  orderType: OrderType;
  orderId: string;
  currentStatus: OrderStatus | null;
  currentDriverStatus: DriverStatus | null;
  nextDriverStatus?: DriverStatus;
  nextOrderStatus?: OrderStatus;
  actorId?: string;
}

export interface TransitionResult {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus | null;
  previousDriverStatus: DriverStatus | null;
  newDriverStatus: DriverStatus | null;
  sideEffects: SideEffectDescriptor[];
}

export type SideEffectDescriptor =
  | { kind: 'notify_customer'; driverStatus: DriverStatus }
  | { kind: 'notify_admin'; driverStatus: DriverStatus }
  | { kind: 'webhook'; provider: 'catervalley' | 'ezcater'; orderId: string }
  | { kind: 'upsert_dispatch'; orderId: string; orderType: OrderType }
  | { kind: 'upsert_delivery_timestamp'; driverStatus: DriverStatus }
  | { kind: 'invalidate_cache'; orderId: string };

export class StateTransitionError extends Error {
  constructor(
    public readonly from: string | null,
    public readonly to: string,
    public readonly kind: 'order' | 'driver',
  ) {
    super(
      `Illegal ${kind} transition: ${from ?? 'null'} → ${to}`,
    );
    this.name = 'StateTransitionError';
  }
}
