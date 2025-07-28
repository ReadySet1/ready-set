import { render, screen } from '@testing-library/react';
import AddressesPage from '@/app/(site)/addresses/page';
import UserAddresses from '@/components/AddressManager/UserAddresses';
import Breadcrumb from '@/components/Common/Breadcrumb';

// Mock the Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  })),
}));

// Mock the API calls
global.fetch = jest.fn();

describe('Addresses Page Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Layout Expansion', () => {
    it('should render addresses page with expanded layout classes', () => {
      render(<AddressesPage />);
      
      // Check that the main container has the expanded layout classes
      const container = document.querySelector('.w-full.max-w-none');
      expect(container).toBeInTheDocument();
      
      // Check that padding is reduced
      const section = document.querySelector('.px-1.sm\\:px-2.lg\\:px-3');
      expect(section).toBeInTheDocument();
    });

    it('should render breadcrumb with expanded layout', () => {
      render(<Breadcrumb pageName="Addresses manager" />);
      
      // Check that breadcrumb has the expanded layout classes
      const breadcrumbContainer = document.querySelector('.w-full.max-w-none');
      expect(breadcrumbContainer).toBeInTheDocument();
      
      // Check that padding is reduced
      const breadcrumbSection = document.querySelector('.px-1.sm\\:px-2.lg\\:px-3');
      expect(breadcrumbSection).toBeInTheDocument();
    });

    it('should render UserAddresses component with optimized card padding', () => {
      render(<UserAddresses />);
      
      // Check that CardHeader has reduced padding
      const cardHeader = document.querySelector('.p-4.sm\\:p-6');
      expect(cardHeader).toBeInTheDocument();
      
      // Check that CardContent has reduced padding
      const cardContent = document.querySelector('.p-4.sm\\:p-6');
      expect(cardContent).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should maintain responsive padding across breakpoints', () => {
      render(<AddressesPage />);
      
      const container = document.querySelector('.px-1.sm\\:px-2.lg\\:px-3');
      expect(container).toHaveClass('px-1');
      expect(container).toHaveClass('sm:px-2');
      expect(container).toHaveClass('lg:px-3');
    });

    it('should have proper responsive card padding', () => {
      render(<UserAddresses />);
      
      const cardHeader = document.querySelector('.p-4.sm\\:p-6');
      expect(cardHeader).toHaveClass('p-4');
      expect(cardHeader).toHaveClass('sm:p-6');
    });
  });

  describe('Content Structure', () => {
    it('should display correct page title', () => {
      render(<AddressesPage />);
      
      expect(screen.getByText('Addresses manager')).toBeInTheDocument();
    });

    it('should render UserAddresses component', () => {
      render(<AddressesPage />);
      
      // Check for the main content area
      expect(screen.getByText('Your Addresses')).toBeInTheDocument();
    });
  });
}); 