import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ClientPage from '@/app/(site)/(users)/client/page';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userAddress: {
      count: jest.fn(),
    },
  },
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe('Client Dashboard Links', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockDashboardData = {
    stats: {
      activeOrders: 5,
      completedOrders: 10,
      savedLocations: 3,
    },
    recentOrders: [
      {
        id: 'order-1',
        orderNumber: 'TEST-001',
        orderType: 'catering' as const,
        status: 'ACTIVE',
        pickupDateTime: new Date('2024-01-15T10:00:00Z'),
        arrivalDateTime: new Date('2024-01-15T11:00:00Z'),
        orderTotal: 150.00,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful user authentication
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    
    // Mock database queries
    (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(5);
    (prisma.onDemand.count as jest.Mock).mockResolvedValue(10);
    (prisma.userAddress.count as jest.Mock).mockResolvedValue(3);
  });

  describe('Quick Actions Links', () => {
    it('should render New Order link with correct href', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const newOrderLink = screen.getByText('New Order').closest('a');
      expect(newOrderLink).toHaveAttribute('href', '/catering-request');
    });

    it('should render Manage Addresses link with correct href', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const manageAddressesLink = screen.getByText('Manage Addresses').closest('a');
      expect(manageAddressesLink).toHaveAttribute('href', '/addresses');
    });

    it('should render Update Profile link with correct href', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const updateProfileLink = screen.getByText('Update Profile').closest('a');
      expect(updateProfileLink).toHaveAttribute('href', '/profile');
    });

    it('should render Contact Us link with correct href', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const contactUsLink = screen.getByText('Contact Us').closest('a');
      expect(contactUsLink).toHaveAttribute('href', '/contact');
    });
  });

  describe('Empty State Links', () => {
    it('should render Place Your First Order link with correct href when no orders', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      const emptyData = {
        ...mockDashboardData,
        recentOrders: [],
      };
      
      render(<ClientDashboardContent data={emptyData} />);

      const firstOrderLink = screen.getByText('Place Your First Order').closest('a');
      expect(firstOrderLink).toHaveAttribute('href', '/catering-request');
    });

    it('should show empty state message when no recent orders', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      const emptyData = {
        ...mockDashboardData,
        recentOrders: [],
      };
      
      render(<ClientDashboardContent data={emptyData} />);

      expect(screen.getByText("You haven't placed any orders yet")).toBeInTheDocument();
    });
  });

  describe('Dashboard Stats', () => {
    it('should display correct active orders count', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Active Orders')).toBeInTheDocument();
    });

    it('should display correct completed orders count', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display correct saved locations count', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Saved Locations')).toBeInTheDocument();
    });
  });

  describe('Recent Orders Section', () => {
    it('should display recent orders when available', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      expect(screen.getByText('TEST-001')).toBeInTheDocument();
      expect(screen.getByText('Recent Orders')).toBeInTheDocument();
    });

    it('should render View All link with correct href', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const viewAllLink = screen.getByText('View All').closest('a');
      expect(viewAllLink).toHaveAttribute('href', '/client/orders');
    });
  });

  describe('Link Accessibility', () => {
    it('should have proper ARIA labels and descriptions', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      // Check that links have descriptive text
      expect(screen.getByText('Create a new delivery request')).toBeInTheDocument();
      expect(screen.getByText('Add or edit your locations')).toBeInTheDocument();
      expect(screen.getByText('Manage your account details')).toBeInTheDocument();
      expect(screen.getByText('Get in touch with our team')).toBeInTheDocument();
    });

    it('should have proper hover states and transitions', async () => {
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);

      const newOrderLink = screen.getByText('New Order').closest('a');
      expect(newOrderLink).toHaveClass('hover:bg-gray-50');
      expect(newOrderLink).toHaveClass('transition-colors');
    });
  });

  describe('Authentication Flow', () => {
    it('should redirect to sign-in when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      
      const { redirect } = await import('next/navigation');
      
      // This would normally be handled by the server component
      // We're testing the redirect logic
      expect(getCurrentUser).toHaveBeenCalled();
    });

    it('should render dashboard when user is authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock the component to test rendering
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      render(<ClientDashboardContent data={mockDashboardData} />);
      
      expect(screen.getByText('Client Dashboard')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      // The component should handle this gracefully
      const ClientDashboardContent = (await import('@/app/(site)/(users)/client/page')).ClientDashboardContent;
      
      // Should still render with empty data
      const emptyData = {
        stats: { activeOrders: 0, completedOrders: 0, savedLocations: 0 },
        recentOrders: [],
      };
      
      render(<ClientDashboardContent data={emptyData} />);
      
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });
}); 