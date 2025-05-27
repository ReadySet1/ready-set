# Carrier Integration System

## Overview

The Carrier Integration System provides a scalable architecture for integrating with multiple external delivery platforms like CaterValley, with the ability to easily add new carriers in the future. The system handles bidirectional communication through APIs and webhooks.

## Architecture

### Core Components

1. **CarrierService** (`src/lib/services/carrierService.ts`)
   - Generic service for managing multiple carrier integrations
   - Handles webhook dispatch, retry logic, and connectivity testing
   - Easily configurable for new carriers

2. **Dashboard Components** (`src/components/Dashboard/CarrierManagement/`)
   - `CarrierOverview`: Full management interface for carriers
   - `CarrierOrdersBadge`: Shows carrier info on order cards
   - `CarrierSummaryWidget`: Dashboard widget with carrier status

3. **API Endpoints**
   - `/api/admin/carriers/[carrierId]/stats`: Carrier statistics
   - `/api/catering-requests/[orderId]/status`: Order status updates with webhook triggers
   - CaterValley-specific endpoints: `/api/cater-valley/orders/*`

## Current Integrations

### CaterValley
- **Order Prefix**: `CV-`
- **Status Mapping**:
  - `ASSIGNED` → `CONFIRM`
  - `ARRIVED_AT_VENDOR` → `READY`
  - `EN_ROUTE_TO_CLIENT` → `ON_THE_WAY`
  - `ARRIVED_TO_CLIENT` → `ON_THE_WAY`
  - `COMPLETED` → `COMPLETED`
- **Webhook URL**: `CATERVALLEY_WEBHOOK_URL` environment variable
- **Authentication**: `CATERVALLEY_API_KEY` + partner header

## Dashboard Integration

### Main Dashboard
- **Carrier Summary Widget**: Shows real-time status of all carriers
- **Order Badges**: Each order displays its carrier integration status
- **Quick Stats**: Today's orders and active orders per carrier

### Carrier Management Page (`/admin/carriers`)
- **Overview Cards**: Status, connectivity, and performance metrics for each carrier
- **Connection Testing**: Real-time connectivity checks
- **Performance Metrics**: Webhook success rates, latency, order volumes
- **Configuration Management**: Enable/disable carriers, manage settings

### Enhanced Order Display
- **Carrier Badges**: Visual indicators showing which carrier handles each order
- **Integration Status**: Shows if real-time updates are enabled
- **Tooltips**: Detailed carrier information on hover

## Adding New Carriers

### 1. Update CarrierService Configuration

```typescript
// Add to CARRIER_CONFIGS in src/lib/services/carrierService.ts
newcarrier: {
  id: 'newcarrier',
  name: 'New Carrier',
  webhookUrl: process.env.NEWCARRIER_WEBHOOK_URL || '',
  apiKey: process.env.NEWCARRIER_API_KEY,
  enabled: true,
  statusMapping: {
    ASSIGNED: 'ACCEPTED',
    ARRIVED_AT_VENDOR: 'PICKED_UP',
    EN_ROUTE_TO_CLIENT: 'IN_TRANSIT',
    ARRIVED_TO_CLIENT: 'ARRIVED',
    COMPLETED: 'DELIVERED',
  },
  orderPrefix: 'NC-',
  webhookHeaders: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer',
  },
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    timeoutMs: 10000,
  },
}
```

### 2. Create API Endpoints

Create carrier-specific API endpoints following the CaterValley pattern:
- `/api/new-carrier/orders/draft`
- `/api/new-carrier/orders/update`
- `/api/new-carrier/orders/confirm`

### 3. Update Environment Variables

Add required environment variables:
```bash
NEWCARRIER_WEBHOOK_URL=https://api.newcarrier.com/webhooks/status
NEWCARRIER_API_KEY=your_api_key_here
```

### 4. Update Brokerage Options

Add the new carrier to brokerage dropdowns:
```typescript
{ value: "NewCarrier", label: "New Carrier ⚡ (Integrated)" }
```

## Features

### Real-time Status Updates
- Automatic webhook dispatch when driver status changes
- Retry logic with exponential backoff
- Error handling and logging
- Support for bulk status updates

### Dashboard Monitoring
- Live connectivity status for all carriers
- Performance metrics and success rates
- Order volume tracking
- Real-time carrier health monitoring

### Scalable Architecture
- Generic carrier interface for easy expansion
- Configuration-driven approach
- Consistent API patterns
- Centralized webhook management

### Order Management
- Carrier detection based on order prefixes
- Visual carrier indicators on order cards
- Integration status awareness
- Carrier-specific order routing

## API Documentation

### Status Update Endpoint
```
PATCH /api/catering-requests/[orderId]/status
```

**Request Body:**
```json
{
  "driverStatus": "ASSIGNED",
  "driverId": "driver-uuid",
  "notes": "Optional notes",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "metadata": {
    "customField": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "orderNumber": "CV-12345",
    "status": "ASSIGNED",
    "driverStatus": "ASSIGNED",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "webhookResults": {
    "caterValley": {
      "success": true,
      "attempts": 1
    }
  },
  "message": "Order status successfully updated to ASSIGNED"
}
```

### Carrier Statistics
```
GET /api/admin/carriers/[carrierId]/stats
```

**Response:**
```json
{
  "totalOrders": 150,
  "activeOrders": 12,
  "todayOrders": 8,
  "webhookSuccess": 97,
  "recentOrders": [
    {
      "id": "order-uuid",
      "orderNumber": "CV-12345",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T08:00:00Z",
      "orderTotal": 125.50
    }
  ]
}
```

## Configuration

### Environment Variables
```bash
# CaterValley Integration
CATERVALLEY_WEBHOOK_URL=https://api-courier.catervalley.com/api/order/update-order-status
CATERVALLEY_API_KEY=your_catervalley_api_key

# Database
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_database_url
```

### Carrier Configuration
Each carrier requires:
- Unique ID and display name
- Webhook URL and authentication details
- Status mapping between internal and external statuses
- Order prefix for identification
- Retry policy configuration

## Security

### Authentication
- API key authentication for external carriers
- Partner headers for additional verification
- Request validation and sanitization
- Rate limiting and abuse prevention

### Data Protection
- Encrypted webhook payloads where supported
- Secure credential storage in environment variables
- Audit logging for all carrier communications
- PII protection in webhook payloads

## Monitoring & Observability

### Logging
- Comprehensive webhook attempt logging
- Status transition tracking
- Error logging with context
- Performance metrics collection

### Metrics
- Webhook success/failure rates
- Response time monitoring
- Order volume per carrier
- System health indicators

### Alerting
- Failed webhook notifications
- Carrier connectivity issues
- Performance degradation alerts
- Order processing delays

## Future Enhancements

### Planned Features
1. **Webhook Logs Table**: Persistent storage of webhook attempts and results
2. **Advanced Analytics**: Detailed performance and trend analysis
3. **Auto-scaling**: Dynamic retry policies based on carrier performance
4. **Multi-region Support**: Carrier-specific geographic routing
5. **Real-time Notifications**: Push notifications for status changes
6. **Carrier Onboarding Wizard**: Guided setup for new carrier integrations

### Integration Roadmap
- Uber Eats integration
- DoorDash for Business
- Grubhub Corporate Catering
- Additional regional carriers

This system provides a robust foundation for multi-carrier integration while maintaining scalability and ease of management through the dashboard interface. 