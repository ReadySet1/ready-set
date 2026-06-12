import { NextRequest } from 'next/server';

// The route uses the shared pooled-Prisma raw helpers (`@/lib/db/raw`) instead
// of its own pg.Pool. Mock `rawQuery` (the only helper the drivers route uses).
jest.mock('@/lib/db/raw', () => ({
  __esModule: true,
  rawQuery: jest.fn(),
  rawExec: jest.fn(),
  withRawTx: jest.fn(),
  TRACKING_STATEMENT_TIMEOUT_MS: 8000,
  DbHttpError: class DbHttpError extends Error {},
}));

// Route gained withAuth in the security-hardening pass — mock it (default ADMIN).
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));

import { GET, POST, PUT } from '@/app/api/tracking/drivers/route';
import { withAuth } from '@/lib/auth-middleware';
import { rawQuery } from '@/lib/db/raw';

const mockWithAuth = withAuth as jest.Mock;
const mockRawQuery = rawQuery as jest.Mock;

describe('/api/tracking/drivers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'admin-1', type: 'ADMIN' } },
    });
  });

  describe('GET /api/tracking/drivers', () => {
    it('returns all drivers when no query parameters', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          user_id: 'user-1',
          profile_id: 'profile-1',
          employee_id: 'EMP001',
          vehicle_number: 'VEH001',
          phone_number: '+1234567890',
          is_active: true,
          is_on_duty: true,
          shift_start_time: null,
          shift_end_time: null,
          current_shift_id: null,
          last_known_location: null,
          last_location_update: null,
          last_known_accuracy: null,
          last_known_speed: null,
          last_known_heading: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'driver-2',
          user_id: 'user-2',
          profile_id: 'profile-2',
          employee_id: 'EMP002',
          vehicle_number: 'VEH002',
          phone_number: '+1234567891',
          is_active: false,
          is_on_duty: false,
          shift_start_time: null,
          shift_end_time: null,
          current_shift_id: null,
          last_known_location: null,
          last_location_update: null,
          last_known_accuracy: null,
          last_known_speed: null,
          last_known_heading: null,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockRawQuery.mockResolvedValue(mockDrivers);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockDrivers);
      expect(data.pagination.total).toBe(mockDrivers.length);
      expect(data.pagination.limit).toBe(50); // default limit
      expect(data.pagination.offset).toBe(0); // default offset
    });

    it('filters drivers by status when status parameter provided', async () => {
      const mockActiveDrivers = [
        { id: 'driver-1', employee_id: 'EMP001', vehicle_number: 'VEH001', is_active: true, is_on_duty: true },
      ];
      mockRawQuery.mockResolvedValue(mockActiveDrivers);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?active=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it('returns 200 with empty data for unknown status parameter (no validation)', async () => {
      mockRawQuery.mockResolvedValue([]);
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?status=invalid');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, data: [] });
    });

    it('handles database errors gracefully', async () => {
      mockRawQuery.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch drivers');
    });

    it('limits results when limit parameter provided', async () => {
      const mockLimitedDrivers = [
        { id: 'driver-1', employee_id: 'EMP001', vehicle_number: 'VEH001', is_active: true, is_on_duty: true },
      ];
      mockRawQuery.mockResolvedValue(mockLimitedDrivers);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.pagination.limit).toBe(1);
    });

    it('falls back to the default limit for an invalid limit parameter', async () => {
      mockRawQuery.mockResolvedValue([]);
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?limit=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/tracking/drivers', () => {
    it('creates a new driver successfully', async () => {
      const newDriver = {
        user_id: 'user-3',
        profile_id: 'profile-3',
        employee_id: 'EMP003',
        vehicle_number: 'V003',
        phone_number: '+1234567890',
      };
      const createdDriver = {
        id: 'driver-3',
        user_id: 'user-3',
        profile_id: 'profile-3',
        employee_id: 'EMP003',
        vehicle_number: 'V003',
        phone_number: '+1234567890',
        is_active: true,
        is_on_duty: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockRawQuery.mockResolvedValue([createdDriver]);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify(newDriver),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('driver-3');
      expect(data.data.employee_id).toBe('EMP003');
    });

    it('stores user_id in sync with profile_id when only profile_id is given', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'driver-9' }] });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ profile_id: 'profile-9' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const insertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('INSERT INTO drivers')
      );
      // user_id ($1) and profile_id ($2) must never diverge at creation.
      expect(insertCall?.[1]?.slice(0, 2)).toEqual(['profile-9', 'profile-9']);
    });

    it('stores profile_id in sync with user_id when only user_id is given', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'driver-9' }] });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'user-9' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const insertCall = mockQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('INSERT INTO drivers')
      );
      expect(insertCall?.[1]?.slice(0, 2)).toEqual(['user-9', 'user-9']);
    });

    it('returns 400 when no identifier is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ vehicle_number: 'V003', phone_number: '+1234567890' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('handles database insertion errors (unique violation → 409)', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint') as any;
      duplicateError.code = '23505';
      mockRawQuery.mockRejectedValue(duplicateError);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ employee_id: 'EMP003' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('accepts driver with only profile_id', async () => {
      const createdDriver = {
        id: 'driver-4',
        user_id: null,
        profile_id: 'profile-4',
        employee_id: null,
        vehicle_number: null,
        phone_number: null,
        is_active: true,
        is_on_duty: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockRawQuery.mockResolvedValue([createdDriver]);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ profile_id: 'profile-4' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.profile_id).toBe('profile-4');
    });

    it('accepts driver with only user_id', async () => {
      const createdDriver = {
        id: 'driver-5',
        user_id: 'user-5',
        profile_id: null,
        employee_id: null,
        vehicle_number: null,
        phone_number: null,
        is_active: true,
        is_on_duty: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockRawQuery.mockResolvedValue([createdDriver]);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'user-5' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user_id).toBe('user-5');
    });
  });

  describe('PUT /api/tracking/drivers', () => {
    it('updates driver information successfully', async () => {
      const driverId = 'driver-1';
      const updatedDriver = {
        id: driverId,
        employee_id: 'EMP001',
        is_active: true,
        is_on_duty: true,
        location_geojson: JSON.stringify({ type: 'Point', coordinates: [-74.006, 40.7128] }),
        last_location_update: new Date().toISOString(),
      };
      mockRawQuery.mockResolvedValue([updatedDriver]);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({
          driver_id: driverId,
          location: { latitude: 40.7128, longitude: -74.006 },
          is_on_duty: true,
        }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(driverId);
      expect(data.data.is_on_duty).toBe(true);
    });

    it('returns 400 for invalid update data', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({ location: { latitude: 40.7128, longitude: -74.006 } }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing driver_id');
    });

    it('returns 404 when driver not found', async () => {
      mockRawQuery.mockResolvedValue([]);
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({ driver_id: 'non-existent-driver', is_on_duty: false }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Driver not found');
    });

    it('handles database update errors', async () => {
      mockRawQuery.mockRejectedValue(new Error('Update failed'));
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({ driver_id: 'driver-1', is_on_duty: true }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to update driver');
    });

    it('updates only is_on_duty when location not provided', async () => {
      const driverId = 'driver-1';
      const updatedDriver = {
        id: driverId,
        employee_id: 'EMP001',
        is_active: true,
        is_on_duty: false,
        location_geojson: null,
        last_location_update: new Date().toISOString(),
      };
      mockRawQuery.mockResolvedValue([updatedDriver]);

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({ driver_id: driverId, is_on_duty: false }),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.is_on_duty).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: 'invalid-json',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to create driver');
    });

    it('handles missing request body for POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('handles database query errors gracefully', async () => {
      mockRawQuery.mockRejectedValue(new Error('Database connection error'));
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch drivers');
    });

    it('handles PUT request with empty body', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing driver_id');
    });
  });
});
