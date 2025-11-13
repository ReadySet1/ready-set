# Quick Testing Guide - ModernPricingLandingPage

## 🚀 Quick Start

```bash
# Run the pricing component tests
pnpm test ModernPricingLandingPage

# Run in watch mode (auto-rerun on changes)
pnpm test:unit:watch ModernPricingLandingPage

# Run with coverage report
pnpm test:coverage -- ModernPricingLandingPage.test.tsx
```

## 🎯 Key Tests to Watch

### The Critical Test: Delivery Fee Display

**What it tests**: Option D (Hosting Only) should NOT show "+ Delivery Fee"

**Why it matters**: This is core business logic - customers need accurate pricing

**How to verify manually**:
1. Navigate to `/pricing` 
2. Click "Hosting Services" tab
3. Look at Option D card
4. Verify NO "+ Delivery Fee" text appears under the $110 price

## 🧪 Test Categories

### 1️⃣ Delivery Fee Logic (Most Important)
Tests the `includesDelivery` boolean flag:
- ✅ Options A, B, C show delivery fee
- ✅ Option D does NOT show delivery fee
- ✅ Exactly 3 instances total (not 4)

### 2️⃣ Tab Navigation
- Switches between Delivery and Hosting tabs
- Default view is Delivery tab

### 3️⃣ Data Display
- All 4 hosting options render
- All 11 pricing tiers render
- Correct prices, features, and headcounts

### 4️⃣ Accessibility
- Semantic HTML (buttons, headings)
- Alt text for images
- Proper link attributes

## 🔍 Running Specific Tests

```bash
# Run only delivery fee tests
pnpm test -- --testNamePattern="Conditional Rendering Logic"

# Run only hosting options tests
pnpm test -- --testNamePattern="Hosting Options"

# Run only accessibility tests
pnpm test -- --testNamePattern="Accessibility"

# Run a single test
pnpm test -- --testNamePattern="should NOT show delivery fee for Option D"
```

## 📊 Expected Test Results

```
PASS  src/components/Pricing/__tests__/ModernPricingLandingPage.test.tsx
  ModernPricingLandingPage
    Component Rendering
      ✓ should render the component without crashing
      ✓ should render the logo
      ✓ should render tab navigation
    Tab Navigation
      ✓ should default to delivery tab
      ✓ should switch to hosting tab when clicked
      ✓ should switch back to delivery tab when clicked
    Hosting Options - Critical Delivery Fee Logic
      ✓ should show delivery fee for Option A
      ✓ should show delivery fee for Option B
      ✓ should show delivery fee for Option C
      ✓ should NOT show delivery fee for Option D ⭐ CRITICAL
    Conditional Rendering Logic Verification
      ✓ should verify includesDelivery flag controls display
      ✓ should verify Option D explicitly does not have delivery fee
      ✓ should verify all other options have delivery fee

Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total
```

## 🐛 Debugging Failed Tests

### If "should NOT show delivery fee for Option D" fails:

**Possible causes**:
1. `includesDelivery` flag is missing or incorrect in data
2. Conditional rendering logic `{option.includesDelivery && ...}` is broken
3. Option D data structure changed

**How to debug**:
```typescript
// Check the hostingOptions array:
const hostingOptions: HostingOption[] = [
  // ...
  {
    title: "Option D",
    includesDelivery: false, // ← Must be false!
    // ...
  }
];

// Check the render logic:
{option.includesDelivery && (  // ← Must check this flag
  <span>+ Delivery Fee</span>
)}
```

### If count test fails (expects 3, got X):

**Meaning**: Wrong number of "+ Delivery Fee" texts

**Fix**:
- If got 4: Option D incorrectly has `includesDelivery: true`
- If got 2: One of A/B/C is missing `includesDelivery: true`
- If got 0: Conditional rendering is completely broken

## 📝 Adding New Tests

### Template for Testing a New Hosting Option:

```typescript
it("should show/not show delivery fee for Option X", () => {
  render(<ModernPricingLandingPage />);
  fireEvent.click(screen.getByText("Hosting Services"));
  
  const optionX = screen.getByText("Option X").closest("div")?.parentElement;
  
  // For options WITH delivery:
  const deliveryFee = within(optionX!).getByText("+ Delivery Fee");
  expect(deliveryFee).toBeInTheDocument();
  
  // For options WITHOUT delivery:
  const deliveryFee = within(optionX!).queryByText("+ Delivery Fee");
  expect(deliveryFee).not.toBeInTheDocument();
});
```

## 🎨 Visual Testing Checklist

While automated tests cover logic, manually verify:

- [ ] Yellow "MOST POPULAR" badge on Option B
- [ ] Cards have hover effects
- [ ] Pricing displays in yellow ($90, $190, $110)
- [ ] Green checkmarks on all features
- [ ] Responsive design works on mobile
- [ ] Tab switching is smooth with animations

## 🔧 Maintenance

### Before Deploying Changes:

```bash
# 1. Run all pricing tests
pnpm test ModernPricingLandingPage

# 2. Run all tests in the project
pnpm test

# 3. Check for linter errors
pnpm lint

# 4. Build the project
pnpm build
```

### After Adding New Hosting Options:

1. Update `hostingOptions` array with `includesDelivery` flag
2. Update the count in the test (currently expects 3)
3. Add specific test for the new option
4. Update this guide with new option details

## 🆘 Common Issues

### Issue: Tests fail in CI/CD but pass locally
**Solution**: Check Node/pnpm versions match `package.json` requirements

### Issue: Framer Motion errors in tests
**Solution**: Already mocked in test file - ensure mock is at top

### Issue: Next/Image errors in tests
**Solution**: Already mocked in test file - ensure mock is at top

### Issue: "Cannot find module" errors
**Solution**: Run `pnpm install` to ensure all dependencies installed

## 📚 Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Component Source Code](../ModernPricingLandingPage.tsx)
- [Full Test Documentation](./README.md)

---

**Quick Command Reference**:
```bash
pnpm test               # Run all tests
pnpm test:watch         # Watch mode
pnpm test:coverage      # With coverage
pnpm test ModernPricing # Just this component
```

**Emergency Test Run** (if environment issues):
```bash
# Skip environment checks (not recommended)
NODE_OPTIONS=--experimental-vm-modules pnpm test ModernPricingLandingPage
```


