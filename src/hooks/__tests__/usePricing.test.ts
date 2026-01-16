import { renderHook, act } from '@testing-library/react';
import {
  useCreatePricingTier,
  useUpdatePricingTier,
  useDeletePricingTier,
} from '../usePricing';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock pricing data
const mockPricingTier = {
  id: 'tier-1',
  name: 'Standard',
  minHeadCount: 1,
  maxHeadCount: 50,
  baseRate: 10.00,
  perHeadRate: 2.50,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('usePricing mutation hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('useCreatePricingTier', () => {
    it('creates pricing tier successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockPricingTier }),
      });

      const { result } = renderHook(() => useCreatePricingTier());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      let createdTier;
      await act(async () => {
        createdTier = await result.current.createTier({
          name: 'Standard',
          minHeadCount: 1,
          maxHeadCount: 50,
          baseRate: 10.00,
          perHeadRate: 2.50,
        });
      });

      expect(createdTier).toEqual(mockPricingTier);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/pricing/tiers', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid tier data' }),
      });

      const { result } = renderHook(() => useCreatePricingTier());

      await act(async () => {
        await expect(result.current.createTier({
          name: '',
          minHeadCount: 1,
          maxHeadCount: 50,
          baseRate: 10.00,
          perHeadRate: 2.50,
        })).rejects.toThrow('Invalid tier data');
      });

      expect(result.current.error?.message).toBe('Invalid tier data');
    });

    it('handles unsuccessful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Creation failed' }),
      });

      const { result } = renderHook(() => useCreatePricingTier());

      await act(async () => {
        await expect(result.current.createTier({
          name: 'Test',
          minHeadCount: 1,
          maxHeadCount: 50,
          baseRate: 10.00,
          perHeadRate: 2.50,
        })).rejects.toThrow('Creation failed');
      });
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCreatePricingTier());

      await act(async () => {
        await expect(result.current.createTier({
          name: 'Test',
          minHeadCount: 1,
          maxHeadCount: 50,
          baseRate: 10.00,
          perHeadRate: 2.50,
        })).rejects.toThrow('Network error');
      });

      expect(result.current.error?.message).toBe('Network error');
    });

    it('handles JSON parse error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const { result } = renderHook(() => useCreatePricingTier());

      await act(async () => {
        await expect(result.current.createTier({
          name: 'Test',
          minHeadCount: 1,
          maxHeadCount: 50,
          baseRate: 10.00,
          perHeadRate: 2.50,
        })).rejects.toThrow(); // Error will be thrown
      });
    });
  });

  describe('useUpdatePricingTier', () => {
    it('updates pricing tier successfully', async () => {
      const updatedTier = { ...mockPricingTier, name: 'Updated Standard' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedTier }),
      });

      const { result } = renderHook(() => useUpdatePricingTier());

      let resultTier;
      await act(async () => {
        resultTier = await result.current.updateTier({ id: 'tier-1', name: 'Updated Standard' });
      });

      expect(resultTier).toEqual(updatedTier);
      expect(mockFetch).toHaveBeenCalledWith('/api/pricing/tiers/tier-1', expect.objectContaining({
        method: 'PUT',
      }));
    });

    it('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Tier not found' }),
      });

      const { result } = renderHook(() => useUpdatePricingTier());

      await act(async () => {
        await expect(result.current.updateTier({ id: 'invalid', name: 'Test' }))
          .rejects.toThrow('Tier not found');
      });

      expect(result.current.error?.message).toBe('Tier not found');
    });

    it('handles unsuccessful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Update failed' }),
      });

      const { result } = renderHook(() => useUpdatePricingTier());

      await act(async () => {
        await expect(result.current.updateTier({ id: 'tier-1', name: 'Test' }))
          .rejects.toThrow('Update failed');
      });
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUpdatePricingTier());

      await act(async () => {
        await expect(result.current.updateTier({ id: 'tier-1', name: 'Test' }))
          .rejects.toThrow('Network error');
      });

      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('useDeletePricingTier', () => {
    it('deletes pricing tier successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { success: true } }),
      });

      const { result } = renderHook(() => useDeletePricingTier());

      await act(async () => {
        await result.current.deleteTier('tier-1');
      });

      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/pricing/tiers/tier-1', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Tier not found' }),
      });

      const { result } = renderHook(() => useDeletePricingTier());

      await act(async () => {
        await expect(result.current.deleteTier('invalid'))
          .rejects.toThrow('Tier not found');
      });

      expect(result.current.error?.message).toBe('Tier not found');
    });

    it('handles unsuccessful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Cannot delete tier' }),
      });

      const { result } = renderHook(() => useDeletePricingTier());

      await act(async () => {
        await expect(result.current.deleteTier('tier-1'))
          .rejects.toThrow('Cannot delete tier');
      });
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDeletePricingTier());

      await act(async () => {
        await expect(result.current.deleteTier('tier-1'))
          .rejects.toThrow('Network error');
      });

      expect(result.current.error?.message).toBe('Network error');
    });

    it('handles JSON parse error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const { result } = renderHook(() => useDeletePricingTier());

      await act(async () => {
        await expect(result.current.deleteTier('tier-1'))
          .rejects.toThrow(); // Error will be thrown
      });
    });
  });
});
