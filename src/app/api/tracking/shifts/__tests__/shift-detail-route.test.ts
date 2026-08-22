/**
 * GET/PUT /api/tracking/shifts/[id] — shift detail route.
 *
 * Pins the route to the real `driver_shifts` schema (shift_start/shift_end,
 * total_distance_miles, notes, break_start/break_end; no shift_breaks table, no
 * metadata column) and to the guarded `endDriverShift` path for `action=end`.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn() },
}));
jest.mock('@/lib/auth-middleware');
jest.mock('@/lib/auth/driver-ownership', () => ({
  userOwnsDriver: jest.fn(),
}));
jest.mock('@/app/actions/tracking/driver-actions', () => ({
  endDriverShift: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET, PUT } from '../[id]/route';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';
import { userOwnsDriver } from '@/lib/auth/driver-ownership';
import { endDriverShift } from '@/app/actions/tracking/driver-actions';

const mockWithAuth = withAuth as jest.Mock;
const mockQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockExecute = prisma.$executeRawUnsafe as jest.Mock;
const mockOwns = userOwnsDriver as jest.Mock;
const mockEndShift = endDriverShift as jest.Mock;

const SHIFT_ID = '5bae9262-0000-0000-0000-000000000000';
const URL = `http://localhost:3000/api/tracking/shifts/${SHIFT_ID}`;
const LOCATION = { coordinates: { lat: 30.2772, lng: -97.7531 } };
const iso = (v: unknown) => new Date(v as string | Date).toISOString();

const get = () => GET(new NextRequest(URL), { params: Promise.resolve({ id: SHIFT_ID }) });
const put = (body: unknown) =>
  PUT(
    new NextRequest(URL, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: SHIFT_ID }) },
  );

function authAs(type: string, id = 'u-1') {
  mockWithAuth.mockResolvedValue({
    success: true,
    context: { user: { id, email: 'u@example.com', type } },
  });
}

const SHIFT_ROW = {
  id: SHIFT_ID,
  driver_id: 'drv-1',
  shift_start: new Date('2026-08-21T18:48:00Z'),
  shift_end: new Date('2026-08-21T22:10:00Z'),
  start_location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
  end_location_geojson: null,
  total_distance: 24.94,
  total_distance_miles: 15.5,
  gps_distance_miles: 15.2,
  mileage_source: 'gps',
  delivery_count: 3,
  status: 'completed',
  notes: 'Smooth shift',
  break_start: new Date('2026-08-21T20:00:00Z'),
  break_end: new Date('2026-08-21T20:30:00Z'),
  created_at: new Date('2026-08-21T18:48:00Z'),
  updated_at: new Date('2026-08-21T22:10:00Z'),
  employee_id: 'EMP-001',
  vehicle_number: 'TX-1234',
};

describe('GET /api/tracking/shifts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the real driver_shifts columns in a single soft-delete-filtered query', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([SHIFT_ROW]);

    const res = await get();
    expect(res.status).toBe(200);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, ...args] = mockQuery.mock.calls[0]!;
    const text = String(sql);
    expect(text).toMatch(/ds\.shift_start/);
    expect(text).toMatch(/ds\.shift_end/);
    expect(text).toMatch(/ds\.total_distance_miles/);
    expect(text).toMatch(/ds\.notes/);
    expect(text).toMatch(/ds\.break_start/);
    expect(text).toMatch(/ds\.deleted_at IS NULL/);
    expect(text).toMatch(/\$1::uuid/);
    expect(text).not.toMatch(/start_time|end_time/);
    expect(text).not.toMatch(/shift_breaks/);
    expect(text).not.toMatch(/ds\.metadata/);
    expect(args[0]).toBe(SHIFT_ID);
  });

  it('maps the row to the response shape and derives breaks from break_start/break_end', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([SHIFT_ROW]);

    const res = await get();
    const json = await res.json();
    expect(json.success).toBe(true);
    const { data } = json;
    expect(data.id).toBe(SHIFT_ID);
    expect(data.driverId).toBe('drv-1');
    // The jest Response polyfill does not serialize Dates, so normalize.
    expect(iso(data.startTime)).toBe(SHIFT_ROW.shift_start.toISOString());
    expect(iso(data.endTime)).toBe(SHIFT_ROW.shift_end.toISOString());
    expect(data.startLocation).toEqual([30.2672, -97.7431]);
    expect(data.endLocation).toBeUndefined();
    expect(data.totalDistanceMiles).toBe(15.5);
    expect(data.gpsDistanceMiles).toBe(15.2);
    expect(data.mileageSource).toBe('gps');
    expect(data.totalDistanceKm).toBe(24.94);
    expect(data.deliveryCount).toBe(3);
    expect(data.status).toBe('completed');
    expect(data.notes).toBe('Smooth shift');
    expect(data.breaks).toHaveLength(1);
    expect(iso(data.breaks[0].startTime)).toBe(SHIFT_ROW.break_start.toISOString());
    expect(iso(data.breaks[0].endTime)).toBe(SHIFT_ROW.break_end.toISOString());
    expect(data.driverInfo).toEqual({ employeeId: 'EMP-001', vehicleNumber: 'TX-1234' });
    expect(data).not.toHaveProperty('metadata');
  });

  it('returns an empty breaks array when the shift has no break', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([{ ...SHIFT_ROW, break_start: null, break_end: null }]);

    const res = await get();
    const json = await res.json();
    expect(json.data.breaks).toEqual([]);
  });

  it('hides driverInfo from the owning driver', async () => {
    authAs('DRIVER', 'driver-user-1');
    mockQuery.mockResolvedValueOnce([SHIFT_ROW]);
    mockOwns.mockResolvedValueOnce(true);

    const res = await get();
    expect(res.status).toBe(200);
    expect(mockOwns).toHaveBeenCalledWith('drv-1', 'driver-user-1');
    const json = await res.json();
    expect(json.data.driverInfo).toBeUndefined();
  });

  it("404s (not 403) when a driver fetches another driver's shift", async () => {
    authAs('DRIVER', 'driver-user-1');
    mockQuery.mockResolvedValueOnce([SHIFT_ROW]);
    mockOwns.mockResolvedValueOnce(false);

    const res = await get();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/shift not found/i);
  });

  it('404s for an unknown shift', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([]);

    const res = await get();
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tracking/shifts/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue(1);
  });

  const activeShift = () => mockQuery.mockResolvedValueOnce([{ driver_id: 'drv-1', status: 'active' }]);

  it('verify query is soft-delete filtered and casts the id to uuid', async () => {
    authAs('ADMIN');
    activeShift();
    mockEndShift.mockResolvedValueOnce({ success: true });

    await put({ action: 'end', location: LOCATION });

    const [sql, ...args] = mockQuery.mock.calls[0]!;
    expect(String(sql)).toMatch(/ds\.deleted_at IS NULL/);
    expect(String(sql)).toMatch(/\$1::uuid/);
    expect(args[0]).toBe(SHIFT_ID);
  });

  it('end without a location is a 400 and never reaches endDriverShift', async () => {
    authAs('ADMIN');
    activeShift();

    const res = await put({ action: 'end' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ success: false, error: 'Missing location' });
    expect(mockEndShift).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('end delegates to endDriverShift with (id, location, finalMileage, metadata) and returns 200 on success', async () => {
    authAs('ADMIN');
    activeShift();
    mockEndShift.mockResolvedValueOnce({ success: true });

    const res = await put({
      action: 'end',
      location: LOCATION,
      finalMileage: 12.5,
      metadata: { notes: 'done' },
    });

    expect(res.status).toBe(200);
    expect(mockEndShift).toHaveBeenCalledTimes(1);
    expect(mockEndShift).toHaveBeenCalledWith(SHIFT_ID, LOCATION, 12.5, { notes: 'done' });
    // The route no longer writes driver_shifts / drivers itself for `end`.
    expect(mockExecute).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('end passes an empty metadata object when none is supplied', async () => {
    authAs('ADMIN');
    activeShift();
    mockEndShift.mockResolvedValueOnce({ success: true });

    await put({ action: 'end', location: LOCATION });
    expect(mockEndShift).toHaveBeenCalledWith(SHIFT_ID, LOCATION, undefined, {});
  });

  it('end maps the active-delivery guard to 409 with the blocking orders', async () => {
    authAs('DRIVER', 'driver-user-1');
    activeShift();
    mockOwns.mockResolvedValueOnce(true);
    const blocked = {
      success: false,
      error: 'Complete your deliveries first',
      activeDeliveries: 1,
      blockingOrders: [{ orderNumber: 'CV-123', reason: 'IN_PROGRESS' }],
    };
    mockEndShift.mockResolvedValueOnce(blocked);

    const res = await put({ action: 'end', location: LOCATION });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(blocked);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('end maps any other endDriverShift failure to 400', async () => {
    authAs('ADMIN');
    activeShift();
    mockEndShift.mockResolvedValueOnce({ success: false, error: 'Access denied' });

    const res = await put({ action: 'end', location: LOCATION });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Access denied' });
  });

  it('end on a completed shift is a 400 before any delegation', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([{ driver_id: 'drv-1', status: 'completed' }]);

    const res = await put({ action: 'end', location: LOCATION });
    expect(res.status).toBe(400);
    expect(mockEndShift).not.toHaveBeenCalled();
  });

  it("403s when a driver updates another driver's shift", async () => {
    authAs('DRIVER', 'driver-user-1');
    activeShift();
    mockOwns.mockResolvedValueOnce(false);

    const res = await put({ action: 'end', location: LOCATION });
    expect(res.status).toBe(403);
    expect(mockEndShift).not.toHaveBeenCalled();
  });

  it('update_metadata appends the serialized metadata to notes (no metadata column exists)', async () => {
    authAs('ADMIN');
    activeShift();

    const res = await put({ action: 'update_metadata', metadata: { vehicleCheck: true } });
    expect(res.status).toBe(200);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, ...args] = mockExecute.mock.calls[0]!;
    const text = String(sql);
    expect(text).toMatch(/UPDATE driver_shifts/);
    expect(text).toMatch(/SET\s+notes = COALESCE\(notes, ''\) \|\| \$2/);
    expect(text).toMatch(/deleted_at IS NULL/);
    expect(text).not.toMatch(/metadata/);
    expect(args).toEqual([SHIFT_ID, ' ' + JSON.stringify({ vehicleCheck: true })]);
  });

  it('404s when the shift does not exist', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([]);

    const res = await put({ action: 'end', location: LOCATION });
    expect(res.status).toBe(404);
  });

  it('400s on an unknown action', async () => {
    authAs('ADMIN');
    activeShift();

    const res = await put({ action: 'nope' });
    expect(res.status).toBe(400);
  });
});
