import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { getDashboardRouteByRole } from '@/utils/navigation';
import { UserType } from '@/types/user';

export const useSmartRedirect = () => {
  const router = useRouter();
  const { userRole } = useUser();

  const redirectToDashboard = () => {
    if (!userRole) {
      // If no user role, redirect to home
      router.push('/');
      return;
    }

    try {
      const dashboardRoute = getDashboardRouteByRole(userRole);
      router.push(dashboardRoute.path);
    } catch (error) {
      console.error('Error determining dashboard route:', error);
      // Fallback to home if there's an error
      router.push('/');
    }
  };

  const redirectToOrderSuccess = (orderNumber: string) => {
    if (!userRole) {
      // If no user role, redirect to generic success page
      router.push(`/catering-request/success/${encodeURIComponent(orderNumber)}`);
      return;
    }

    // Role-based redirect for order success
    switch (userRole) {
      case UserType.VENDOR:
        router.push(`/vendor/order-success/${encodeURIComponent(orderNumber)}`);
        break;
      case UserType.CLIENT:
        router.push(`/client/orders/${encodeURIComponent(orderNumber)}`);
        break;
      case UserType.ADMIN:
      case UserType.SUPER_ADMIN:
      case UserType.HELPDESK:
        router.push(`/admin/catering-orders/${encodeURIComponent(orderNumber)}`);
        break;
      default:
        // Fallback to generic success page
        router.push(`/catering-request/success/${encodeURIComponent(orderNumber)}`);
        break;
    }
  };

  const getSuccessPageUrl = (orderNumber: string) => {
    if (!userRole) {
      return `/catering-request/success/${encodeURIComponent(orderNumber)}`;
    }

    switch (userRole) {
      case UserType.VENDOR:
        return `/vendor/order-success/${encodeURIComponent(orderNumber)}`;
      case UserType.CLIENT:
        return `/client/orders/${encodeURIComponent(orderNumber)}`;
      case UserType.ADMIN:
      case UserType.SUPER_ADMIN:
      case UserType.HELPDESK:
        return `/admin/catering-orders/${encodeURIComponent(orderNumber)}`;
      default:
        return `/catering-request/success/${encodeURIComponent(orderNumber)}`;
    }
  };

  return {
    redirectToDashboard,
    redirectToOrderSuccess,
    getSuccessPageUrl,
    userRole,
  };
}; 