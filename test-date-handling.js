#!/usr/bin/env node

/**
 * Test script to verify date handling logic
 * Simulates the toISOString helper function from the API
 */

// Simulate the toISOString helper function from the API
const toISOString = (dateValue) => {
  if (!dateValue) return new Date().toISOString();
  
  // If it's already a string, try to parse it
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  
  // If it's a Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  
  // Fallback
  return new Date().toISOString();
};

// Test cases
const testCases = [
  {
    name: "Valid Date object",
    input: new Date('2024-01-15T10:00:00Z'),
    expected: "2024-01-15T10:00:00.000Z"
  },
  {
    name: "Valid date string",
    input: "2024-01-15T10:00:00Z",
    expected: "2024-01-15T10:00:00.000Z"
  },
  {
    name: "Null value",
    input: null,
    expected: "fallback"
  },
  {
    name: "Undefined value",
    input: undefined,
    expected: "fallback"
  },
  {
    name: "Invalid date string",
    input: "invalid-date",
    expected: "fallback"
  },
  {
    name: "Empty string",
    input: "",
    expected: "fallback"
  },
  {
    name: "Number (timestamp)",
    input: 1705312800000,
    expected: "fallback"
  }
];

console.log("🧪 Testing Date Handling Logic");
console.log("==============================\n");

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: ${testCase.input}`);
  
  try {
    const result = toISOString(testCase.input);
    const isValid = !isNaN(new Date(result).getTime());
    
    if (testCase.expected === "fallback") {
      // For fallback cases, just check if it's a valid date
      if (isValid) {
        console.log(`✅ Result: ${result} (Valid fallback)`);
        passedTests++;
      } else {
        console.log(`❌ Result: ${result} (Invalid fallback)`);
      }
    } else {
      // For specific cases, check exact match
      if (result === testCase.expected) {
        console.log(`✅ Result: ${result} (Exact match)`);
        passedTests++;
      } else {
        console.log(`❌ Result: ${result} (Expected: ${testCase.expected})`);
      }
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log("");
});

console.log("📊 Test Results");
console.log("===============");
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log("\n🎉 All date handling tests passed!");
  console.log("✅ The date handling logic is working correctly.");
} else {
  console.log("\n⚠️ Some tests failed. Please review the date handling logic.");
}

// Test edge cases
console.log("\n🔍 Testing Edge Cases");
console.log("====================");

// Test with different date formats
const edgeCases = [
  "2024-01-15",
  "01/15/2024",
  "2024-01-15T10:00:00.000Z",
  "2024-01-15 10:00:00",
  "invalid",
  null,
  undefined,
  {},
  [],
  0,
  -1
];

edgeCases.forEach((input, index) => {
  try {
    const result = toISOString(input);
    const isValid = !isNaN(new Date(result).getTime());
    console.log(`Edge ${index + 1}: ${input} → ${result} (${isValid ? 'Valid' : 'Invalid'})`);
  } catch (error) {
    console.log(`Edge ${index + 1}: ${input} → Error: ${error.message}`);
  }
});

console.log("\n✅ Date handling test completed!"); 