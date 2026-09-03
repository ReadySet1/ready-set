/**
 * Pure HTML builder for the driver marker popup on the admin live map.
 * Kept free of Mapbox/React so it can be unit-tested and so every
 * interpolated user string is escaped in exactly one place.
 */

import type { DeliveryTracking, TrackedDriver } from '@/types/tracking';
import { DRIVER_STATUS_COLORS } from '@/constants/tracking-colors';

export interface PopupBattery {
  level?: number;
  status: 'good' | 'low' | 'critical';
}

export interface DriverPopupInput {
  driver: TrackedDriver;
  battery: PopupBattery;
  /** The driver's active delivery, when one is known. */
  activeDelivery?: DeliveryTracking;
  /** Length of the travelled trail drawn on the map, in miles. */
  trailMiles?: number;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const roundTenth = (value: number): number => Math.round(value * 10) / 10;

/** Admin order-detail URL for a delivery, or null when it cannot be resolved. */
export function orderDetailHref(delivery: DeliveryTracking): string | null {
  if (!delivery.orderNumber) return null;
  const base = delivery.onDemandId ? '/admin/on-demand-orders' : '/admin/catering-orders';
  return `${base}/${encodeURIComponent(delivery.orderNumber)}`;
}

const LINK_STYLE = 'color: #2563eb; text-decoration: underline; font-size: 11px;';

export function buildDriverPopupHtml({ driver, battery, activeDelivery, trailMiles }: DriverPopupInput): string {
  const batteryIcon = battery.status === 'good' ? '🔋' : battery.status === 'low' ? '🪫' : '⚠️';
  const dutyColor = driver.isOnDuty ? DRIVER_STATUS_COLORS.moving : DRIVER_STATUS_COLORS.offDuty;
  const title = driver.name || `Driver #${driver.employeeId}`;

  const orderHref = activeDelivery ? orderDetailHref(activeDelivery) : null;
  const links: string[] = [];
  if (orderHref) {
    links.push(
      `<a href="${orderHref}" style="${LINK_STYLE}">View order${
        activeDelivery?.orderNumber ? ` ${escapeHtml(activeDelivery.orderNumber)}` : ''
      }</a>`,
    );
  }
  links.push(
    `<a href="/admin/drivers/${encodeURIComponent(driver.id)}/history" style="${LINK_STYLE}">Driver history</a>`,
  );

  const stats = driver.isOnDuty
    ? `
          <div style="font-size: 11px; color: #6b7280;">
            <div>Deliveries: ${escapeHtml(driver.deliveryCount || 0)}</div>
            <div>Distance: ${roundTenth(driver.totalDistanceMiles || 0)} mi</div>
            ${trailMiles !== undefined ? `<div>Trail: ${roundTenth(trailMiles)} mi</div>` : ''}
          </div>
        `
    : '';

  return `
      <div style="padding: 8px; min-width: 200px;">
        <div style="font-weight: 600; margin-bottom: 8px;">${escapeHtml(title)}</div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Vehicle: ${escapeHtml(driver.vehicleNumber || 'Not set')}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background-color: ${dutyColor};
            color: white;
          ">
            ${driver.isOnDuty ? 'On Duty' : 'Off Duty'}
          </span>
          ${battery.level ? `
            <span style="font-size: 11px;">
              ${batteryIcon} ${escapeHtml(battery.level)}%
            </span>
          ` : ''}
        </div>
        ${stats}
        <div style="display: flex; gap: 12px; margin-top: 8px;">
          ${links.join('\n          ')}
        </div>
      </div>
    `;
}
