import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/tracking/drivers/route';
import { createClient } from '@/utils/supabase/server';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock the createClient function
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('/api/tracking/drivers', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabaseClient as any);
  });

  describe('GET /api/tracking/drivers', () => {
    it('returns all drivers when no query parameters', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
          currentLocation: { lat: 40.7128, lng: -74.0060 },
        },
        {
          id: 'driver-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          status: 'offline',
          currentLocation: null,
        },
      ];

      // Mock successful response
      (mockSupabaseClient.from as any)().select().order().limit().mockResolvedValue({
        data: mockDrivers,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
    });

    it('filters drivers by status when status parameter provided', async () => {
      const mockActiveDrivers = [
        {
          id: 'driver-1',
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
          currentLocation: { lat: 40.7128, lng: -74.0060 },
        },
      ];

      (mockSupabaseClient.from as any)().select().eq().order().limit().mockResolvedValue({
        data: mockActiveDrivers,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?status=active');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockActiveDrivers);
    });

    it('returns 400 for invalid status parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?status=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('handles database errors gracefully', async () => {
      (mockSupabaseClient.from as any)().select().order().limit().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('limits results when limit parameter provided', async () => {
      const mockLimitedDrivers = [
        {
          id: 'driver-1',
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
        },
      ];

      (mockSupabaseClient.from as any)().select().order().limit().mockResolvedValue({
        data: mockLimitedDrivers,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?limit=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
    });

    it('returns 400 for invalid limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/tracking/drivers?limit=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/tracking/drivers', () => {
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

  describe('PUT /api/tracking/drivers', () => {
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

  describe('DELETE /api/tracking/drivers', () => {
    it('deletes driver successfully', async () => {
      const driverId = 'driver-1';

      (mockSupabaseClient.from as any)().delete().eq().single().mockResolvedValue({
        data: { id: driverId, deleted: true },
        error: null,
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(200);
    });

    it('returns 404 when driver not found for deletion', async () => {
      const driverId = 'non-existent-driver';

      (mockSupabaseClient.from as any)().delete().eq().single().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });

    it('handles database deletion errors', async () => {
      const driverId = 'driver-1';

      (mockSupabaseClient.from as any)().delete().eq().single().mockResolvedValue({
        data: null,
        error: { message: 'Deletion failed' },
      });

      const request = new NextRequest(`http://localhost:3000/api/tracking/drivers/${driverId}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Authentication and Authorization', () => {
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
        { method: DELETE, url: 'http://localhost:3000/api/tracking/drivers/driver-1' },
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
        { method: DELETE, url: 'http://localhost:3000/api/tracking/drivers/driver-1' },
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

  describe('Error Handling', () => {
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
