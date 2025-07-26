import { OrderSuccessData, NextStepAction } from '@/types/order-success';

export const generateDefaultNextSteps = (orderData: Partial<OrderSuccessData>): NextStepAction[] => {
  const now = new Date();
  const steps: NextStepAction[] = [];

  // Base steps for all catering orders - Client focused
  steps.push({
    id: 'order-confirmation',
    title: 'Order Confirmation',
    description: 'You will receive an email confirmation with your order',
    completed: false,
    estimatedDuration: '30 minutes',
    actionType: 'CLIENT_EXPECTATION',
    priority: 'HIGH'
  });

  steps.push({
    id: 'venue-coordination',
    title: 'Venue & Logistics Coordination',
    description: 'Our team will contact you to confirm delivery details and venue access',
    completed: false,
    estimatedDuration: '24 hours',
    actionType: 'CLIENT_EXPECTATION',
    priority: 'HIGH'
  });

  steps.push({
    id: 'final-preparations',
    title: 'Final Event Preparations',
    description: 'We will complete all food preparation and coordinate delivery logistics for your event',
    completed: false,
    estimatedDuration: '4 hours before event',
    actionType: 'CLIENT_EXPECTATION',
    priority: 'MEDIUM'
  });

  // Host-specific steps - Client focused
  if (orderData.needHost === 'YES') {
    steps.push({
      id: 'host-assignment',
      title: 'Event Host Assignment',
      description: `Professional event hosts (${orderData.numberOfHosts || 1} host${(orderData.numberOfHosts || 1) > 1 ? 's' : ''}) will be assigned and briefed for your ${orderData.hoursNeeded || 2}-hour event`,
      completed: false,
      estimatedDuration: '2 days before event',
      actionType: 'CLIENT_EXPECTATION',
      priority: 'MEDIUM'
    });

    steps.push({
      id: 'host-arrival',
      title: 'Event Host Arrival',
      description: 'Your assigned hosts will arrive on-site and begin event setup and service',
      completed: false,
      estimatedDuration: '15 minutes before event',
      actionType: 'CLIENT_EXPECTATION',
      priority: 'HIGH'
    });
  }

  // Service delivery step
  steps.push({
    id: 'service-delivery',
    title: 'Service Delivery',
    description: 'Your catering order will be delivered and set up according to your specifications',
    completed: false,
    estimatedDuration: 'Event day',
    actionType: 'CLIENT_EXPECTATION',
    priority: 'HIGH'
  });

  return steps;
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
