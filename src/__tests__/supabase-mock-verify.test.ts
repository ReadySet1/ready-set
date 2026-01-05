// Quick test to verify Supabase mock behavior
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server');

describe('Supabase Mock Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should properly mock createClient with chain methods', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null,
        }),
      },
      from: jest.fn(),
    };

    // Configure the chain
    const selectChain = {
      single: jest.fn().mockResolvedValue({
        data: { id: 'test-user', type: 'ADMIN' },
        error: null,
      }),
    };
    const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
    const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
    mockSupabaseClient.from.mockReturnValue(fromChain);

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Test it
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toEqual({ id: 'test-user' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, type')
      .eq('id', user.id)
      .single();

    expect(profile).toEqual({ id: 'test-user', type: 'ADMIN' });
  });

  it('should work with the createMockSupabaseClient helper', async () => {
    // Import the helper
    const { createMockSupabaseClient, createMockSupabaseClientWithUser } = await import('@/__tests__/helpers/supabase-mock-helpers');

    const mockClient = createMockSupabaseClientWithUser('admin-123', 'admin@test.com', 'ADMIN');
    (createClient as jest.Mock).mockResolvedValue(mockClient);

    const supabase = await createClient();

    // Test auth
    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toEqual({ id: 'admin-123', email: 'admin@test.com' });

    // Test profile query
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', 'admin-123')
      .single();

    expect(profile).toEqual({ id: 'admin-123', type: 'ADMIN' });
  });
});
