/**
 * ezCater Courier Event Service
 *
 * High-level service for reporting delivery lifecycle events to ezCater.
 * Wraps low-level GraphQL operations with business logic and convenience methods.
 */

import { courierEventCreate, courierAssign } from '@/lib/ezcater/operations';
import { EzCaterApiError } from '@/lib/ezcater/errors';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';
import type {
  EzCaterCourierEventType,
  EzCaterCourier,
  EzCaterCoordinates,
  EzCaterCourierEventCreateInput,
  EzCaterCourierAssignInput,
} from '@/types/ezcater';
import type { DriverStatus } from '@/types/prisma';

/**
 * Driver information for building courier objects
 */
export interface DriverInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicle?: {
    make?: string;
    model?: string;
    color?: string;
  };
}

/**
 * Parameters for reporting a courier event
 */
export interface ReportEventParams {
  deliveryId: string;
  eventType: EzCaterCourierEventType;
  driver: DriverInfo;
  coordinates?: EzCaterCoordinates;
  occurredAt?: Date;
}

/**
 * Result of an event reporting operation
 */
export interface EventReportResult {
  success: boolean;
  deliveryId: string;
  eventType: EzCaterCourierEventType;
  error?: string;
}

/**
 * Maps internal DriverStatus to ezCater courier event types
 */
const DRIVER_STATUS_TO_EZCATER_EVENT: Record<DriverStatus, EzCaterCourierEventType | null> = {
  ASSIGNED: 'COURIER_ASSIGNED',
  ARRIVED_AT_VENDOR: 'ARRIVED_AT_PICKUP',
  PICKED_UP: 'ORDER_PICKED_UP',
  EN_ROUTE_TO_CLIENT: 'EN_ROUTE_TO_DROPOFF',
  ARRIVED_TO_CLIENT: 'ARRIVED_AT_DROPOFF',
  COMPLETED: 'ORDER_DELIVERED',
};

/**
 * Service for reporting courier events to ezCater
 */
export class CourierEventService {
  private static instance: CourierEventService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): CourierEventService {
    if (!CourierEventService.instance) {
      CourierEventService.instance = new CourierEventService();
    }
    return CourierEventService.instance;
  }

  /**
   * Report a delivery lifecycle event to ezCater
   */
  async reportEvent(params: ReportEventParams): Promise<EventReportResult> {
    const { deliveryId, eventType, driver, coordinates, occurredAt = new Date() } = params;

    const logContext = {
      deliveryId,
      eventType,
      driverId: driver.id,
    };

    try {
      logger.info('[CourierEventService] Reporting event to ezCater', logContext);

      const input: EzCaterCourierEventCreateInput = {
        deliveryId,
        eventType,
        occurredAt: occurredAt.toISOString(),
        courier: CourierEventService.buildCourierInfo(driver),
        coordinates,
      };

      await courierEventCreate(input);

      logger.info('[CourierEventService] Event reported successfully', logContext);

      return {
        success: true,
        deliveryId,
        eventType,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[CourierEventService] Failed to report event', {
        ...logContext,
        error: errorMessage,
      });

      // Report to Sentry but don't throw - we don't want to fail the main operation
      Sentry.captureException(error, {
        tags: {
          service: 'CourierEventService',
          operation: 'reportEvent',
        },
        extra: logContext,
      });

      return {
        success: false,
        deliveryId,
        eventType,
        error: errorMessage,
      };
    }
  }

  /**
   * Assign a courier to an ezCater delivery
   */
  async assignCourier(
    deliveryId: string,
    driver: DriverInfo
  ): Promise<EventReportResult> {
    const logContext = {
      deliveryId,
      driverId: driver.id,
      eventType: 'COURIER_ASSIGNED' as const,
    };

    try {
      logger.info('[CourierEventService] Assigning courier to delivery', logContext);

      const input: EzCaterCourierAssignInput = {
        deliveryId,
        courier: CourierEventService.buildCourierInfo(driver),
        deliveryServiceProvider: 'Ready Set',
      };

      await courierAssign(input);

      logger.info('[CourierEventService] Courier assigned successfully', logContext);

      return {
        success: true,
        deliveryId,
        eventType: 'COURIER_ASSIGNED',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[CourierEventService] Failed to assign courier', {
        ...logContext,
        error: errorMessage,
      });

      Sentry.captureException(error, {
        tags: {
          service: 'CourierEventService',
          operation: 'assignCourier',
        },
        extra: logContext,
      });

      return {
        success: false,
        deliveryId,
        eventType: 'COURIER_ASSIGNED',
        error: errorMessage,
      };
    }
  }

  /**
   * Report that courier is en route to pickup location
   */
  async markEnRouteToPickup(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'EN_ROUTE_TO_PICKUP',
      driver,
      coordinates,
    });
  }

  /**
   * Report that courier has arrived at pickup location
   */
  async markArrivedAtPickup(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'ARRIVED_AT_PICKUP',
      driver,
      coordinates,
    });
  }

  /**
   * Report that order has been picked up (REQUIRED for tracking)
   */
  async markPickedUp(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'ORDER_PICKED_UP',
      driver,
      coordinates,
    });
  }

  /**
   * Report that courier is en route to delivery location
   */
  async markEnRouteToDropoff(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'EN_ROUTE_TO_DROPOFF',
      driver,
      coordinates,
    });
  }

  /**
   * Report that courier has arrived at delivery location
   */
  async markArrivedAtDropoff(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'ARRIVED_AT_DROPOFF',
      driver,
      coordinates,
    });
  }

  /**
   * Report that order has been delivered (REQUIRED for tracking)
   */
  async markDelivered(
    deliveryId: string,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult> {
    return this.reportEvent({
      deliveryId,
      eventType: 'ORDER_DELIVERED',
      driver,
      coordinates,
    });
  }

  /**
   * Report event based on internal DriverStatus
   * Returns null if the status doesn't map to an ezCater event
   */
  async reportStatusChange(
    deliveryId: string,
    driverStatus: DriverStatus,
    driver: DriverInfo,
    coordinates?: EzCaterCoordinates
  ): Promise<EventReportResult | null> {
    const eventType = CourierEventService.mapStatusToEventType(driverStatus);

    if (!eventType) {
      logger.debug('[CourierEventService] No ezCater event mapping for status', {
        deliveryId,
        driverStatus,
      });
      return null;
    }

    // For ASSIGNED status, use the assignCourier method which calls courierAssign
    if (driverStatus === 'ASSIGNED') {
      return this.assignCourier(deliveryId, driver);
    }

    return this.reportEvent({
      deliveryId,
      eventType,
      driver,
      coordinates,
    });
  }

  /**
   * Map internal DriverStatus to ezCater event type
   */
  static mapStatusToEventType(
    driverStatus: DriverStatus
  ): EzCaterCourierEventType | null {
    return DRIVER_STATUS_TO_EZCATER_EVENT[driverStatus] ?? null;
  }

  /**
   * Build ezCater courier object from driver info
   */
  static buildCourierInfo(driver: DriverInfo): EzCaterCourier {
    return {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      phone: driver.phone,
      vehicle: driver.vehicle,
    };
  }

  /**
   * Check if a DriverStatus has a corresponding ezCater event
   */
  static hasEventMapping(driverStatus: DriverStatus): boolean {
    return DRIVER_STATUS_TO_EZCATER_EVENT[driverStatus] !== null;
  }

  /**
   * Check if an order is an ezCater order based on order number prefix
   */
  static isEzCaterOrder(orderNumber: string): boolean {
    return orderNumber.startsWith('EZ-');
  }
}

// Export singleton instance
export const courierEventService = CourierEventService.getInstance();
