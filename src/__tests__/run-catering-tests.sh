#!/bin/bash

# Test script to verify infinite loop fixes in CateringRequestForm and AddressManager
# This script runs comprehensive tests to ensure the components work properly together

echo "🧪 Running Catering Request and Address Manager Tests"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed or not in PATH"
    exit 1
fi

echo "📦 Installing dependencies if needed..."
pnpm install --silent

echo ""
echo "🔍 Running TypeScript type check..."
if pnpm run type-check; then
    echo "✅ TypeScript check passed"
else
    echo "❌ TypeScript check failed"
    exit 1
fi

echo ""
echo "🧪 Running AddressManager component tests..."
if pnpm test src/__tests__/AddressManager.test.tsx; then
    echo "✅ AddressManager tests passed"
else
    echo "❌ AddressManager tests failed"
    exit 1
fi

echo ""
echo "🧪 Running CateringRequestForm component tests..."
if pnpm test src/__tests__/CateringRequestForm.test.tsx; then
    echo "✅ CateringRequestForm tests passed"
else
    echo "❌ CateringRequestForm tests failed"
    exit 1
fi

echo ""
echo "🧪 Running integration tests..."
if pnpm test src/__tests__/CateringRequestIntegration.test.tsx; then
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
    exit 1
fi

echo ""
echo "🎯 Running specific infinite loop prevention tests..."
echo "Testing that AddressManager doesn't make excessive API calls..."

# Run a focused test on the infinite loop prevention
if pnpm test src/__tests__/AddressManager.test.tsx -- --grep "should not make excessive API calls on mount"; then
    echo "✅ Infinite loop prevention test passed"
else
    echo "❌ Infinite loop prevention test failed"
    exit 1
fi

echo ""
echo "🚀 Running performance tests..."
echo "Testing that components don't cause excessive re-renders..."

if pnpm test src/__tests__/CateringRequestIntegration.test.tsx -- --grep "should not cause re-renders when addresses are loaded"; then
    echo "✅ Performance test passed"
else
    echo "❌ Performance test failed"
    exit 1
fi

echo ""
echo "📊 Running memory leak tests..."
echo "Testing that components don't create memory leaks..."

if pnpm test src/__tests__/AddressManager.test.tsx -- --grep "should not create memory leaks with multiple renders"; then
    echo "✅ Memory leak test passed"
else
    echo "❌ Memory leak test failed"
    exit 1
fi

echo ""
echo "🎉 All tests completed successfully!"
echo "=================================================="
echo "✅ TypeScript compilation: PASSED"
echo "✅ AddressManager component: PASSED"
echo "✅ CateringRequestForm component: PASSED"
echo "✅ Integration tests: PASSED"
echo "✅ Infinite loop prevention: PASSED"
echo "✅ Performance tests: PASSED"
echo "✅ Memory leak prevention: PASSED"
echo ""
echo "🎯 The infinite loop issue has been successfully fixed!"
echo "🔧 Both components now work together without performance issues."
echo "📱 Addresses load properly without excessive API calls."
echo "⚡ Form state is maintained during address loading."
echo ""
echo "🚀 Ready for production use!"
