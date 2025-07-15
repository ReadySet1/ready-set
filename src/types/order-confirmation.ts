export interface OrderConfirmationData {
  orderNumber: string;
  orderType: 'CATERING' | 'ON_DEMAND';
  eventDetails: EventDetails;
  customerInfo: CustomerInfo;
  estimatedDelivery: Date;
  nextSteps: NextStep[];
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
}

// Extend or import these as needed for your project
export interface EventDetails {
  eventName: string;
  eventDate: Date;
  location: string;
  [key: string]: any;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  [key: string]: any;
} 