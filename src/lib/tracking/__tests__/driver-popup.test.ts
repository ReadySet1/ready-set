import { buildDriverPopupHtml, escapeHtml } from '@/lib/tracking/driver-popup';
import type { DeliveryTracking, TrackedDriver } from '@/types/tracking';

const driver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  name: 'Fernando <Driver>',
  vehicleNumber: 'VEH-1',
  isOnDuty: true,
  deliveryCount: 2,
  totalDistanceMiles: 3.456,
} as unknown as TrackedDriver;

const cateringDelivery = {
  id: '786fdbfb-1111-2222-3333-444444444444',
  driverId: 'driver-1',
  cateringRequestId: 'cr-1',
  orderNumber: 'Test 0821262',
  status: 'ASSIGNED',
} as unknown as DeliveryTracking;

describe('escapeHtml', () => {
  it('escapes the HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('buildDriverPopupHtml', () => {
  it('escapes interpolated driver strings', () => {
    const html = buildDriverPopupHtml({ driver, battery: { status: 'good' } });
    expect(html).toContain('Fernando &lt;Driver&gt;');
    expect(html).not.toContain('<Driver>');
  });

  it('links to the catering order and the driver history when a delivery is active', () => {
    const html = buildDriverPopupHtml({
      driver,
      battery: { status: 'good' },
      activeDelivery: cateringDelivery,
    });
    expect(html).toContain('href="/admin/catering-orders/Test%200821262"');
    expect(html).toContain('View order');
    expect(html).toContain('href="/admin/drivers/driver-1/history"');
    expect(html).toContain('Driver history');
  });

  it('links to the on-demand order route for on-demand deliveries', () => {
    const html = buildDriverPopupHtml({
      driver,
      battery: { status: 'good' },
      activeDelivery: {
        ...cateringDelivery,
        cateringRequestId: undefined,
        onDemandId: 'od-1',
        orderNumber: 'OD-42',
      },
    });
    expect(html).toContain('href="/admin/on-demand-orders/OD-42"');
  });

  it('omits the order link when there is no active delivery', () => {
    const html = buildDriverPopupHtml({ driver, battery: { status: 'good' } });
    expect(html).not.toContain('View order');
    expect(html).not.toContain('/admin/catering-orders/');
  });

  it('omits the order link when the delivery has no order number', () => {
    const html = buildDriverPopupHtml({
      driver,
      battery: { status: 'good' },
      activeDelivery: { ...cateringDelivery, orderNumber: undefined },
    });
    expect(html).not.toContain('View order');
  });

  it('shows distance in miles, rounded to one decimal, only while on duty', () => {
    const onDuty = buildDriverPopupHtml({ driver, battery: { status: 'good' } });
    expect(onDuty).toContain('Distance: 3.5 mi');
    const offDuty = buildDriverPopupHtml({
      driver: { ...driver, isOnDuty: false },
      battery: { status: 'good' },
    });
    expect(offDuty).not.toContain('Distance:');
    expect(offDuty).toContain('Off Duty');
  });

  it('shows the travelled trail length when provided', () => {
    const html = buildDriverPopupHtml({
      driver,
      battery: { status: 'good' },
      trailMiles: 0.62,
    });
    expect(html).toContain('Trail: 0.6 mi');
  });
});
