// Mock data for VendorOrderDetails tests

export const mockVendorOrderData = {
  id: "order-1",
  orderNumber: "TEST-1234",
  orderType: "catering" as const,
  status: "ACTIVE",
  pickupDateTime: "2023-12-25T10:00:00Z",
  arrivalDateTime: "2023-12-25T11:00:00Z",
  completeDateTime: null,
  orderTotal: 150.00,
  tip: 15.00,
  brokerage: "Premium",
  clientAttention: "Contact Jane Doe",
  pickupNotes: "Use service entrance",
  specialNotes: "Please handle with care",
  headcount: 50,
  needHost: "Yes",
  hoursNeeded: 4,
  numberOfHosts: 2,
  vehicleType: null,
  itemDelivered: null,
  length: null,
  width: null,
  height: null,
  weight: null,
  image: null,
  driverStatus: "EN_ROUTE",
  pickupAddress: {
    id: "addr-1",
    name: "Restaurant ABC",
    street1: "123 Main St",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    locationNumber: "Suite 100",
    parkingLoading: "Loading dock",
    longitude: -122.4194,
    latitude: 37.7749
  },
  deliveryAddress: {
    id: "addr-2",
    name: "Office Building XYZ",
    street1: "456 Oak Ave",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    locationNumber: "Floor 5",
    parkingLoading: "Street parking",
    longitude: -122.4094,
    latitude: 37.7849
  },
  dispatches: [{
    id: "dispatch-1",
    driver: {
      id: "driver-1",
      name: "John Driver",
      email: "john@example.com",
      contactNumber: "(555) 123-4567"
    }
  }],
  fileUploads: [{
    id: "file-1",
    fileName: "invoice.pdf",
    fileUrl: "https://example.com/invoice.pdf",
    fileType: "application/pdf"
  }, {
    id: "file-2",
    fileName: "receipt.jpg",
    fileUrl: "https://example.com/receipt.jpg",
    fileType: "image/jpeg"
  }]
};

export const mockCateringOrderData = {
  ...mockVendorOrderData,
  id: "order-2",
  orderNumber: "CATERING-456",
  orderType: "catering" as const,
  headcount: 50,
  needHost: "Yes",
  hoursNeeded: 4,
  numberOfHosts: 2,
  vehicleType: null,
  itemDelivered: null,
  length: null,
  width: null,
  height: null,
  weight: null
};

export const mockOnDemandOrderData = {
  ...mockVendorOrderData,
  id: "order-3",
  orderNumber: "ONDEMAND-789",
  orderType: "on_demand" as const,
  headcount: null,
  needHost: null,
  hoursNeeded: null,
  numberOfHosts: null,
  vehicleType: "Car",
  itemDelivered: "Documents",
  length: 12,
  width: 8,
  height: 4,
  weight: 2
};

export const mockOrderWithoutDriver = {
  ...mockVendorOrderData,
  id: "order-4",
  orderNumber: "NO-DRIVER-123",
  dispatches: undefined,
  driverStatus: null
};

export const mockOrderWithoutFiles = {
  ...mockVendorOrderData,
  id: "order-5",
  orderNumber: "NO-FILES-123",
  fileUploads: undefined
};

export const mockOrderWithoutNotes = {
  ...mockVendorOrderData,
  id: "order-6",
  orderNumber: "NO-NOTES-123",
  specialNotes: null,
  pickupNotes: null,
  clientAttention: null
};

export const mockMinimalOrderData = {
  id: "order-7",
  orderNumber: "MINIMAL-123",
  orderType: "on_demand" as const,
  status: "PENDING",
  pickupDateTime: null,
  arrivalDateTime: null,
  completeDateTime: null,
  orderTotal: 50.00,
  tip: null,
  brokerage: null,
  clientAttention: null,
  pickupNotes: null,
  specialNotes: null,
  headcount: null,
  needHost: null,
  hoursNeeded: null,
  numberOfHosts: null,
  vehicleType: null,
  itemDelivered: null,
  length: null,
  width: null,
  height: null,
  weight: null,
  image: null,
  driverStatus: null,
  pickupAddress: {
    id: "addr-3",
    name: null,
    street1: "789 Pine St",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    locationNumber: null,
    parkingLoading: null,
    longitude: null,
    latitude: null
  },
  deliveryAddress: {
    id: "addr-4",
    name: null,
    street1: "321 Elm St",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94104",
    locationNumber: null,
    parkingLoading: null,
    longitude: null,
    latitude: null
  },
  dispatches: undefined,
  fileUploads: undefined
}; 