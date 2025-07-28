import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import ClientOrders from '@/components/User/UserOrdersTable';
import UserOrderDetail from '@/components/User/UserOrder';
import ClientDashboardContent from '@/components/Dashboard/ClientDashboardContent';

// Mock data
const mockOrders = [
  {
    id: '1',
    order_number: 'SF-12360',
    order_type: 'catering',
    status: 'active',
    date: '2025-07-30T12:00:00Z',
    order_total: '234.00',
    pickup_time: '2025-07-30T12:00:00Z',
    arrival_time: '2025-07-30T12:45:00Z',
    address: {
      street1: '25 Winter St',
      city: 'South San Francisco',
      state: 'CA',
      zip: '94080'
    },
    delivery_address: {
      street1: '89 Spencer st',
      city: 'Burlingame',
      state: 'CA',
      zip: '94010'
    },
    special_notes: 'Handle with care',
    headcount: 40
  },
  {
    id: '2',
    order_number: 'SF-12361',
    order_type: 'on_demand',
    status: 'active',
    date: '2025-08-02T10:25:00Z',
    order_total: '230.00',
    pickup_time: '2025-08-02T10:25:00Z',
    arrival_time: '2025-08-02T11:00:00Z',
    address: {
      street1: '89 Spencer st',
      city: 'Burlingame',
      state: 'CA',
      zip: '94010'
    },
    delivery_address: {
      street1: '876 Laurel Street',
      city: 'San Carlos',
      state: 'CA',
      zip: '94070'
    },
    special_notes: null
  }
];

const mockOrderDetail = {
  id: '1',
  order_number: 'SF-12360',
  order_type: 'catering',
  status: 'active',
  date: '2025-07-30T12:00:00Z',
  order_total: '234.00',
  pickup_time: '2025-07-30T12:00:00Z',
  arrival_time: '2025-07-30T12:45:00Z',
  address: {
    street1: '25 Winter St',
    city: 'South San Francisco',
    state: 'CA',
    zip: '94080'
  },
  delivery_address: {
    street1: '89 Spencer st',
    city: 'Burlingame',
    state: 'CA',
    zip: '94010'
  },
  special_notes: 'Handle with care',
  headcount: 40,
  user_id: 'user123',
  driver_status: null,
  dispatch: [],
  complete_time: null,
  updated_at: '2025-07-30T12:00:00Z'
};

// Setup MSW server
const server = setupServer(
  // Mock the user orders list API
  rest.get('/api/user-orders', (req, res, ctx) => {
    const page = req.url.searchParams.get('page') || '1';
    const limit = req.url.searchParams.get('limit') || '5';
    
    return res(
      ctx.json({
        orders: mockOrders.slice(0, parseInt(limit)),
        totalCount: mockOrders.length,
        totalPages: Math.ceil(mockOrders.length / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      })
    );
  }),

  // Mock the individual order detail API
  rest.get('/api/user-orders/:orderNumber', (req, res, ctx) => {
    const { orderNumber } = req.params;
    
    if (orderNumber === 'SF-12360') {
      return res(ctx.json(mockOrderDetail));
    }
    
    return res(
      ctx.status(404),
      ctx.json({ message: 'Order not found' })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/order-status/SF-12360',
}));

describe('Order Status Integration Tests', () => {
  describe('UserOrdersTable Component', () => {
    test('renders orders table with pagination', async () => {
      render(<ClientOrders />);

      // Wait for orders to load
      await waitFor(() => {
        expect(screen.getByText('Your Orders')).toBeInTheDocument();
      });

      // Check if orders are displayed
      expect(screen.getByText('SF-12360')).toBeInTheDocument();
      expect(screen.getByText('SF-12361')).toBeInTheDocument();

      // Check pagination information
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
      expect(screen.getByText(/2 total orders/)).toBeInTheDocument();

      // Check navigation buttons
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    test('displays correct order information', async () => {
      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('SF-12360')).toBeInTheDocument();
      });

      // Check order details
      expect(screen.getByText('catering')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('$234.00')).toBeInTheDocument();
    });

    test('handles pagination correctly', async () => {
      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      // Previous button should be disabled on first page
      const prevButton = screen.getByText('Previous');
      expect(prevButton).toBeDisabled();

      // Next button should be enabled if there are more pages
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeEnabled();
    });

    test('displays 5 orders per page', async () => {
      // Create more mock orders to test pagination
      const manyOrders = Array.from({ length: 7 }, (_, i) => ({
        ...mockOrders[0],
        id: `${i + 1}`,
        order_number: `SF-${12360 + i}`
      }));

      server.use(
        rest.get('/api/user-orders', (req, res, ctx) => {
          return res(
            ctx.json({
              orders: manyOrders.slice(0, 5),
              totalCount: manyOrders.length,
              totalPages: 2,
              currentPage: 1,
              limit: 5
            })
          );
        })
      );

      render(<ClientOrders />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
        expect(screen.getByText(/7 total orders/)).toBeInTheDocument();
      });
    });
  });

  describe('UserOrderDetail Component', () => {
    test('renders order details correctly', async () => {
      render(<UserOrderDetail orderNumber="SF-12360" />);

      // Wait for order to load
      await waitFor(() => {
        expect(screen.getByText('Order Details')).toBeInTheDocument();
      });

      // Check order information
      expect(screen.getByText('Order #SF-12360')).toBeInTheDocument();
      expect(screen.getByText('Catering')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('$234.00')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument(); // headcount
    });

    test('displays address information', async () => {
      render(<UserOrderDetail orderNumber="SF-12360" />);

      await waitFor(() => {
        expect(screen.getByText('Pickup Location')).toBeInTheDocument();
      });

      // Check pickup address
      expect(screen.getByText(/25 Winter St/)).toBeInTheDocument();
      expect(screen.getByText(/South San Francisco/)).toBeInTheDocument();

      // Check delivery address
      expect(screen.getByText(/89 Spencer st/)).toBeInTheDocument();
      expect(screen.getByText(/Burlingame/)).toBeInTheDocument();
    });

    test('displays special notes', async () => {
      render(<UserOrderDetail orderNumber="SF-12360" />);

      await waitFor(() => {
        expect(screen.getByText('Special Notes')).toBeInTheDocument();
      });

      expect(screen.getByText('Handle with care')).toBeInTheDocument();
    });

    test('shows back to orders button', async () => {
      render(<UserOrderDetail orderNumber="SF-12360" />);

      await waitFor(() => {
        expect(screen.getByText('Back to Orders')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Back to Orders');
      expect(backButton).toBeInTheDocument();
    });

    test('handles order not found', async () => {
      server.use(
        rest.get('/api/user-orders/:orderNumber', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({ message: 'Order not found' })
          );
        })
      );

      render(<UserOrderDetail orderNumber="INVALID-ORDER" />);

      await waitFor(() => {
        expect(screen.getByText('Order not found')).toBeInTheDocument();
      });
    });

    test('handles API errors gracefully', async () => {
      server.use(
        rest.get('/api/user-orders/:orderNumber', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      render(<UserOrderDetail orderNumber="SF-12360" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch order/)).toBeInTheDocument();
      });
    });
  });

  describe('ClientDashboardContent Component', () => {
    const mockDashboardData = {
      recentOrders: mockOrders,
      stats: {
        activeOrders: 11,
        completedOrders: 0,
        savedLocations: 4
      }
    };

    test('renders dashboard with order cards', () => {
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('Recent Orders')).toBeInTheDocument();
      expect(screen.getByText('SF-12360')).toBeInTheDocument();
      expect(screen.getByText('SF-12361')).toBeInTheDocument();
    });

    test('displays correct order information in cards', () => {
      render(<ClientDashboardContent data={mockDashboardData} />);

      // Check order details in cards
      expect(screen.getByText('$234.00')).toBeInTheDocument();
      expect(screen.getByText('$230.00')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    test('View Details links point to correct order status page', () => {
      render(<ClientDashboardContent data={mockDashboardData} />);

      const viewDetailsLinks = screen.getAllByText('View Details');
      
      viewDetailsLinks.forEach((link) => {
        expect(link.closest('a')).toHaveAttribute('href', expect.stringMatching(/^\/order-status\/SF-/));
      });
    });

    test('displays dashboard stats correctly', () => {
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('11')).toBeInTheDocument(); // Active Orders
      expect(screen.getByText('0')).toBeInTheDocument(); // Completed
      expect(screen.getByText('4')).toBeInTheDocument(); // Saved Locations
    });

    test('View All link points to order status page', () => {
      render(<ClientDashboardContent data={mockDashboardData} />);

      const viewAllLink = screen.getByText('View All');
      expect(viewAllLink.closest('a')).toHaveAttribute('href', '/order-status');
    });
  });

  describe('API Integration', () => {
    test('user orders API returns correct pagination data', async () => {
      const response = await fetch('/api/user-orders?page=1&limit=5');
      const data = await response.json();

      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('totalCount');
      expect(data).toHaveProperty('totalPages');
      expect(data).toHaveProperty('currentPage');
      expect(data).toHaveProperty('limit');
      expect(Array.isArray(data.orders)).toBe(true);
    });

    test('individual order API returns correct order data', async () => {
      const response = await fetch('/api/user-orders/SF-12360');
      const data = await response.json();

      expect(data).toHaveProperty('order_number', 'SF-12360');
      expect(data).toHaveProperty('order_type');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('order_total');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('delivery_address');
    });
  });
}); 