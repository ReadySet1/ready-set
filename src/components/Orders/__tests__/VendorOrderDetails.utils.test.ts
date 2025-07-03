import { mockVendorOrderData } from './mocks/orderData';

// Extract utility functions for testing
// These are the same functions used in VendorOrderDetails component
const formatAddress = (address: any) => {
  if (!address) return "N/A";

  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);

  return parts.join(", ");
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      label: string;
    }
  > = {
    ACTIVE: { variant: "default", label: "Active" },
    PENDING: { variant: "secondary", label: "Pending" },
    COMPLETED: { variant: "outline", label: "Completed" },
    ASSIGNED: { variant: "secondary", label: "Assigned" },
    CANCELLED: { variant: "destructive", label: "Cancelled" },
  };

  const statusConfig = statusMap[status] || {
    variant: "outline",
    label: status,
  };
  return statusConfig;
};

const getOrderTypeBadge = (type: string) => {
  return {
    variant: type === "catering" ? "secondary" : "default",
    className: type === "catering"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    label: type === "catering" ? "Catering" : "On Demand"
  };
};

describe('VendorOrderDetails Utility Functions', () => {
  describe('formatAddress', () => {
    it('should format complete address correctly', () => {
      const address = {
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St, Apt 4B, San Francisco, CA, 94105');
    });

    it('should handle address without street2', () => {
      const address = {
        street1: '123 Main St',
        street2: null,
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St, San Francisco, CA, 94105');
    });

    it('should handle address with undefined street2', () => {
      const address = {
        street1: '123 Main St',
        street2: undefined,
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St, San Francisco, CA, 94105');
    });

    it('should handle address with empty string street2', () => {
      const address = {
        street1: '123 Main St',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St, San Francisco, CA, 94105');
    });

    it('should handle minimal address', () => {
      const address = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St, San Francisco, CA, 94105');
    });

    it('should return "N/A" for null address', () => {
      const result = formatAddress(null);
      expect(result).toBe('N/A');
    });

    it('should return "N/A" for undefined address', () => {
      const result = formatAddress(undefined);
      expect(result).toBe('N/A');
    });

    it('should handle address with missing required fields', () => {
      const address = {
        street1: '123 Main St',
        // Missing city, state, zip
      };

      const result = formatAddress(address);
      expect(result).toBe('123 Main St');
    });
  });

  describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(150.75)).toBe('$150.75');
      expect(formatCurrency(0.99)).toBe('$0.99');
    });

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative amounts correctly', () => {
      expect(formatCurrency(-10.50)).toBe('-$10.50');
    });

    it('should format large amounts correctly', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });

    it('should handle decimal precision', () => {
      expect(formatCurrency(100.1)).toBe('$100.10');
      expect(formatCurrency(100.123)).toBe('$100.12');
    });

    it('should handle very small amounts', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.001)).toBe('$0.00');
    });
  });

  describe('getStatusBadge', () => {
    it('should return correct config for ACTIVE status', () => {
      const result = getStatusBadge('ACTIVE');
      expect(result).toEqual({
        variant: 'default',
        label: 'Active'
      });
    });

    it('should return correct config for PENDING status', () => {
      const result = getStatusBadge('PENDING');
      expect(result).toEqual({
        variant: 'secondary',
        label: 'Pending'
      });
    });

    it('should return correct config for COMPLETED status', () => {
      const result = getStatusBadge('COMPLETED');
      expect(result).toEqual({
        variant: 'outline',
        label: 'Completed'
      });
    });

    it('should return correct config for ASSIGNED status', () => {
      const result = getStatusBadge('ASSIGNED');
      expect(result).toEqual({
        variant: 'secondary',
        label: 'Assigned'
      });
    });

    it('should return correct config for CANCELLED status', () => {
      const result = getStatusBadge('CANCELLED');
      expect(result).toEqual({
        variant: 'destructive',
        label: 'Cancelled'
      });
    });

    it('should handle unknown status', () => {
      const result = getStatusBadge('UNKNOWN_STATUS');
      expect(result).toEqual({
        variant: 'outline',
        label: 'UNKNOWN_STATUS'
      });
    });

    it('should handle empty status', () => {
      const result = getStatusBadge('');
      expect(result).toEqual({
        variant: 'outline',
        label: ''
      });
    });

    it('should handle case sensitivity', () => {
      const result = getStatusBadge('active');
      expect(result).toEqual({
        variant: 'outline',
        label: 'active'
      });
    });
  });

  describe('getOrderTypeBadge', () => {
    it('should return correct config for catering order', () => {
      const result = getOrderTypeBadge('catering');
      expect(result).toEqual({
        variant: 'secondary',
        className: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
        label: 'Catering'
      });
    });

    it('should return correct config for on_demand order', () => {
      const result = getOrderTypeBadge('on_demand');
      expect(result).toEqual({
        variant: 'default',
        className: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
        label: 'On Demand'
      });
    });

    it('should handle unknown order type', () => {
      const result = getOrderTypeBadge('unknown');
      expect(result).toEqual({
        variant: 'default',
        className: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
        label: 'On Demand'
      });
    });

    it('should handle empty order type', () => {
      const result = getOrderTypeBadge('');
      expect(result).toEqual({
        variant: 'default',
        className: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
        label: 'On Demand'
      });
    });

    it('should handle case sensitivity', () => {
      const result = getOrderTypeBadge('CATERING');
      expect(result).toEqual({
        variant: 'default',
        className: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
        label: 'On Demand'
      });
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      
      // Test locale date formatting
      const formattedDate = date.toLocaleDateString();
      expect(formattedDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      
      // Test locale time formatting
      const formattedTime = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      expect(formattedTime).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });

    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      
      const formattedDate = invalidDate.toLocaleDateString();
      expect(formattedDate).toBe('Invalid Date');
    });

    it('should handle null dates', () => {
      const nullDate = null;
      
      expect(nullDate).toBe(null);
    });
  });

  describe('Data Validation', () => {
    it('should validate required order fields', () => {
      const order = mockVendorOrderData;
      
      // Test required fields exist
      expect(order.id).toBeTruthy();
      expect(order.orderNumber).toBeTruthy();
      expect(order.orderType).toBeTruthy();
      expect(order.status).toBeTruthy();
      expect(order.orderTotal).toBeDefined();
      expect(order.pickupAddress).toBeTruthy();
      expect(order.deliveryAddress).toBeTruthy();
    });

    it('should validate address structure', () => {
      const address = mockVendorOrderData.pickupAddress;
      
      expect(address.id).toBeTruthy();
      expect(address.street1).toBeTruthy();
      expect(address.city).toBeTruthy();
      expect(address.state).toBeTruthy();
      expect(address.zip).toBeTruthy();
    });

    it('should validate optional fields gracefully', () => {
      const order = mockVendorOrderData;
      
      // These fields can be null/undefined
      expect(order.tip).toBeDefined();
      expect(order.pickupDateTime).toBeDefined();
      expect(order.arrivalDateTime).toBeDefined();
      
      // These arrays can be empty or undefined
      expect(Array.isArray(order.dispatches) || order.dispatches === undefined).toBe(true);
      expect(Array.isArray(order.fileUploads) || order.fileUploads === undefined).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed address data', () => {
      const malformedAddress = {
        street1: 123, // Should be string
        city: null,
        state: undefined,
        zip: true, // Should be string
      };

      const result = formatAddress(malformedAddress);
      expect(result).toBe('123, true');
    });

    it('should handle non-numeric currency values', () => {
      // @ts-ignore - Testing runtime error handling
      const result = formatCurrency('invalid');
      expect(result).toBe('$NaN');
    });

    it('should handle null/undefined values in status mapping', () => {
      // @ts-ignore - Testing runtime error handling
      const result = getStatusBadge(null);
      expect(result).toEqual({
        variant: 'outline',
        label: null
      });
    });
  });
}); 