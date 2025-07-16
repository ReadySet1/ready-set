export interface OrderSuccessData {
  orderNumber: string;
  orderType: 'CATERING' | 'ON_DEMAND';
  clientName: string;
  pickupDateTime: Date;
  arrivalDateTime: Date;
  pickupAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  deliveryAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  brokerage?: string;
  orderTotal?: number;
  headcount?: number;
  needHost: 'YES' | 'NO';
  hoursNeeded?: number;
  numberOfHosts?: number;
  nextSteps: NextStepAction[];
  createdAt: Date;
}

export interface NextStepAction {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  estimatedDuration?: string;
  actionType: 'VENDOR_ACTION' | 'SYSTEM_ACTION' | 'CLIENT_ACTION';
}

export interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: OrderSuccessData;
  onViewDetails: () => void;
  onCreateAnother: () => void;
  onGoToDashboard: () => void;
  /** Optional handler to trigger a confirmation PDF download */
  onDownloadConfirmation?: () => void;
  /** Optional handler to share order details via Web Share or clipboard */
  onShareOrder?: () => void;
}

export interface OrderSuccessPageProps {
  orderNumber: string;
  fromModal?: boolean;
}

// Action types for the success flow
export type SuccessAction = 
  | 'VIEW_DETAILS' 
  | 'CREATE_ANOTHER' 
  | 'GO_TO_DASHBOARD' 
  | 'DOWNLOAD_CONFIRMATION'
  | 'SHARE_ORDER'
  | 'CONTACT_SUPPORT';

export interface SuccessActionConfig {
  type: SuccessAction;
  label: string;
  description: string;
  variant: 'primary' | 'secondary' | 'outline';
  icon?: string;
}
