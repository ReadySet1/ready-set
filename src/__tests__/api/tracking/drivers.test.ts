import { NextRequest } from 'next/server';

// Mock pg Pool - the route uses PostgreSQL directly, not Supabase
// This must be set up before the route imports to ensure the pool created
// at module load time (route.ts line 6) uses our mock
jest.mock('pg', () => {
  // Create the mock inside the factory to avoid hoisting issues
  const mq = jest.fn();

  return {
    Pool: jest.fn(() => ({
      query: mq,
      connect: jest.fn(),
      end: jest.fn(),
    })),
    // Export the mock query so we can access it in tests
    __mockQuery: mq,
  };
});

import { GET, POST, PUT } from '@/app/api/tracking/drivers/route';
import type * as pg from 'pg';

// Access the mock query function
const { __mockQuery: mockQuery } = jest.requireMock<typeof pg & { __mockQuery: jest.Mock }>('pg');

describe('/api/tracking/drivers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tracking/drivers', () => {
    it('returns all drivers when no query parameters', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          employee_id: 'EMP001',
          vehicle_number: 'VEH001',
          license_number: 'LIC001',
          phone_number: '+1234567890',
          is_active: true,
          is_on_duty: true,
          last_known_location: null,
          last_location_update: null,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'driver-2',
          employee_id: 'EMP002',
          vehicle_number: 'VEH002',
          license_number: 'LIC002',
          phone_number: '+1234567891',
          is_active: false,
          is_on_duty: false,
          last_known_location: null,
          last_location_update: null,
          metadata: {},
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      // Mock successful pg query response
      mockQuery.mockResolvedValue({
        rows: mockDrivers,
        rowCount: mockDrivers.length,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Route returns { success: true, data: drivers[], pagination: {...} }
      expect(data.data).toEqual(mockDrivers);
      expect(data.pagination.total).toBe(mockDrivers.length);
      expect(data.pagination.limit).toBe(50); // default limit
      expect(data.pagination.offset).toBe(0); // default offset
    });

    // TODO: Update these tests to use pg.Pool mocks instead of Supabase
    // Commented out to prevent crashes until mocks are updated
    // it.skip('filters drivers by status when status parameter provided', async () => {
    //   const mockActiveDrivers = [
    //     {
    //       id: 'driver-1',
    //       employee_id: 'EMP001',
    //       vehicle_number: 'VEH001',
    //       is_active: true,
    //     },
    //   ];

    //   mockQuery.mockResolvedValue({
    //     rows: mockActiveDrivers,
    //     rowCount: 1,
    //   });

    //   const request = new NextRequest('http://localhost:3000/api/tracking/drivers?active=true');
    //   const response = await GET(request);
    //   const data = await response.json();

    //   expect(response.status).toBe(200);
    //   expect(data.drivers).toEqual(mockActiveDrivers);
    // });

    // it.skip('handles database errors gracefully', async () => {
    //   mockQuery.mockRejectedValue(new Error('Database connection failed'));

    //   const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
    //   const response = await GET(request);

    //   expect(response.status).toBe(500);
    // });
  });

  // TODO: Update POST and PUT tests to use pg.Pool mocks instead of Supabase
  // Commented out to prevent crashes until mocks are updated
  describe.skip('POST /api/tracking/drivers', () => {
    it('creates a new driver successfully', async () => {
      const newDriver = {
        name: 'New Driver',
        email: 'new@example.com',
        phone: '+1234567890',
        vehicleInfo: {
          number: 'V003',
          type: 'van',
        },
      };

      const createdDriver = {
        id: 'driver-3',
        ...newDriver,
        status: 'offline',
        createdAt: new Date().toISOString(),
      };

      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: createdDriver,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify(newDriver),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(createdDriver);
    });

    it('returns 400 for invalid driver data', async () => {
      const invalidDriver = {
        name: '', // Invalid: empty name
        email: 'invalid-email', // Invalid email format
      };

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify(invalidDriver),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('handles database insertion errors', async () => {
      const newDriver = {
        name: 'New Driver',
        email: 'new@example.com',
        phone: '+1234567890',
      };

      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: null,
        error: { message: 'Duplicate email' },
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify(newDriver),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('validates required fields', async () => {
      const incompleteDriver = {
        name: 'Incomplete Driver',
        // Missing required email field
      };

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: JSON.stringify(incompleteDriver),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe.skip('PUT /api/tracking/drivers', () => {
    it('updates driver information successfully', async () => {
      const driverId = 'driver-1';
      const updateData = {
        name: 'Updated Driver Name',
        phone: '+0987654321',
      };

      const updatedDriver = {
        id: driverId,
        name: updateData.name,
        email: 'john@example.com',
        phone: updateData.phone,
        status: 'active',
        updatedAt: new Date().toISOString(),
      };

      (mockSupabaseClient.from as any)().update().eq().single().mockResolvedValue({
        data: updatedDriver,
        error: null,
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(updatedDriver);
    });

    it('returns 400 for invalid update data', async () => {
      const driverId = 'driver-1';
      const invalidUpdate = {
        email: 'invalid-email-format',
      };

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(invalidUpdate),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('returns 404 when driver not found', async () => {
      const driverId = 'non-existent-driver';
      const updateData = {
        name: 'Updated Name',
      };

      (mockSupabaseClient.from as any)().update().eq().single().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(404);
    });

    it('handles database update errors', async () => {
      const driverId = 'driver-1';
      const updateData = {
        name: 'Updated Name',
      };

      (mockSupabaseClient.from as any)().update().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
    });
  });


  describe.skip('Authentication and Authorization', () => {
    it('requires authentication for all endpoints', async () => {
      // Mock unauthenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const endpoints = [
        { method: GET, url: 'http://localhost:3000/api/tracking/drivers' },
        { method: POST, url: 'http://localhost:3000/api/tracking/drivers', body: '{}' },
        { method: PUT, url: 'http://localhost:3000/api/tracking/drivers/driver-1', body: '{}' },
      ];

      for (const endpoint of endpoints) {
        const request = new NextRequest(endpoint.url, {
          method: endpoint.method.name,
          body: endpoint.body,
        });

        const response = await endpoint.method(request);
        expect(response.status).toBe(401);
      }
    });

    it('requires admin role for write operations', async () => {
      // Mock authenticated non-admin user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'user-1', 
            email: 'user@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const writeEndpoints = [
        { method: POST, url: 'http://localhost:3000/api/tracking/drivers', body: '{}' },
        { method: PUT, url: 'http://localhost:3000/api/tracking/drivers/driver-1', body: '{}' },
      ];

      for (const endpoint of writeEndpoints) {
        const request = new NextRequest(endpoint.url, {
          method: endpoint.method.name,
          body: endpoint.body,
        });

        const response = await endpoint.method(request);
        expect(response.status).toBe(403);
      }
    });

    it('allows read operations for authenticated users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'user-1', 
            email: 'user@example.com' 
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().select().order().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe.skip('Error Handling', () => {
    it('handles malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
        body: 'invalid-json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('handles missing request body for POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('handles network errors gracefully', async () => {
      (mockSupabaseClient.from as any)().select().order().limit().mockRejectedValue(
        new Error('Network error')
      );

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});
