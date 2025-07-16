import { OrderSuccessData, NextStepAction } from '@/types/order-success';

export const generateDefaultNextSteps = (orderData: Partial<OrderSuccessData>): NextStepAction[] => {
  const now = new Date();
  const steps: NextStepAction[] = [];

  // Base steps for all catering orders
  steps.push({
    id: 'confirm-details',
    title: 'Confirm Order Details',
    description: 'Review all order details and contact client if any clarification is needed',
    dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
    priority: 'HIGH',
    completed: false,
    estimatedDuration: '15 minutes',
    actionType: 'VENDOR_ACTION'
  });

  steps.push({
    id: 'prepare-ingredients',
    title: 'Prepare Ingredients & Menu',
    description: 'Source ingredients and finalize menu preparation timeline',
    dueDate: orderData.pickupDateTime 
      ? new Date(orderData.pickupDateTime.getTime() - 24 * 60 * 60 * 1000) // 1 day before pickup
      : new Date(now.getTime() + 24 * 60 * 60 * 1000),
    priority: 'HIGH',
    completed: false,
    estimatedDuration: '2-4 hours',
    actionType: 'VENDOR_ACTION'
  });

  steps.push({
    id: 'coordinate-delivery',
    title: 'Coordinate Delivery Logistics',
    description: 'Confirm delivery address, parking availability, and contact delivery team',
    dueDate: orderData.arrivalDateTime
      ? new Date(orderData.arrivalDateTime.getTime() - 4 * 60 * 60 * 1000) // 4 hours before delivery
      : new Date(now.getTime() + 12 * 60 * 60 * 1000),
    priority: 'MEDIUM',
    completed: false,
    estimatedDuration: '30 minutes',
    actionType: 'VENDOR_ACTION'
  });

  // Host-specific steps
  if (orderData.needHost === 'YES') {
    steps.push({
      id: 'assign-hosts',
      title: 'Assign Event Hosts',
      description: `Assign ${orderData.numberOfHosts || 1} qualified host(s) for ${orderData.hoursNeeded || 2} hours`,
      dueDate: orderData.pickupDateTime
        ? new Date(orderData.pickupDateTime.getTime() - 48 * 60 * 60 * 1000) // 2 days before
        : new Date(now.getTime() + 48 * 60 * 60 * 1000),
      priority: 'HIGH',
      completed: false,
      estimatedDuration: '1 hour',
      actionType: 'VENDOR_ACTION'
    });

    steps.push({
      id: 'brief-hosts',
      title: 'Brief Event Hosts',
      description: 'Provide hosts with event details, client preferences, and service protocols',
      dueDate: orderData.arrivalDateTime
        ? new Date(orderData.arrivalDateTime.getTime() - 2 * 60 * 60 * 1000) // 2 hours before
        : new Date(now.getTime() + 6 * 60 * 60 * 1000),
      priority: 'MEDIUM',
      completed: false,
      estimatedDuration: '45 minutes',
      actionType: 'VENDOR_ACTION'
    });
  }

  // Brokerage-specific steps
  if (orderData.brokerage && orderData.brokerage !== 'Direct Delivery') {
    steps.push({
      id: 'update-brokerage',
      title: `Update ${orderData.brokerage} Platform`,
      description: `Confirm order status and delivery timeline on ${orderData.brokerage} platform`,
      dueDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      priority: 'MEDIUM',
      completed: false,
      estimatedDuration: '10 minutes',
      actionType: 'VENDOR_ACTION'
    });
  }

  // Client communication steps
  steps.push({
    id: 'client-confirmation',
    title: 'Send Client Confirmation',
    description: 'Email client with order confirmation and delivery details',
    dueDate: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
    priority: 'MEDIUM',
    completed: false,
    estimatedDuration: '10 minutes',
    actionType: 'SYSTEM_ACTION'
  });

  return steps.sort((a, b) => {
    // Sort by priority first, then by due date
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    return a.dueDate!.getTime() - b.dueDate!.getTime();
  });
};

export const transformOrderToSuccessData = (
  orderResult: any,
  formData: any
): OrderSuccessData => {
  const now = new Date();
  
  return {
    orderNumber: orderResult.orderNumber || formData.orderNumber,
    orderType: 'CATERING',
    clientName: formData.clientName || 'Unknown Client',
    pickupDateTime: new Date(formData.pickupDateTime),
    arrivalDateTime: new Date(formData.arrivalDateTime),
    pickupAddress: formData.pickupAddress,
    deliveryAddress: formData.deliveryAddress,
    brokerage: formData.brokerage,
    orderTotal: formData.orderTotal,
    headcount: formData.headcount,
    needHost: formData.needHost,
    hoursNeeded: formData.hoursNeeded,
    numberOfHosts: formData.numberOfHosts,
    nextSteps: generateDefaultNextSteps({
      needHost: formData.needHost,
      numberOfHosts: formData.numberOfHosts,
      hoursNeeded: formData.hoursNeeded,
      pickupDateTime: new Date(formData.pickupDateTime),
      arrivalDateTime: new Date(formData.arrivalDateTime),
      brokerage: formData.brokerage
    }),
    createdAt: now
  };
};

export const formatOrderSummary = (orderData: OrderSuccessData): string => {
  const pickup = orderData.pickupDateTime.toLocaleDateString();
  const delivery = orderData.arrivalDateTime.toLocaleDateString();
  
  return `Order ${orderData.orderNumber} for ${orderData.clientName} - Pickup: ${pickup}, Delivery: ${delivery}`;
};

export const getOrderProgressPercentage = (nextSteps: NextStepAction[]): number => {
  if (nextSteps.length === 0) return 100;
  
  const completedSteps = nextSteps.filter(step => step.completed).length;
  return Math.round((completedSteps / nextSteps.length) * 100);
};

export const getUrgentNextSteps = (nextSteps: NextStepAction[]): NextStepAction[] => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  return nextSteps.filter(step => 
    !step.completed && 
    step.dueDate && 
    step.dueDate <= oneHourFromNow
  );
};

export const validateOrderSuccess = (orderData: Partial<OrderSuccessData>): string[] => {
  const errors: string[] = [];
  
  if (!orderData.orderNumber) {
    errors.push('Order number is required');
  }
  
  if (!orderData.clientName) {
    errors.push('Client name is required');
  }
  
  if (!orderData.pickupDateTime) {
    errors.push('Pickup date and time is required');
  }
  
  if (!orderData.arrivalDateTime) {
    errors.push('Arrival date and time is required');
  }
  
  if (orderData.pickupDateTime && orderData.arrivalDateTime) {
    if (orderData.pickupDateTime >= orderData.arrivalDateTime) {
      errors.push('Pickup time must be before arrival time');
    }
  }
  
  return errors;
};
