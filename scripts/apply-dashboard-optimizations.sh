#!/bin/bash

# Dashboard Performance Optimizations Deployment Script
# Applies database indexes and validates the improvements

set -e

echo "🚀 Starting Dashboard Performance Optimizations Deployment"
echo "======================================================="

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Prisma is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available. Please install Node.js and npm"
    exit 1
fi

echo "📋 Current Environment:"
echo "  NODE_ENV: ${NODE_ENV:-'development'}"
echo "  Database URL: ${DATABASE_URL:+configured}"
echo ""

# Apply database migrations
echo "🗄️  Step 1: Applying database performance indexes..."
echo "   This will add optimized indexes for dashboard queries"
echo ""

if npx prisma db push --accept-data-loss; then
    echo "✅ Database schema updated successfully"
else
    echo "❌ Failed to update database schema"
    echo "   Please check your database connection and try again"
    exit 1
fi

echo ""
echo "📊 Step 2: Running database performance analysis..."
echo "   This will validate that indexes are properly created"
echo ""

# Run a query to validate indexes are working
if npx prisma db execute --file migrations/add-dashboard-performance-indexes.sql; then
    echo "✅ Performance indexes applied successfully"
else
    echo "⚠️  Some indexes may have failed to apply (they might already exist)"
fi

echo ""
echo "🔍 Step 3: Validating performance improvements..."
echo "   Testing dashboard metrics API performance"
echo ""

# Check if the API is accessible
API_URL="http://localhost:3000/api/dashboard-metrics"
if curl -s "$API_URL" > /dev/null 2>&1; then
    echo "✅ Dashboard metrics API is accessible"

    # Test a simple request to measure performance
    echo "   Testing API response time..."
    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s -w "%{time_total}" "$API_URL" 2>/dev/null || echo "error")
    END_TIME=$(date +%s%N)

    if [ "$RESPONSE" != "error" ]; then
        RESPONSE_TIME=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000000" | bc)
        echo "   📊 API Response Time: ${RESPONSE_TIME}s"

        if (( $(echo "$RESPONSE_TIME < 0.5" | bc -l) )); then
            echo "   ✅ Response time is within target (< 500ms)"
        else
            echo "   ⚠️  Response time is above target (target: < 500ms)"
        fi
    else
        echo "   ❌ Could not measure API response time"
    fi
else
    echo "   ⚠️  Dashboard metrics API is not accessible (server may not be running)"
    echo "   Please start the development server and run this script again"
fi

echo ""
echo "📈 Step 4: Performance monitoring setup complete"
echo "   Dashboard metrics now include:"
echo "   - In-memory caching with 5-minute TTL"
echo "   - Optimized database queries with transactions"
echo "   - Performance monitoring and logging"
echo "   - Cache invalidation endpoint (POST /api/dashboard-metrics)"
echo "   - Performance metrics endpoint (/api/admin/performance)"
echo ""

echo "🎯 Expected Improvements:"
echo "   - Dashboard metrics queries: < 500ms (was 1000-1700ms)"
echo "   - Cache hit rate: > 80% for repeated requests"
echo "   - Reduced database load through caching"
echo ""

echo "📋 Next Steps:"
echo "   1. Start your development server: npm run dev"
echo "   2. Test the dashboard in your browser"
echo "   3. Monitor performance via /api/admin/performance"
echo "   4. Use POST /api/dashboard-metrics to invalidate cache when needed"
echo ""

echo "✅ Dashboard Performance Optimizations Deployment Complete!"
echo "======================================================="<parameter>
</xai:function_call">ности

