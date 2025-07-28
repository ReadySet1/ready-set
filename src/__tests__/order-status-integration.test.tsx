import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import ClientOrders from '@/components/User/UserOrdersTable';
import UserOrderDetail from '@/components/User/UserOrder';
import { ClientDashboardContent } from '@/components/Dashboard/ClientDashboardContent';
import { CombinedOrder } from '@/types/models';

// Mock data
const mockOrders = [
  {
    id: '1',
    orderNumber: 'SF-12360',
    orderType: 'catering' as const,
    status: 'active',
    pickupDateTime: new Date('2025-07-30T12:00:00Z'),
    arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
    orderTotal: 234.00,
    pickupNotes: null,
    specialNotes: 'Handle with care',
    clientAttention: null,
    userId: 'user123',
    pickupAddressId: 'addr1',
    deliveryAddressId: 'addr2',
    brokerage: 'Test Brokerage',
    headcount: 40,
    needHost: 'yes',
    hoursNeeded: 4,
    numberOfHosts: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    orderNumber: 'SF-12361',
    orderType: 'on_demand' as const,
    status: 'active',
    pickupDateTime: new Date('2025-08-02T10:25:00Z'),
    arrivalDateTime: new Date('2025-08-02T11:00:00Z'),
    orderTotal: 230.00,
    pickupNotes: null,
    specialNotes: null,
    clientAttention: null,
    userId: 'user123',
    pickupAddressId: 'addr3',
    deliveryAddressId: 'addr4',
    itemDelivered: 'Package',
    vehicleType: 'Van',
    length: 10,
    width: 5,
    height: 3,
    weight: 50,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockOrderDetail = {
  id: '1',
  orderNumber: 'SF-12360',
  orderType: 'catering' as const,
  status: 'active',
  pickupDateTime: new Date('2025-07-30T12:00:00Z'),
  arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
  orderTotal: 234.00,
  pickupNotes: null,
  specialNotes: 'Handle with care',
  clientAttention: null,
  userId: 'user123',
  pickupAddressId: 'addr1',
  deliveryAddressId: 'addr2',
  brokerage: 'Test Brokerage',
  headcount: 40,
  needHost: 'yes',
  hoursNeeded: 4,
  numberOfHosts: 2,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Setup MSW server
const server = setupServer(
  // Mock the user orders list API
  http.get('/api/user-orders', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '5';
    
    return HttpResponse.json({
      orders: mockOrders.slice(0, parseInt(limit)),
      totalCount: mockOrders.length,
      totalPages: Math.ceil(mockOrders.length / parseInt(limit)),
      currentPage: parseInt(page),
      limit: parseInt(limit)
    });
  }),

  // Mock the individual order detail API
  http.get('/api/user-orders/:orderNumber', ({ params }) => {
    const { orderNumber } = params;
    
    if (orderNumber === 'SF-12360') {
      return HttpResponse.json(mockOrderDetail);
    }
    
    return HttpResponse.json(
      { message: 'Order not found' },
      { status: 404 }
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
        orderNumber: `SF-${12360 + i}`
      }));

      server.use(
        http.get('/api/user-orders', () => {
          return HttpResponse.json({
            orders: manyOrders.slice(0, 5),
            totalCount: manyOrders.length,
            totalPages: 2,
            currentPage: 1,
            limit: 5
          });
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
        http.get('/api/user-orders/:orderNumber', () => {
          return HttpResponse.json(
            { message: 'Order not found' },
            { status: 404 }
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
        http.get('/api/user-orders/:orderNumber', () => {
          return HttpResponse.json({}, { status: 500 });
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
      recentOrders: mockOrders as CombinedOrder[],
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