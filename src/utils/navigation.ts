import { UserType } from '@/types/user';

export interface DashboardRoute {
  path: string;
  name: string;
}

export const getDashboardRouteByRole = (userRole: UserType): DashboardRoute => {
  const routes: Record<UserType, DashboardRoute> = {
    [UserType.VENDOR]: { path: '/vendor', name: 'Vendor Dashboard' },
    [UserType.DRIVER]: { path: '/driver', name: 'Driver Dashboard' },
    [UserType.CLIENT]: { path: '/client', name: 'Client Dashboard' },
    [UserType.ADMIN]: { path: '/admin', name: 'Admin Dashboard' },
    [UserType.HELPDESK]: { path: '/helpdesk', name: 'Helpdesk Dashboard' },
    [UserType.SUPER_ADMIN]: { path: '/admin', name: 'Admin Dashboard' },
  };
  
  return routes[userRole] || routes[UserType.CLIENT];
};

export const getOrderDetailPath = (orderNumber: string, userRole: UserType): string => {
  const basePaths: Record<UserType, string> = {
    [UserType.VENDOR]: '/vendor/deliveries',
    [UserType.DRIVER]: '/driver/deliveries', 
    [UserType.CLIENT]: '/client/deliveries',
    [UserType.ADMIN]: '/admin/orders',
    [UserType.HELPDESK]: '/helpdesk/orders',
    [UserType.SUPER_ADMIN]: '/admin/orders',
  };
  
  const basePath = basePaths[userRole] || basePaths[UserType.CLIENT];
  return `${basePath}/${orderNumber}`;
}; 