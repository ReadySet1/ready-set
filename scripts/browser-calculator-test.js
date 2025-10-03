/**
 * Browser Calculator Test Script
 * 
 * USAGE:
 * 1. Open http://localhost:3000/admin/calculator in your browser
 * 2. Open Developer Tools (F12) and go to Console
 * 3. Copy and paste this entire script into the console
 * 4. The script will automatically test all scenarios from CALCULATOR_TESTS.md
 */

// Test cases from CALCULATOR_TESTS.md
const calculatorTestCases = [
  {
    name: "Test 1: Example 1 (Easy)",
    description: "20 people, $250 order, 8 miles, no bridge, no tip",
    input: {
      headcount: 20,
      foodCost: 250,
      mileage: 8,
      requiresBridge: false,
      numberOfStops: 1,
      tips: 0,
      adjustments: 0,
      mileageRate: 0.70
    },
    expected: {
      customerTotal: 65, // Tier 1 base fee
      driverTotal: 35,   // Tier 1 base pay (first 10 miles included)
      notes: "Tier 1 - Base payment includes first 10 miles"
    }
  },
  {
    name: "Test 2: Example 2 (Normal)",
    description: "35 people, $450 order, 12 miles, no bridge, no tip",
    input: {
      headcount: 35,
      foodCost: 450,
      mileage: 12,
      requiresBridge: false,
      numberOfStops: 1,
      tips: 0,
      adjustments: 0,
      mileageRate: 0.70
    },
    expected: {
      customerTotal: 81,   // $75 base + $6 long distance
      driverTotal: 40.70,  // $40 base + $0.70 mileage (2 miles × $0.35)
      notes: "Tier 2 - $75 base + $6 long distance (2 miles × $3)"
    }
  },
  {
    name: "Test 3: Example 3 (Complex)",
    description: "60 people, $500 order, 20 miles, bridge crossing, no tip",
    input: {
      headcount: 60,
      foodCost: 500,
      mileage: 20,
      requiresBridge: true,
      numberOfStops: 1,
      tips: 0,
      adjustments: 0,
      mileageRate: 0.70
    },
    expected: {
      customerTotal: 113,  // $75 base + $30 long distance + $8 bridge
      driverTotal: 51.50,  // $40 base + $3.50 mileage + $8 bridge
      notes: "Tier 2 - $75 base + $30 long distance (10 miles × $3) + $8 bridge"
    }
  },
  {
    name: "Test 4: Example 4 (With Direct Tip)",
    description: "30 people, $400 order, 15 miles, $20 tip",
    input: {
      headcount: 30,
      foodCost: 400,
      mileage: 15,
      requiresBridge: false,
      numberOfStops: 1,
      tips: 20,
      adjustments: 0,
      mileageRate: 0.70
    },
    expected: {
      customerTotal: 110,  // $75 base + $15 long distance + $20 tip
      driverTotal: 21.75,  // $20 tip + $1.75 mileage (5 miles × $0.35)
      notes: "Tier 2 with tip - Driver gets tip only, no bonus structure"
    }
  }
];

// Helper function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Helper function to check if result matches expected (within $0.10 tolerance)
function checkResult(actual, expected, tolerance = 0.10) {
  return Math.abs(actual - expected) <= tolerance;
}

// Main test function that can be called from browser console
async function runBrowserCalculatorTests() {
  console.log('🧪 Starting Browser Calculator Tests');
  console.log('====================================\n');
  
  console.log('📋 Test Cases from CALCULATOR_TESTS.md:');
  console.log('🎯 Expected Tier Logic:');
  console.log('| Headcount | Order Value | Customer Base | Driver Base |');
  console.log('|-----------|-------------|---------------|-------------|');
  console.log('| < 25      | < $300      | $65           | $35         |');
  console.log('| 25-49     | $300-599    | $75           | $40         |');
  console.log('| 50-74     | $600-899    | $85           | $50         |');
  console.log('| 75-99     | $900-1099   | $95           | $60         |');
  console.log('| > 100     | > $1200     | $105          | $70         |');
  console.log('\n🔥 Key Rules:');
  console.log('- Uses LOWER tier when headcount and order value suggest different tiers');
  console.log('- Mileage charge: $3/mile for customer, $0.35/mile for driver (only > 10 miles)');
  console.log('- Bridge toll: $8 each way for both customer and driver');
  console.log('- With tip: Driver gets tip only, NO bonus structure payment\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < calculatorTestCases.length; i++) {
    const testCase = calculatorTestCases[i];
    
    console.log(`\n🧪 ${testCase.name}`);
    console.log(`📝 ${testCase.description}`);
    console.log('📊 Input:', testCase.input);
    console.log(`📝 Expected: Customer ${formatCurrency(testCase.expected.customerTotal)}, Driver ${formatCurrency(testCase.expected.driverTotal)}`);
    console.log(`💡 ${testCase.expected.notes}`);
    
    console.log('\n👆 MANUAL STEP: Enter these values in the calculator form above:');
    console.log(`   - Headcount: ${testCase.input.headcount}`);
    console.log(`   - Food Cost: ${testCase.input.foodCost}`);
    console.log(`   - Mileage: ${testCase.input.mileage}`);
    console.log(`   - Bridge Required: ${testCase.input.requiresBridge ? 'Yes' : 'No'}`);
    console.log(`   - Number of Stops: ${testCase.input.numberOfStops}`);
    console.log(`   - Tips: ${testCase.input.tips}`);
    console.log('\n⏱️  Then click "Calculate" and compare the results below...\n');
    
    // Wait for user to manually enter values and calculate
    await new Promise(resolve => {
      console.log('⏳ Waiting 10 seconds for you to enter values and calculate...');
      setTimeout(resolve, 10000);
    });
    
    console.log('✅ Ready for next test case...\n');
  }
  
  console.log('🏁 Manual Testing Complete!');
  console.log('\n📊 Summary:');
  console.log('- Compare each result with the expected values shown above');
  console.log('- Results should match within ±$0.10');
  console.log('- If any tests fail, check the calculation logic in the service');
  console.log('\n🔍 Debug Tips:');
  console.log('- Check browser Network tab for API calls');
  console.log('- Look for input data being sent to /api/calculator/calculate');
  console.log('- Verify rule evaluation in server logs');
}

// Also provide a quick test function for individual scenarios
window.testCalculatorScenario = function(scenarioNumber) {
  if (scenarioNumber < 1 || scenarioNumber > calculatorTestCases.length) {
    console.error(`❌ Invalid scenario number. Use 1-${calculatorTestCases.length}`);
    return;
  }
  
  const testCase = calculatorTestCases[scenarioNumber - 1];
  console.log(`🧪 Quick Test: ${testCase.name}`);
  console.log('📊 Input values to enter:');
  console.log(testCase.input);
  console.log(`📝 Expected: Customer ${formatCurrency(testCase.expected.customerTotal)}, Driver ${formatCurrency(testCase.expected.driverTotal)}`);
};

// Auto-start the test
console.log('🚀 Browser Calculator Test Script Loaded!');
console.log('\n🎯 Commands available:');
console.log('- runBrowserCalculatorTests() - Run all test cases with guided steps');
console.log('- testCalculatorScenario(1-4) - Show specific test case details');
console.log('\nℹ️  This script will guide you through testing each scenario manually.');
console.log('🔥 Starting in 3 seconds... Get ready to use the calculator form above!');

setTimeout(() => {
  runBrowserCalculatorTests();
}, 3000);
