# Delivery Cost and Distance Transparency Feature

## Overview
Added delivery cost and distance fields to CaterValley catering orders to provide transparency for the helpdesk team and improve operational visibility.

## Changes Implemented

### 1. Database Schema Updates
- **File**: `prisma/schema.prisma`
- **Changes**:
  - Added `deliveryCost` field: `Decimal(10, 2)` - stores the calculated delivery fee
  - Added `deliveryDistance` field: `Decimal(10, 2)` - stores distance in miles
  
- **Migration File**: `migrations/add-delivery-cost-distance-to-catering-requests.sql`
  - Adds both columns to `catering_requests` table
  - Includes documentation comments
  - Creates indexes for potential queries/reporting

### 2. API Endpoint Updates
Updated CaterValley API endpoints to save delivery cost and distance when creating/updating orders:

- **File**: `src/app/api/cater-valley/orders/draft/route.ts`
  - Now saves `deliveryCost: pricingResult.deliveryFee`
  - Now saves `deliveryDistance: distance`
  
- **File**: `src/app/api/cater-valley/orders/update/route.ts`
  - Updates `deliveryCost` and `deliveryDistance` when order is modified

### 3. TypeScript Type Definitions
Updated type definitions to include new fields:

- **File**: `src/types/order.ts`
  - Added `deliveryCost?: PrismaDecimal | null` to `CateringRequest` interface
  - Added `deliveryDistance?: PrismaDecimal | null` to `CateringRequest` interface

- **File**: `src/types/user.ts`
  - Added `deliveryCost?: number | null` to `CateringOrder` interface
  - Added `deliveryDistance?: number | null` to `CateringOrder` interface

- **File**: `src/types/supabase.ts`
  - Updated `catering_requests.Row` with new fields
  - Updated `catering_requests.Insert` with new fields
  - Updated `catering_requests.Update` with new fields

### 4. UI Component Updates
- **File**: `src/components/Orders/ui/OrderDetails.tsx`
  - Added display for "Delivery Cost" with formatted currency
  - Added display for "Distance" in miles with 2 decimal places
  - Only shows fields when data is available (handles null/undefined)
  - Positioned below Tip field for clear visibility

## Usage

### For New Orders
When CaterValley creates a new order via the API:
1. Distance is calculated between pickup and delivery locations
2. Delivery cost is calculated based on distance, headcount, and food cost
3. Both values are automatically saved to the database
4. Values are displayed in the Order Details section

### For Existing Orders
- Existing orders will have `null` values for these fields
- The UI handles this gracefully by not displaying the fields when data is unavailable
- When an existing order is updated via the CaterValley API, these fields will be populated

### Migration Instructions
To apply the database migration:

```bash
# Development/Staging
psql -h <dev-host> -U <user> -d <database> -f migrations/add-delivery-cost-distance-to-catering-requests.sql

# Production
psql -h <prod-host> -U <user> -d <database> -f migrations/add-delivery-cost-distance-to-catering-requests.sql
```

Or using Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `migrations/add-delivery-cost-distance-to-catering-requests.sql`
3. Run the SQL

### Regenerate Prisma Client
After applying the migration, regenerate the Prisma client:

```bash
pnpm prisma generate
```

## Display Example

In the Order Details section, the helpdesk team will now see:

```
Order Details
-------------
Headcount: 50
...

Total: $600.00
Tip: $0.00
Delivery Cost: $42.50
Distance: 12.35 mi

Brokerage
---------
CaterValley
```

## Benefits

1. **Transparency**: Helpdesk team can see exactly what delivery cost was calculated
2. **Troubleshooting**: Distance information helps verify pricing calculations
3. **Auditing**: Historical data is preserved for each order
4. **Reporting**: Can generate reports on delivery costs and distances
5. **Customer Service**: Better equipped to answer customer questions about delivery fees

## Technical Notes

- Fields are nullable to support existing orders that don't have this data
- UI component checks for null/undefined before displaying
- Distance is stored in miles (Decimal 10,2 for precision)
- Delivery cost stored in same format as other price fields (Decimal 10,2)
- Indexes created for potential performance queries
- CaterValley API automatically populates these fields on create/update

## Related Files

- Schema: `prisma/schema.prisma`
- Migration: `migrations/add-delivery-cost-distance-to-catering-requests.sql`
- API Endpoints: 
  - `src/app/api/cater-valley/orders/draft/route.ts`
  - `src/app/api/cater-valley/orders/update/route.ts`
- Types: 
  - `src/types/order.ts`
  - `src/types/user.ts`
  - `src/types/supabase.ts`
- UI Component: `src/components/Orders/ui/OrderDetails.tsx`

## Testing

To test the feature:

1. Create a new CaterValley order via the API
2. Navigate to the order details page in the admin dashboard
3. Verify that "Delivery Cost" and "Distance" are displayed
4. Check that values match the API response from the creation request

## Future Enhancements

Potential improvements:
- Add breakdown of delivery cost (base fee + mileage + discounts)
- Show distance on the order list/table view
- Add filtering/sorting by delivery cost or distance
- Include delivery metrics in reporting dashboard
- Show distance on Google Maps link tooltip

