import { OrderConfirmationData, NextStep } from '../types/order-confirmation';

// Fetch order confirmation data by order number
export async function fetchOrderConfirmationData(orderNumber: string): Promise<OrderConfirmationData | null> {
  // Replace with actual API call
  try {
    const res = await fetch(`/api/orders/${orderNumber}/confirmation`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Next steps configuration
export const defaultNextSteps: NextStep[] = [
  {
    id: 'review-details',
    title: 'Review Order Details',
    description: 'Verify all information is correct.',
    priority: 'HIGH',
    completed: false,
  },
  {
    id: 'prepare-delivery',
    title: 'Prepare for Delivery',
    description: 'Organize logistics and timeline.',
    priority: 'HIGH',
    completed: false,
  },
  {
    id: 'confirm-availability',
    title: 'Confirm Availability',
    description: 'Ensure capacity for the event date.',
    priority: 'MEDIUM',
    completed: false,
  },
  {
    id: 'contact-customer',
    title: 'Contact Customer',
    description: 'Reach out within 24 hours if needed.',
    priority: 'MEDIUM',
    completed: false,
  },
  {
    id: 'update-status',
    title: 'Update Order Status',
    description: 'Mark as confirmed once ready.',
    priority: 'LOW',
    completed: false,
  },
];

// Status mapping utility
export function mapOrderStatusToLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending Confirmation';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'DELIVERED':
      return 'Delivered';
    default:
      return 'Unknown Status';
  }
} 