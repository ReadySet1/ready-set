import { UserType } from '@/types/user';

/**
 * Utility function to determine the correct dashboard route based on user role
 * @param userRole - The user's role from the UserType enum
 * @returns The appropriate dashboard route for the user
 */
export function getDashboardRouteByRole(userRole: UserType | null): string {
  if (!userRole) {
    // Default fallback for unauthenticated users
    return '/';
  }

  switch (userRole) {
    case UserType.CLIENT:
      return '/client';
    case UserType.VENDOR:
      return '/client';
    case UserType.DRIVER:
      return '/driver';
    case UserType.ADMIN:
    case UserType.SUPER_ADMIN:
      return '/admin';
    case UserType.HELPDESK:
      return '/helpdesk';
    default:
      // Fallback for unknown roles
      return '/';
  }
}

/**
 * Utility function to determine if a user should be redirected to client dashboard
 * after creating an order (typically clients should go to client dashboard)
 * @param userRole - The user's role from the UserType enum
 * @returns True if user should be redirected to client dashboard
 */
export function shouldRedirectToClientDashboard(userRole: UserType | null): boolean {
  return userRole === UserType.CLIENT;
}

/**
 * Utility function to get the appropriate redirect route after order creation
 * @param userRole - The user's role from the UserType enum
 * @returns The redirect route after successful order creation
 */
export function getOrderCreationRedirectRoute(userRole: UserType | null): string {
  // Clients should be redirected to their dashboard to see their orders
  if (shouldRedirectToClientDashboard(userRole)) {
    return '/client';
  }
  
  // Other user types (vendors, admins, etc.) should go to their respective dashboards
  return getDashboardRouteByRole(userRole);
}
