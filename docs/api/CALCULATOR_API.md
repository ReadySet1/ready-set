# Calculator API Documentation

## Overview

The calculator API provides delivery cost calculations with client-specific configurations and tiered driver pay.

## Endpoints

### POST `/api/pricing/calculate`

Calculate delivery cost for an order.

**Authentication**: Required (Supabase session)

**Request**:
```json
{
  "headcount": 50,
  "mileage": 15,
  "foodCost": 500,
  "clientId": "cater-valley",
  "hasBridgeToll": false,
  "numberOfDrivers": 1
}
```

**Response**:
```json
{
  "success": true,
  "calculation": {
    "deliveryCost": 85.50,
    "driverPay": 40.00,
    "driverBonus": 10.00,
    "mileageFee": 5.50,
    "baseFee": 80.00,
    "tier": "Tier 3",
    "requiresManualReview": false
  }
}
```

## Client Configurations

### CaterValley
- **Minimum Delivery Fee**: $42.50
- **Mileage Rate**: $1.10 per mile (after 10 miles)
- **Tiered Pricing**: Based on headcount and food cost
- **Driver Pay**: Max $40 per drop with $10 bonus

### Kasa
- Custom pricing tiers
- Standard mileage rates

### HY Food Company
- Flat $50 driver base pay
- Standard mileage rates

## Features

- **Client-Specific Configurations**: Each client can have custom pricing tiers
- **Tiered Driver Pay**: Configurable base pay, bonuses, and maximums
- **Manual Review Thresholds**: Automatic flagging for high-value orders
- **Bridge Toll Support**: Automatic toll application for specific areas

## Related Issues

- REA-41: Client configurations and tiered driver pay

