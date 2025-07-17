import { renderHook, act } from '@testing-library/react';
import { useSmartRedirect } from '@/hooks/useSmartRedirect';
import { UserType } from '@/types/user';

// Mock router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useUser hook
const mockUseUser = jest.fn();
jest.mock('@/contexts/UserContext', () => ({
  useUser: mockUseUser,
}));

// Mock getDashboardRouteByRole
const mockGetDashboardRouteByRole = jest.fn();
jest.mock('@/utils/navigation', () => ({
  getDashboardRouteByRole: mockGetDashboardRouteByRole,
}));

describe('useSmartRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role-Based Navigation', () => {
    it('should redirect VENDOR to vendor dashboard', () => {
      mockUseUser.mockReturnValue({
        userRole: UserType.VENDOR,
      });

      mockGetDashboardRouteByRole.mockReturnValue({
        path: '/vendor',
      });

      const { result } = renderHook(() => useSmartRedirect());

      act(() => {
        result.current.redirectToDashboard();
      });

      expect(mockGetDashboardRouteByRole).toHaveBeenCalledWith(UserType.VENDOR);
      expect(mockPush).toHaveBeenCalledWith('/vendor');
    });

    it('should redirect CLIENT to client dashboard', () => {
      mockUseUser.mockReturnValue({
        userRole: UserType.CLIENT,
      });

      mockGetDashboardRouteByRole.mockReturnValue({
        path: '/client',
      });

      const { result } = renderHook(() => useSmartRedirect());

      act(() => {
        result.current.redirectToDashboard();
      });

      expect(mockGetDashboardRouteByRole).toHaveBeenCalledWith(UserType.CLIENT);
      expect(mockPush).toHaveBeenCalledWith('/client');
    });

    it('should redirect to home when no user role', () => {
      mockUseUser.mockReturnValue({
        userRole: null,
      });

      const { result } = renderHook(() => useSmartRedirect());

      act(() => {
        result.current.redirectToDashboard();
      });

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Order Success Navigation', () => {
    it('should redirect CLIENT to client order page', () => {
      mockUseUser.mockReturnValue({
        userRole: UserType.CLIENT,
      });

      const { result } = renderHook(() => useSmartRedirect());

      act(() => {
        result.current.redirectToOrderSuccess('CR-12345');
      });

      expect(mockPush).toHaveBeenCalledWith('/client/orders/CR-12345');
    });

    it('should fallback to generic success page when no user role', () => {
      mockUseUser.mockReturnValue({
        userRole: null,
      });

      const { result } = renderHook(() => useSmartRedirect());

      act(() => {
        result.current.redirectToOrderSuccess('CR-12345');
      });

      expect(mockPush).toHaveBeenCalledWith('/catering-request/success/CR-12345');
    });
  });

  describe('User Role Access', () => {
    it('should return current user role', () => {
      mockUseUser.mockReturnValue({
        userRole: UserType.CLIENT,
      });

      const { result } = renderHook(() => useSmartRedirect());

      expect(result.current.userRole).toBe(UserType.CLIENT);
    });
  });
}); 