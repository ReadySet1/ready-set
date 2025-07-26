import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ClientOrders from '@/components/User/UserOrdersTable';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn();

describe('UserOrdersTable Component', () => {
  const mockRouter = {
    push: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Pagination', () => {
    it('should display correct pagination information', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 15,
        currentPage: 1,
        totalPages: 3
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('1 of 3')).toBeInTheDocument();
      });
    });

    it('should handle pagination navigation', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 15,
        currentPage: 1,
        totalPages: 3
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      // Test Next button
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user-orders?page=2&limit=5');
      });
    });

    it('should disable Previous button on first page', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 15,
        currentPage: 1,
        totalPages: 3
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        const prevButton = screen.getByText('Previous');
        expect(prevButton).toBeDisabled();
      });
    });

    it('should disable Next button on last page', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 5,
        currentPage: 1,
        totalPages: 1
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).toBeDisabled();
      });
    });
  });

  describe('Order Display', () => {
    it('should display order numbers correctly', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('CAT-001')).toBeInTheDocument();
      });
    });

    it('should display delivery dates correctly', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('1/2/2025')).toBeInTheDocument();
      });
    });

    it('should make order numbers clickable', async () => {
      const mockResponse = {
        orders: [
          {
            id: '1',
            order_number: 'CAT-001',
            order_type: 'catering',
            status: 'ACTIVE',
            date: '2025-01-02T15:00:00.000Z',
            pickup_time: '2025-01-01T12:00:00.000Z',
            arrival_time: '2025-01-02T15:00:00.000Z',
            order_total: '100.00',
            client_attention: 'Test Order',
            address: {
              street1: '123 Test St',
              city: 'Test City',
              state: 'CA'
            },
            delivery_address: {
              street1: '456 Delivery St',
              city: 'Delivery City',
              state: 'CA'
            }
          }
        ],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        const orderLink = screen.getByText('CAT-001');
        expect(orderLink.closest('a')).toHaveAttribute('href', '/order-status/CAT-001');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Orders')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display error message when API returns error status', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Orders')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', async () => {
      // Mock a delayed response
      (fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ orders: [], totalCount: 0, currentPage: 1, totalPages: 1 })
          }), 100)
        )
      );

      render(<ClientOrders />);

      // Should show loading spinner initially
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no orders', async () => {
      const mockResponse = {
        orders: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 1
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('No orders found')).toBeInTheDocument();
        expect(screen.getByText("You don't have any orders at the moment. Check back soon or contact us if you need support.")).toBeInTheDocument();
      });
    });
  });
}); 