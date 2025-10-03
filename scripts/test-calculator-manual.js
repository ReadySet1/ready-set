#!/usr/bin/env node

/**
 * Manual Calculator Testing Script
 * Run this to test the calculator API endpoints directly with the test cases from CALCULATOR_TESTS.md
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test cases from CALCULATOR_TESTS.md
const testCases = [
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
      driverTotal: 35    // Tier 1 base pay (first 10 miles included)
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
      driverTotal: 40.70   // $40 base + $0.70 mileage (2 miles × $0.35)
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
      driverTotal: 51.50   // $40 base + $3.50 mileage + $8 bridge
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
      driverTotal: 21.75   // $20 tip + $1.75 mileage (5 miles × $0.35)
    }
  }
];

async function getTemplates() {
  console.log('🔍 Fetching calculator templates...');
  try {
    const response = await fetch(`${BASE_URL}/api/calculator/templates`);
    if (!response.ok) {
      console.error('❌ Failed to fetch templates:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    console.log('✅ Templates response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching templates:', error.message);
    return null;
  }
}

async function testCalculation(templateId, testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 ${testCase.description}`);
  console.log('📊 Input:', testCase.input);
  
  try {
    const response = await fetch(`${BASE_URL}/api/calculator/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This test won't work without authentication
        // This is just to test the basic API structure
      },
      body: JSON.stringify({
        templateId,
        saveHistory: false,
        ...testCase.input
      })
    });

    console.log(`📡 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log('❌ Error Response:', errorData);
      return;
    }

    const result = await response.json();
    console.log('✅ Calculation Result:', result);
    
    if (result.success && result.data) {
      const { customerCharges, driverPayments } = result.data;
      console.log(`💰 Customer Total: $${customerCharges.total.toFixed(2)} (Expected: $${testCase.expected.customerTotal})`);
      console.log(`👨‍💼 Driver Total: $${driverPayments.total.toFixed(2)} (Expected: $${testCase.expected.driverTotal})`);
      
      // Check if results match expectations (within $0.10)
      const customerMatch = Math.abs(customerCharges.total - testCase.expected.customerTotal) < 0.10;
      const driverMatch = Math.abs(driverPayments.total - testCase.expected.driverTotal) < 0.10;
      
      if (customerMatch && driverMatch) {
        console.log('✅ TEST PASSED!');
      } else {
        console.log('❌ TEST FAILED - Results don\'t match expected values');
      }
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function runCalculatorTests() {
  console.log('🧪 Calculator Manual Testing Script');
  console.log('=====================================\n');
  
  // First, try to get templates
  const templatesData = await getTemplates();
  
  if (!templatesData || !templatesData.success) {
    console.log('⚠️  Could not fetch templates - API may require authentication');
    console.log('💡 You can still run this with a valid session token\n');
  }
  
  // Use the template ID from the logs or default one
  const templateId = '0279b399-8cde-41e1-8528-fc2eaa1582ed'; // From your terminal logs
  
  console.log(`🎯 Using Template ID: ${templateId}\n`);
  
  // Run all test cases
  for (const testCase of testCases) {
    await testCalculation(templateId, testCase);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }
  
  console.log('\n🏁 Testing Complete!');
  console.log('\n💡 Tips:');
  console.log('- If tests failed due to authentication, run them through the UI');
  console.log('- Check the browser console for detailed calculation breakdowns');
  console.log('- Verify the database has the correct pricing rules');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
if (require.main === module) {
  runCalculatorTests().catch(console.error);
}

module.exports = { runCalculatorTests, testCases };
