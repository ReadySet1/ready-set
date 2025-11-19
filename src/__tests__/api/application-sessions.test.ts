// src/__tests__/api/application-sessions.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST, GET, PATCH } from '@/app/api/application-sessions/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  __esModule: true,
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

describe('Application Sessions API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mockSupabase with chainable methods
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    // Chain return values
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.gte.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);

    // Setup createClient mocks
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('POST /api/application-sessions - Create Session', () => {
    it('should create a new session with valid data', async () => {
      mockSupabase.gte.mockResolvedValue({ data: [], error: null });

      const mockSession = {
        id: 'session-123',
        session_token: 'token-abc-123',
        session_expires_at: new Date(Date.now() + 7200000).toISOString(),
      };
      
      mockSupabase.rpc.mockResolvedValue({ data: mockSession, error: null });

      const request = {
        json: async () => ({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '127.0.0.1';
            return null;
          }
        },
        url: 'http://localhost:3000/api/application-sessions'
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-123');
    });

    it('should enforce rate limiting (5 sessions per hour per IP)', async () => {
      const mockRecentSessions = new Array(5).fill({ id: 'some-id' });
      mockSupabase.gte.mockResolvedValue({ data: mockRecentSessions, error: null });

      const request = {
        json: async () => ({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '127.0.0.1';
            return null;
          }
        },
        url: 'http://localhost:3000/api/application-sessions'
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('should validate required fields', async () => {
      const request = {
        json: async () => ({
          email: 'test@example.com'
          // Missing fields
        }),
        headers: { get: () => null },
        url: 'http://localhost:3000/api/application-sessions'
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/application-sessions - Get Session Details', () => {
    it('should return session details with valid session ID and token', async () => {
      const mockSession = {
        id: 'session-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'Server',
        session_expires_at: new Date(Date.now() + 7200000).toISOString(),
        upload_count: 3,
        max_uploads: 10,
        verified: true,
        completed: false
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockSession, error: null });

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          headers: {
            'x-upload-token': 'token-abc-123',
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.id).toBe('session-123');
      expect(data.session.uploadCount).toBe(3);
    });
  });
});
