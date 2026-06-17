/**
 * Tests for the thin shift API wrappers that replaced the Server Actions
 * (start / end / active). The wrapped actions self-authorize, so these tests
 * only assert the HTTP plumbing: input validation, success status, and the
 * end route's mapping of the active-delivery guard to HTTP 409.
 */

jest.mock('@/app/actions/tracking/driver-actions', () => ({
  startDriverShift: jest.fn(),
  endDriverShift: jest.fn(),
  getActiveShift: jest.fn(),
}));

import { NextRequest } from 'next/server';
import {
  startDriverShift,
  endDriverShift,
  getActiveShift,
} from '@/app/actions/tracking/driver-actions';
import { POST as startPOST } from '../start/route';
import { POST as endPOST } from '../end/route';
import { GET as activeGET } from '../active/route';

const mockStart = startDriverShift as jest.Mock;
const mockEnd = endDriverShift as jest.Mock;
const mockActive = getActiveShift as jest.Mock;

const jsonPost = (url: string, body: unknown) => {
  const req = new NextRequest(url, { method: 'POST' });
  (req as any).json = jest.fn().mockResolvedValue(body);
  return req;
};

const LOC = { coordinates: { lat: 37.7, lng: -122.4 } };

describe('POST /api/tracking/shifts/start', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 when driverId is missing', async () => {
    const res = await startPOST(jsonPost('http://localhost/api/tracking/shifts/start', { location: LOC }));
    expect(res.status).toBe(400);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('200 and forwards args on success', async () => {
    mockStart.mockResolvedValue({ success: true, shiftId: 'shift-1' });
    const res = await startPOST(
      jsonPost('http://localhost/api/tracking/shifts/start', { driverId: 'd-1', location: LOC, metadata: { foo: 1 } }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, shiftId: 'shift-1' });
    expect(mockStart).toHaveBeenCalledWith('d-1', LOC, { foo: 1 });
  });
});

describe('POST /api/tracking/shifts/end', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400 when shiftId is missing', async () => {
    const res = await endPOST(jsonPost('http://localhost/api/tracking/shifts/end', { location: LOC }));
    expect(res.status).toBe(400);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('200 on success', async () => {
    mockEnd.mockResolvedValue({ success: true });
    const res = await endPOST(
      jsonPost('http://localhost/api/tracking/shifts/end', { shiftId: 's-1', location: LOC, finalMileage: 12 }),
    );
    expect(res.status).toBe(200);
    expect(mockEnd).toHaveBeenCalledWith('s-1', LOC, 12, {});
  });

  it('409 when the active-delivery guard blocks the end', async () => {
    mockEnd.mockResolvedValue({ success: false, error: 'Complete your deliveries first', activeDeliveries: 2 });
    const res = await endPOST(
      jsonPost('http://localhost/api/tracking/shifts/end', { shiftId: 's-1', location: LOC }),
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.activeDeliveries).toBe(2);
  });
});

describe('GET /api/tracking/shifts/active', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 with the active shift (forwards driverId)', async () => {
    mockActive.mockResolvedValue({ id: 'shift-1', status: 'active' });
    const res = await activeGET(new NextRequest('http://localhost/api/tracking/shifts/active?driverId=d-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, shift: { id: 'shift-1', status: 'active' } });
    expect(mockActive).toHaveBeenCalledWith('d-1');
  });
});
