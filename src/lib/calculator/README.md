# Delivery Cost Calculator System

Comprehensive calculator system for delivery pricing with configurable client-specific rates and settings.

## Features

✅ **Multi-tiered Pricing** - 11 tiers based on headcount and food cost ranges
✅ **Distance-based Rates** - Different pricing for deliveries within/beyond 10 miles
✅ **Mileage Calculation** - $3.00/mile for miles over threshold
✅ **Daily Drive Discounts** - Progressive discounts for multiple drives per day
✅ **Driver Pay Calculation** - Complete breakdown with max pay, bonuses, and fees
✅ **Client Configurations** - Customizable pricing for different clients
✅ **TypeScript Support** - Full type safety with comprehensive interfaces
✅ **Validation** - Input validation with detailed error messages
✅ **Test Coverage** - 29 passing tests covering all business rules

## Quick Start

###bash Basic Usage

```typescript
import { calculateDeliveryCost } from '@/lib/calculator/delivery-cost-calculator';

const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 1,
  requiresBridge: false
});

console.log(result);
// {
//   deliveryCost: 90,
//   totalMileagePay: 15,
//   dailyDriveDiscount: 0,
//   bridgeToll: 0,
//   deliveryFee: 105
// }
```

### Using Client Configurations

```typescript
import { calculateDeliveryCost } from '@/lib/calculator/delivery-cost-calculator';

const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 2,
  clientConfigId: 'ready-set-food-premium' // Use premium pricing
});
```

### Driver Pay Calculation

```typescript
import { calculateDriverPay } from '@/lib/calculator/delivery-cost-calculator';

const driverPay = calculateDriverPay({
  headcount: 28,
  foodCost: 0,
  totalMileage: 12,
  numberOfDrives: 1,
  bonusQualified: true,
  readySetFee: 70,
  clientConfigId: 'ready-set-food-standard'
});

console.log(driverPay);
// {
//   driverMaxPayPerDrop: 40,
//   driverBasePayPerDrop: 23,
//   driverTotalBasePay: 23,
//   readySetFee: 70,
//   driverBonusPay: 10,
//   totalDriverPay: 33,
//   bonusQualifiedPercent: 100,
//   mileagePay: 0.70
// }
```

## Client Configurations

### Available Configurations

1. **Ready Set Food - Standard** (`ready-set-food-standard`)
   - Standard delivery pricing based on official documents
   - 11 pricing tiers with $60-$310 range (>10 miles)
   - $3.00/mile mileage rate
   - Driver max pay: $40, base: $23, bonus: $10

2. **Ready Set Food - Premium** (`ready-set-food-premium`)
   - Enhanced pricing with higher driver compensation
   - 11 pricing tiers with $70-$340 range (>10 miles)
   - $3.50/mile mileage rate
   - Driver max pay: $50, base: $28, bonus: $15

3. **Generic Template** (`generic-template`)
   - Base template for creating custom configurations
   - 5 pricing tiers with simplified ranges
   - $2.50/mile mileage rate
   - Driver max pay: $35, base: $20, bonus: $8

### Managing Configurations

```typescript
import {
  getConfiguration,
  getActiveConfigurations,
  getConfigurationOptions,
  createConfigurationFromTemplate
} from '@/lib/calculator/client-configurations';

// Get specific configuration
const config = getConfiguration('ready-set-food-standard');

// Get all active configurations
const allConfigs = getActiveConfigurations();

// Get options for dropdown
const options = getConfigurationOptions();
// [{ value: 'ready-set-food-standard', label: 'Ready Set Food - Standard', description: '...' }]

// Create custom configuration from template
const customConfig = createConfigurationFromTemplate('generic-template', {
  clientName: 'Custom Client',
  mileageRate: 3.5,
  driverPaySettings: {
    maxPayPerDrop: 45,
    basePayPerDrop: 25,
    bonusPay: 12,
    readySetFee: 75
  }
});
```

### Creating Custom Configurations

```typescript
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

const myCustomConfig: ClientDeliveryConfiguration = {
  id: 'my-custom-client',
  clientName: 'My Custom Client',
  description: 'Custom pricing for special client',
  isActive: true,

  pricingTiers: [
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 55, within10Miles: 28 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 65, within10Miles: 38 },
    // ... more tiers
  ],

  mileageRate: 2.75,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 42,
    basePayPerDrop: 24,
    bonusPay: 11,
    readySetFee: 72
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.50,
    autoApplyForAreas: ['San Francisco']
  },

  createdAt: new Date(),
  updatedAt: new Date(),
  notes: 'Custom configuration notes'
};
```

## Business Rules

### Pricing Tiers

The calculator uses 11 pricing tiers based on the **LESSER** of headcount OR food cost (conservative approach):

| Tier | Headcount | Food Cost | Regular Rate | Within 10 Miles |
|------|-----------|-----------|--------------|-----------------|
| 1 | 0-24 | $0-$299.99 | $60 | $30 |
| 2 | 25-49 | $300-$599.99 | $70 | $40 |
| 3 | 50-74 | $600-$899.99 | $90 | $60 |
| 4 | 75-99 | $900-$1,199.99 | $100 | $70 |
| 5 | 100-124 | $1,200-$1,499.99 | $120 | $80 |
| 6 | 125-149 | $1,500-$1,699.99 | $150 | $90 |
| 7 | 150-174 | $1,700-$1,899.99 | $180 | $100 |
| 8 | 175-199 | $1,900-$2,099.99 | $210 | $110 |
| 9 | 200-249 | $2,100-$2,299.99 | $280 | $120 |
| 10 | 250-299 | $2,300-$2,499.99 | $310 | $130 |
| 11 | 300+ | $2,500+ | TBD | TBD |

### Mileage Calculation

- **Within 10 miles**: $0 mileage charge
- **Over 10 miles**: $3.00 per mile for miles over 10
- Example: 14.5 miles = (14.5 - 10) × $3.00 = $13.50

### Daily Drive Discounts

Total discount = (discount per drive) × (number of drives)

- **1 drive**: No discount
- **2 drives**: -$5 per drive × 2 = -$10 total
- **3 drives**: -$10 per drive × 3 = -$30 total
- **4+ drives**: -$15 per drive × drives = varies

### Driver Pay Components

- **Max Pay Per Drop**: $40 (cap on driver earnings)
- **Base Pay Per Drop**: $23
- **Bonus Pay**: $10 (if qualified)
- **Ready Set Fee**: $70 (platform fee)
- **Mileage Pay**: Separate from base pay

**Formula**: `totalDriverPay = min(basePay + bonus, maxPay)`

## API Reference

### Types

```typescript
interface DeliveryCostInput {
  headcount: number;
  foodCost: number;
  totalMileage: number;
  numberOfDrives?: number; // Default: 1
  requiresBridge?: boolean; // Default: false
  bridgeToll?: number; // Default: from config
  clientConfigId?: string; // Optional: use specific client config
}

interface DeliveryCostBreakdown {
  deliveryCost: number; // Base delivery cost from tier
  totalMileagePay: number; // Mileage charge
  dailyDriveDiscount: number; // Discount for multiple drives
  bridgeToll: number; // Bridge toll if applicable
  deliveryFee: number; // Total: deliveryCost + mileagePay - discount + toll
}

interface DriverPayInput extends DeliveryCostInput {
  bonusQualified: boolean;
  readySetFee?: number; // Default: from config
  readySetAddonFee?: number; // Default: 0
}

interface DriverPayBreakdown {
  driverMaxPayPerDrop: number;
  driverBasePayPerDrop: number;
  driverTotalBasePay: number;
  readySetFee: number;
  readySetAddonFee: number;
  readySetTotalFee: number;
  driverBonusPay: number;
  totalDriverPay: number;
  bonusQualifiedPercent: number; // 0-100%
  mileagePay: number;
}
```

### Functions

#### `calculateDeliveryCost(input: DeliveryCostInput): DeliveryCostBreakdown`

Calculates complete delivery cost breakdown.

```typescript
const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 2,
  requiresBridge: false,
  clientConfigId: 'ready-set-food-standard'
});
```

#### `calculateMileagePay(totalMileage: number, clientConfigId?: string): number`

Calculates mileage pay only.

```typescript
const mileagePay = calculateMileagePay(14.5); // Returns 13.50
```

#### `calculateDriverPay(input: DriverPayInput): DriverPayBreakdown`

Calculates complete driver payment breakdown.

```typescript
const driverPay = calculateDriverPay({
  headcount: 28,
  foodCost: 0,
  totalMileage: 12,
  numberOfDrives: 1,
  bonusQualified: true,
  readySetFee: 70
});
```

#### `calculateVendorPay(input: DeliveryCostInput): VendorPayBreakdown`

Calculates vendor payment (currently returns delivery fee).

```typescript
const vendorPay = calculateVendorPay({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15
});
```

#### `validateDeliveryCostInput(input: DeliveryCostInput): { valid: boolean; errors: string[] }`

Validates input parameters.

```typescript
const validation = validateDeliveryCostInput({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 2
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## Configuration Management

### Validation

```typescript
import { validateConfiguration } from '@/lib/calculator/client-configurations';

const validation = validateConfiguration(myConfig);

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Import/Export

```typescript
import {
  exportConfiguration,
  importConfiguration
} from '@/lib/calculator/client-configurations';

// Export to JSON
const json = exportConfiguration(config);

// Import from JSON
const importedConfig = importConfiguration(json);
```

### Cloning

```typescript
import { cloneConfiguration } from '@/lib/calculator/client-configurations';

const clonedConfig = cloneConfiguration('ready-set-food-standard', 'My Custom Version');
```

## Testing

Run the test suite:

```bash
pnpm test delivery-cost-calculator.test.ts
```

### Test Coverage

- ✓ All 5 test cases from pricing documents
- ✓ Tier determination logic
- ✓ Mileage calculation
- ✓ Daily drive discounts
- ✓ Driver pay calculations
- ✓ Edge cases and boundary conditions
- ✓ Input validation
- ✓ 29 tests passing

## Examples

### Example 1: Standard Delivery

```typescript
// 50 people, $700 food cost, 15 miles, single drive
const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 1
});
// Result: { deliveryCost: 90, totalMileagePay: 15, dailyDriveDiscount: 0, deliveryFee: 105 }
```

### Example 2: Multiple Drives with Discount

```typescript
// $2,300 food cost, 14.5 miles, 3 drives
const result = calculateDeliveryCost({
  headcount: 0,
  foodCost: 2300,
  totalMileage: 14.5,
  numberOfDrives: 3
});
// Result: { deliveryCost: 310, totalMileagePay: 13.50, dailyDriveDiscount: 30, deliveryFee: 293.50 }
```

### Example 3: Within 10 Miles

```typescript
// $1,200 food cost, 9 miles (no mileage charge)
const result = calculateDeliveryCost({
  headcount: 0,
  foodCost: 1200,
  totalMileage: 9,
  numberOfDrives: 1
});
// Result: { deliveryCost: 80, totalMileagePay: 0, dailyDriveDiscount: 0, deliveryFee: 80 }
```

### Example 4: With Bridge Toll

```typescript
// 50 people, $700 food cost, 15 miles, bridge crossing
const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 1,
  requiresBridge: true,
  bridgeToll: 8
});
// Result: { deliveryCost: 90, totalMileagePay: 15, dailyDriveDiscount: 0, bridgeToll: 8, deliveryFee: 113 }
```

### Example 5: Premium Configuration

```typescript
// Using premium pricing for higher service level
const result = calculateDeliveryCost({
  headcount: 50,
  foodCost: 700,
  totalMileage: 15,
  numberOfDrives: 1,
  clientConfigId: 'ready-set-food-premium'
});
// Uses premium rates with higher mileage rate ($3.50/mile)
```

## Future Enhancements

### UI Settings Management

To allow users to update settings in the future, implement:

1. **Configuration Editor Component**
   - Edit pricing tiers
   - Adjust mileage rates
   - Modify driver pay settings
   - Set daily drive discounts

2. **Configuration Selector**
   - Dropdown to select active configuration
   - Switch between standard/premium/custom

3. **Import/Export Feature**
   - Download configuration as JSON
   - Upload custom configurations
   - Version control for configs

4. **Validation UI**
   - Real-time validation feedback
   - Error highlighting
   - Suggested fixes

5. **Configuration History**
   - Track changes over time
   - Rollback capabilities
   - Audit log

### Database Integration

Store configurations in database with:
- User permissions (who can edit)
- Version history
- Active/inactive status
- Created/updated timestamps

### Example UI Component Structure

```typescript
// Configuration Settings Page
<ConfigurationManager>
  <ConfigurationSelector
    configurations={getActiveConfigurations()}
    selected={currentConfig}
    onChange={handleConfigChange}
  />

  <ConfigurationEditor
    config={currentConfig}
    onChange={handleConfigUpdate}
    onSave={handleConfigSave}
  />

  <ConfigurationValidator
    config={currentConfig}
    validation={validation}
  />

  <ConfigurationActions>
    <ExportButton onClick={handleExport} />
    <ImportButton onClick={handleImport} />
    <CloneButton onClick={handleClone} />
    <SaveButton onClick={handleSave} disabled={!validation.valid} />
  </ConfigurationActions>
</ConfigurationManager>
```

## File Structure

```
src/lib/calculator/
├── README.md                           # This file
├── delivery-cost-calculator.ts         # Main calculator module
├── client-configurations.ts            # Configuration management
└── __tests__/
    └── delivery-cost-calculator.test.ts # Test suite (29 tests)
```

## Support

For questions or issues:
1. Check the test suite for usage examples
2. Review business rules documentation
3. Validate input parameters
4. Ensure client configuration is correctly set up

## License

Internal use only - Ready Set LLC
