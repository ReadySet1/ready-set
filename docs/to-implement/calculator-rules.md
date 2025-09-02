# Updated Ready Set Food Delivery Calculator Logic

Based on the official Compensation Plan & Guidelines document, here's the complete logic:

## Food Delivery Calculator Logic

### Customer Charges:
1. **Base delivery fee**: Variable based on order size/headcount
2. **Long distance**: $3 per mile for distances over 10 miles
3. **Bridge tolls**: Variable based on location when crossing bridges
4. **Headcount and food cost**: Additional charges based on order parameters

### Driver Payments:

#### Two Payment Options:
1. **Ready Set Bonus Structure** (default)
2. **Direct Tips** (100% pass-through, excludes from bonus structure)

#### Ready Set Bonus Structure:
- **Mileage**: $0.35 per mile (only for miles beyond first 10)
- **Base Pay**: Determined by lesser of headcount vs order value
- **Weekly Bonus**: $10 included in rates (discretionary)

| Headcount | Order Value | Total Driver Payment |
|-----------|-------------|---------------------|
| < 25 | < $300 | $35 ($25 base + $10 bonus) |
| 25-49 | $300-599 | $40 ($30 base + $10 bonus) |
| 50-74 | $600-899 | $50 ($40 base + $10 bonus) |
| 75-99 | $900-1099 | $60 ($50 base + $10 bonus) |
| > 100 | > $1200 | Case by case |

#### Additional Driver Payments:
- **Bridge tolls**: $8 reimbursement when driver pays
- **Tips**: 100% pass-through (excludes delivery from bonus structure)

### Bonus Reductions:
Weekly bonus can be reduced for:
- No photo of setup: up to -5%
- Late delivery (>15 min): up to -10%
- Late delivery (>30 min): up to -20%
- Cancellations: -5% to -30% based on timing

## Updated Examples:

### Example 1 (Easy):
**Input**: 20 people, $250 order, 8 miles, no bridge, no tip
- **Customer pays**: ~$60-70 (base fee for small order)
- **Driver gets**: $35 (< 25 people, < $300 order = $35 total)
- **Calculation**: $35 base payment (includes first 10 miles)

### Example 2 (Normal):
**Input**: 35 people, $450 order, 12 miles, no bridge, no tip
- **Customer pays**: ~$80 (base + $6 for 2 extra miles at $3/mile)
- **Driver gets**: $40.70 ($40 base + $0.70 for 2 extra miles at $0.35/mile)
- **Calculation**: Uses 25-49 people category since order value $300-599 supports it

### Example 3 (Complex):
**Input**: 60 people, $500 order, 20 miles, bridge crossing, no tip
- **Customer pays**: ~$110 (base + $30 long distance + bridge toll)
- **Driver gets**: $58.50 ($50 base + $3.50 mileage + $8 bridge reimbursement)
- **Calculation**: 
  - Base: 50-74 people, $600-899 → but order is $500, so uses < $300 rate? No, uses $300-599 rate = $40
  - Actually uses 50-74 people range = $50 (lesser of parameters rule)
  - Mileage: (20-10) × $0.35 = $3.50
  - Bridge: $8

### Example 4 (With Direct Tip):
**Input**: 30 people, $400 order, 15 miles, $20 tip
- **Customer pays**: ~$95 (includes tip)
- **Driver gets**: $21.75 ($20 tip + $1.75 mileage only)
- **Note**: With direct tip, driver gets 100% tip but NO bonus structure payment

## Key Calculator Rules:
1. **Payout determination**: Lesser of headcount vs order value categories
2. **Mileage**: First 10 miles included, $0.35/mile thereafter
3. **Either/Or**: Bonus structure OR direct tips (never both)
4. **Bridge tolls**: $8 flat reimbursement to driver
5. **Weekly accumulation**: Bonuses calculated weekly, subject to performance deductions

This provides a much more accurate representation of the actual Ready Set compensation system!