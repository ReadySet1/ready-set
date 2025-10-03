#!/bin/bash

# Usage Pattern Analysis Script for User Deletion System
# This script analyzes usage patterns and generates insights for optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
ANALYSIS_PERIOD="${ANALYSIS_PERIOD:-2419200}"  # 4 weeks default (in seconds)
ANALYSIS_REPORT="/var/logs/ready-set/analysis/usage-pattern-analysis-$(date +%Y%m%d-%H%M%S).json"
TREND_THRESHOLD=20  # Percentage change to flag as significant trend

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ ANALYSIS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  TREND]${NC} $1"
}

print_error() {
    echo -e "${RED}[❌ ISSUE]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Function to execute database query safely
execute_analysis_query() {
    local query="$1"
    local description="$2"
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not configured"
        echo "{\"error\": \"no_database_connection\"}"
        return 1
    fi
    
    # Parse database URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_password="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]%%\?*}"
        
        export PGPASSWORD="$db_password"
        
        if result=$(psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "$query" 2>/dev/null); then
            echo "$result"
            return 0
        else
            print_error "Database query failed: $description"
            echo "{\"error\": \"query_failed\"}"
            return 1
        fi
    else
        print_error "Invalid DATABASE_URL format"
        echo "{\"error\": \"invalid_database_url\"}"
        return 1
    fi
}

# Function to analyze deletion frequency patterns
analyze_deletion_frequency() {
    print_info "Analyzing deletion frequency patterns..."
    
    local frequency_analysis="{\"analysis_type\": \"deletion_frequency\""
    
    # Daily deletion patterns over the analysis period
    local daily_pattern_query="
        SELECT 
            DATE(timestamp) as deletion_date,
            COUNT(*) as total_deletions,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_deletions,
            COUNT(CASE WHEN success = false THEN 1 END) as failed_deletions,
            EXTRACT(DOW FROM timestamp) as day_of_week
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY DATE(timestamp), EXTRACT(DOW FROM timestamp)
        ORDER BY deletion_date DESC;
    "
    
    local daily_data=$(execute_analysis_query "$daily_pattern_query" "daily deletion patterns")
    
    # Hourly patterns
    local hourly_pattern_query="
        SELECT 
            EXTRACT(HOUR FROM timestamp) as hour_of_day,
            COUNT(*) as deletion_count,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND duration IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY deletion_count DESC;
    "
    
    local hourly_data=$(execute_analysis_query "$hourly_pattern_query" "hourly deletion patterns")
    
    # Weekly patterns
    local weekly_pattern_query="
        SELECT 
            EXTRACT(DOW FROM timestamp) as day_of_week,
            CASE EXTRACT(DOW FROM timestamp)
                WHEN 0 THEN 'Sunday'
                WHEN 1 THEN 'Monday'
                WHEN 2 THEN 'Tuesday'
                WHEN 3 THEN 'Wednesday'
                WHEN 4 THEN 'Thursday'
                WHEN 5 THEN 'Friday'
                WHEN 6 THEN 'Saturday'
            END as day_name,
            COUNT(*) as deletion_count,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND duration IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY EXTRACT(DOW FROM timestamp)
        ORDER BY deletion_count DESC;
    "
    
    local weekly_data=$(execute_analysis_query "$weekly_pattern_query" "weekly deletion patterns")
    
    # Calculate summary statistics
    local total_deletions=$(echo "$daily_data" | awk '{sum += $2} END {print sum}' || echo "0")
    local successful_deletions=$(echo "$daily_data" | awk '{sum += $3} END {print sum}' || echo "0")
    local failed_deletions=$(echo "$daily_data" | awk '{sum += $4} END {print sum}' || echo "0")
    
    # Find peak hour
    local peak_hour=$(echo "$hourly_data" | head -1 | awk '{print $1}' || echo "unknown")
    local peak_hour_count=$(echo "$hourly_data" | head -1 | awk '{print $2}' || echo "0")
    
    # Find peak day
    local peak_day=$(echo "$weekly_data" | head -1 | awk '{print $2}' || echo "unknown")
    local peak_day_count=$(echo "$weekly_data" | head -1 | awk '{print $3}' || echo "0")
    
    frequency_analysis="$frequency_analysis,
        \"total_deletions\": $total_deletions,
        \"successful_deletions\": $successful_deletions,
        \"failed_deletions\": $failed_deletions,
        \"success_rate_percent\": $(echo "scale=2; $successful_deletions * 100 / ($total_deletions + 0.001)" | bc 2>/dev/null || echo "0"),
        \"peak_hour\": $peak_hour,
        \"peak_hour_deletions\": $peak_hour_count,
        \"peak_day\": \"$peak_day\",
        \"peak_day_deletions\": $peak_day_count,
        \"analysis_period_days\": $(($ANALYSIS_PERIOD / 86400))
    }"
    
    # Identify trends and patterns
    if [ "$total_deletions" -gt 0 ]; then
        print_status "Analyzed $total_deletions deletion operations over $(($ANALYSIS_PERIOD / 86400)) days"
        print_info "Peak usage: $peak_day at ${peak_hour}:00 hours"
        
        # Alert on unusual patterns
        if [ "$peak_hour_count" -gt $((total_deletions / 10)) ]; then
            print_warning "High concentration of deletions at peak hour ($peak_hour_count operations)"
        fi
    else
        print_info "No deletion operations found in analysis period"
    fi
    
    echo "$frequency_analysis"
}

# Function to analyze user type deletion patterns
analyze_user_type_patterns() {
    print_info "Analyzing user type deletion patterns..."
    
    local user_type_analysis="{\"analysis_type\": \"user_type_patterns\""
    
    # User type deletion frequency
    local user_type_query="
        SELECT 
            \"targetUserType\",
            COUNT(*) as deletion_count,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_count,
            COUNT(CASE WHEN success = false THEN 1 END) as failed_count,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms,
            MAX(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as max_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND \"targetUserType\" IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY \"targetUserType\"
        ORDER BY deletion_count DESC;
    "
    
    local user_type_data=$(execute_analysis_query "$user_type_query" "user type deletion patterns")
    
    # Performer type analysis
    local performer_type_query="
        SELECT 
            \"performedByType\",
            COUNT(*) as performed_count,
            COUNT(DISTINCT \"performedBy\") as unique_performers,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_operations
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND \"performedByType\" IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY \"performedByType\"
        ORDER BY performed_count DESC;
    "
    
    local performer_data=$(execute_analysis_query "$performer_type_query" "performer type patterns")
    
    # Extract insights from user type data
    local most_deleted_type="unknown"
    local most_deleted_count=0
    local slowest_type="unknown"
    local slowest_duration=0
    
    if [ "$user_type_data" != "{\"error\": \"query_failed\"}" ]; then
        most_deleted_type=$(echo "$user_type_data" | head -1 | awk '{print $1}' || echo "unknown")
        most_deleted_count=$(echo "$user_type_data" | head -1 | awk '{print $2}' || echo "0")
        
        # Find slowest user type (highest average duration)
        slowest_type=$(echo "$user_type_data" | sort -k5 -nr | head -1 | awk '{print $1}' || echo "unknown")
        slowest_duration=$(echo "$user_type_data" | sort -k5 -nr | head -1 | awk '{print $5}' || echo "0")
    fi
    
    # Extract performer insights
    local most_active_performer="unknown"
    local most_active_count=0
    
    if [ "$performer_data" != "{\"error\": \"query_failed\"}" ]; then
        most_active_performer=$(echo "$performer_data" | head -1 | awk '{print $1}' || echo "unknown")
        most_active_count=$(echo "$performer_data" | head -1 | awk '{print $2}' || echo "0")
    fi
    
    user_type_analysis="$user_type_analysis,
        \"most_deleted_user_type\": \"$most_deleted_type\",
        \"most_deleted_count\": $most_deleted_count,
        \"slowest_user_type\": \"$slowest_type\",
        \"slowest_avg_duration_ms\": $slowest_duration,
        \"most_active_performer_type\": \"$most_active_performer\",
        \"most_active_performer_operations\": $most_active_count
    }"
    
    # Generate insights
    if [ "$most_deleted_count" -gt 0 ]; then
        print_status "Most frequently deleted user type: $most_deleted_type ($most_deleted_count deletions)"
        
        if [ "$slowest_duration" -gt 5000 ]; then  # > 5 seconds
            print_warning "Slowest deletion type: $slowest_type (avg: ${slowest_duration}ms)"
        fi
        
        print_info "Most active performer type: $most_active_performer ($most_active_count operations)"
    fi
    
    echo "$user_type_analysis"
}

# Function to analyze failure scenarios and causes
analyze_failure_scenarios() {
    print_info "Analyzing failure scenarios and root causes..."
    
    local failure_analysis="{\"analysis_type\": \"failure_scenarios\""
    
    # Categorize failure types
    local failure_categories_query="
        SELECT 
            CASE 
                WHEN error LIKE '%timeout%' OR error LIKE '%timed out%' THEN 'timeout'
                WHEN error LIKE '%P2025%' OR error LIKE '%not found%' THEN 'user_not_found'
                WHEN error LIKE '%P2003%' OR error LIKE '%foreign key%' THEN 'foreign_key_violation'
                WHEN error LIKE '%active orders%' OR error LIKE '%pending orders%' THEN 'active_orders_prevention'
                WHEN error LIKE '%Forbidden%' OR error LIKE '%authorized%' THEN 'authorization_failure'
                WHEN error LIKE '%SUPER_ADMIN%' THEN 'super_admin_protection'
                WHEN error LIKE '%delete your own%' OR error LIKE '%self%' THEN 'self_deletion_prevention'
                WHEN error LIKE '%P2002%' OR error LIKE '%unique constraint%' THEN 'constraint_violation'
                WHEN error LIKE '%connection%' OR error LIKE '%database%' THEN 'database_connection'
                ELSE 'other'
            END as failure_category,
            COUNT(*) as occurrence_count,
            COUNT(DISTINCT \"performedBy\") as unique_users_affected,
            AVG(EXTRACT(EPOCH FROM (LAG(timestamp) OVER (ORDER BY timestamp) - timestamp))) as avg_time_between_failures
        FROM audit_logs 
        WHERE action = 'USER_DELETION'
            AND success = false 
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY failure_category
        ORDER BY occurrence_count DESC;
    "
    
    local failure_data=$(execute_analysis_query "$failure_categories_query" "failure categories analysis")
    
    # Temporal failure patterns
    local failure_timing_query="
        SELECT 
            EXTRACT(HOUR FROM timestamp) as hour,
            EXTRACT(DOW FROM timestamp) as day_of_week,
            COUNT(*) as failure_count
        FROM audit_logs 
        WHERE action = 'USER_DELETION'
            AND success = false 
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY EXTRACT(HOUR FROM timestamp), EXTRACT(DOW FROM timestamp)
        ORDER BY failure_count DESC;
    "
    
    local timing_data=$(execute_analysis_query "$failure_timing_query" "failure timing patterns")
    
    # Recent failure trends (last 7 days vs previous 7 days)
    local recent_failures_query="
        SELECT 
            'recent' as period,
            COUNT(*) as failure_count
        FROM audit_logs 
        WHERE action = 'USER_DELETION'
            AND success = false 
            AND timestamp > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 
            'previous' as period,
            COUNT(*) as failure_count
        FROM audit_logs 
        WHERE action = 'USER_DELETION'
            AND success = false 
            AND timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days';
    "
    
    local trend_data=$(execute_analysis_query "$recent_failures_query" "failure trend analysis")
    
    # Extract key metrics
    local top_failure_category="unknown"
    local top_failure_count=0
    local total_failures=0
    
    if [ "$failure_data" != "{\"error\": \"query_failed\"}" ]; then
        top_failure_category=$(echo "$failure_data" | head -1 | awk '{print $1}' || echo "unknown")
        top_failure_count=$(echo "$failure_data" | head -1 | awk '{print $2}' || echo "0")
        total_failures=$(echo "$failure_data" | awk '{sum += $2} END {print sum}' || echo "0")
    fi
    
    # Calculate failure trend
    local recent_failures=$(echo "$trend_data" | grep "recent" | awk '{print $2}' || echo "0")
    local previous_failures=$(echo "$trend_data" | grep "previous" | awk '{print $2}' || echo "0")
    local trend_change=0
    
    if [ "$previous_failures" -gt 0 ]; then
        trend_change=$(echo "scale=2; ($recent_failures - $previous_failures) * 100 / $previous_failures" | bc 2>/dev/null || echo "0")
    fi
    
    failure_analysis="$failure_analysis,
        \"total_failures\": $total_failures,
        \"top_failure_category\": \"$top_failure_category\",
        \"top_failure_count\": $top_failure_count,
        \"recent_failures_7_days\": $recent_failures,
        \"previous_failures_7_days\": $previous_failures,
        \"failure_trend_percent_change\": $trend_change
    }"
    
    # Generate alerts and insights
    if [ "$total_failures" -gt 0 ]; then
        print_status "Analyzed $total_failures failure scenarios"
        print_info "Most common failure: $top_failure_category ($top_failure_count occurrences)"
        
        # Check for concerning trends
        if (( $(echo "$trend_change > $TREND_THRESHOLD" | bc -l) )); then
            print_warning "Failure rate increasing: +${trend_change}% compared to previous week"
        elif (( $(echo "$trend_change < -$TREND_THRESHOLD" | bc -l) )); then
            print_status "Failure rate decreasing: ${trend_change}% compared to previous week"
        fi
        
        # Alert on specific failure types
        if [ "$top_failure_category" = "timeout" ] && [ "$top_failure_count" -gt 10 ]; then
            print_warning "High number of timeout failures detected - consider performance optimization"
        fi
        
        if [ "$top_failure_category" = "authorization_failure" ] && [ "$top_failure_count" -gt 5 ]; then
            print_warning "Multiple authorization failures - possible security concern"
        fi
    else
        print_status "No failure scenarios found in analysis period"
    fi
    
    echo "$failure_analysis"
}

# Function to analyze performance patterns
analyze_performance_patterns() {
    print_info "Analyzing performance patterns and optimization opportunities..."
    
    local performance_analysis="{\"analysis_type\": \"performance_patterns\""
    
    # Performance metrics over time
    local performance_trends_query="
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) as operations_count,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms,
            MAX(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as max_duration_ms,
            MIN(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as min_duration_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as p95_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND duration IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC;
    "
    
    local performance_data=$(execute_analysis_query "$performance_trends_query" "performance trends analysis")
    
    # Correlation between user type and performance
    local user_type_performance_query="
        SELECT 
            \"targetUserType\",
            COUNT(*) as operations,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms,
            MAX(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as max_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND duration IS NOT NULL
            AND \"targetUserType\" IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY \"targetUserType\"
        ORDER BY avg_duration_ms DESC;
    "
    
    local user_performance_data=$(execute_analysis_query "$user_type_performance_query" "user type performance analysis")
    
    # Time-based performance patterns
    local time_performance_query="
        SELECT 
            EXTRACT(HOUR FROM timestamp) as hour,
            COUNT(*) as operations,
            AVG(CAST(SUBSTRING(duration FROM '[0-9]+') AS INTEGER)) as avg_duration_ms
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND duration IS NOT NULL
            AND timestamp > NOW() - INTERVAL '$(($ANALYSIS_PERIOD / 86400)) days'
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY avg_duration_ms DESC;
    "
    
    local time_performance_data=$(execute_analysis_query "$time_performance_query" "time-based performance analysis")
    
    # Calculate key performance metrics
    local avg_duration=$(echo "$performance_data" | awk '{sum += $3; count++} END {print (count > 0 ? sum/count : 0)}' || echo "0")
    local max_duration=$(echo "$performance_data" | awk 'BEGIN{max=0} {if($4>max) max=$4} END{print max}' || echo "0")
    local total_operations=$(echo "$performance_data" | awk '{sum += $2} END {print sum}' || echo "0")
    
    # Identify slowest user type
    local slowest_user_type="unknown"
    local slowest_avg_duration=0
    
    if [ "$user_performance_data" != "{\"error\": \"query_failed\"}" ]; then
        slowest_user_type=$(echo "$user_performance_data" | head -1 | awk '{print $1}' || echo "unknown")
        slowest_avg_duration=$(echo "$user_performance_data" | head -1 | awk '{print $3}' || echo "0")
    fi
    
    # Identify slowest time period
    local slowest_hour="unknown"
    local slowest_hour_duration=0
    
    if [ "$time_performance_data" != "{\"error\": \"query_failed\"}" ]; then
        slowest_hour=$(echo "$time_performance_data" | head -1 | awk '{print $1}' || echo "unknown")
        slowest_hour_duration=$(echo "$time_performance_data" | head -1 | awk '{print $3}' || echo "0")
    fi
    
    performance_analysis="$performance_analysis,
        \"total_operations_analyzed\": $total_operations,
        \"average_duration_ms\": $avg_duration,
        \"maximum_duration_ms\": $max_duration,
        \"slowest_user_type\": \"$slowest_user_type\",
        \"slowest_user_type_avg_ms\": $slowest_avg_duration,
        \"slowest_hour\": $slowest_hour,
        \"slowest_hour_avg_ms\": $slowest_hour_duration
    }"
    
    # Generate performance insights
    if [ "$total_operations" -gt 0 ]; then
        print_status "Analyzed performance of $total_operations successful operations"
        print_info "Average duration: ${avg_duration}ms, Maximum: ${max_duration}ms"
        
        # Alert on performance issues
        if (( $(echo "$avg_duration > 3000" | bc -l) )); then
            print_warning "Average deletion time exceeds 3 seconds (${avg_duration}ms)"
        fi
        
        if (( $(echo "$max_duration > 10000" | bc -l) )); then
            print_warning "Maximum deletion time exceeds 10 seconds (${max_duration}ms)"
        fi
        
        if [ "$slowest_avg_duration" -gt 0 ]; then
            print_info "Slowest user type: $slowest_user_type (avg: ${slowest_avg_duration}ms)"
            
            if (( $(echo "$slowest_avg_duration > 5000" | bc -l) )); then
                print_warning "User type $slowest_user_type has concerning performance (${slowest_avg_duration}ms)"
            fi
        fi
        
        if [ "$slowest_hour_duration" -gt 0 ] && [ "$slowest_hour" != "unknown" ]; then
            print_info "Slowest performance hour: ${slowest_hour}:00 (avg: ${slowest_hour_duration}ms)"
        fi
    else
        print_info "No performance data available for analysis"
    fi
    
    echo "$performance_analysis"
}

# Function to generate optimization recommendations
generate_optimization_recommendations() {
    local frequency_data="$1"
    local user_type_data="$2"
    local failure_data="$3"
    local performance_data="$4"
    
    print_info "Generating optimization recommendations..."
    
    local recommendations="{"
    
    # Extract key metrics for recommendations
    local total_failures=$(echo "$failure_data" | grep -o '"total_failures": [0-9]*' | cut -d' ' -f2 || echo "0")
    local avg_duration=$(echo "$performance_data" | grep -o '"average_duration_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local max_duration=$(echo "$performance_data" | grep -o '"maximum_duration_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local top_failure=$(echo "$failure_data" | grep -o '"top_failure_category": "[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    # Performance recommendations
    local performance_recommendations="["
    
    if (( $(echo "$avg_duration > 3000" | bc -l) )); then
        performance_recommendations="$performance_recommendations\"Consider database query optimization for complex deletions\","
        performance_recommendations="$performance_recommendations\"Implement deletion operation batching\","
    fi
    
    if (( $(echo "$max_duration > 10000" | bc -l) )); then
        performance_recommendations="$performance_recommendations\"Investigate and optimize slow deletion scenarios\","
        performance_recommendations="$performance_recommendations\"Consider implementing asynchronous deletion for complex operations\","
    fi
    
    # Remove trailing comma and close array
    performance_recommendations=$(echo "$performance_recommendations" | sed 's/,$//')
    performance_recommendations="$performance_recommendations]"
    
    # Failure reduction recommendations
    local failure_recommendations="["
    
    if [ "$total_failures" -gt 10 ]; then
        failure_recommendations="$failure_recommendations\"Implement improved error handling and user feedback\","
        
        case "$top_failure" in
            "timeout")
                failure_recommendations="$failure_recommendations\"Optimize database queries to reduce timeout occurrences\","
                failure_recommendations="$failure_recommendations\"Consider increasing transaction timeout limits\","
                ;;
            "authorization_failure")
                failure_recommendations="$failure_recommendations\"Review and improve authorization documentation\","
                failure_recommendations="$failure_recommendations\"Implement better error messages for authorization failures\","
                ;;
            "active_orders_prevention")
                failure_recommendations="$failure_recommendations\"Implement user-friendly messaging for active orders\","
                failure_recommendations="$failure_recommendations\"Consider workflow to handle order completion before deletion\","
                ;;
        esac
    fi
    
    # Remove trailing comma and close array
    failure_recommendations=$(echo "$failure_recommendations" | sed 's/,$//')
    failure_recommendations="$failure_recommendations]"
    
    # Monitoring recommendations
    local monitoring_recommendations="[
        \"Implement automated performance threshold alerting\",
        \"Set up trending analysis for failure rates\",
        \"Create dashboard for real-time deletion metrics\",
        \"Implement predictive monitoring for peak usage times\"
    ]"
    
    # Operational recommendations
    local operational_recommendations="[
        \"Schedule regular data integrity audits\",
        \"Implement automated cleanup for orphaned records\",
        \"Create user documentation for common deletion scenarios\",
        \"Consider implementing soft deletion for critical user types\"
    ]"
    
    recommendations="$recommendations
        \"performance_optimization\": $performance_recommendations,
        \"failure_reduction\": $failure_recommendations,
        \"monitoring_improvements\": $monitoring_recommendations,
        \"operational_improvements\": $operational_recommendations,
        \"priority_actions\": [
            \"$([ "$total_failures" -gt 20 ] && echo "Address high failure rate immediately" || echo "Continue monitoring current performance")\",
            \"$([ "$(echo "$avg_duration > 5000" | bc -l)" = "1" ] && echo "Optimize slow deletion operations" || echo "Performance appears acceptable")\",
            \"Implement trending analysis for early issue detection\"
        ]
    }"
    
    echo "$recommendations"
}

# Function to generate comprehensive usage pattern report
generate_usage_pattern_report() {
    print_info "Generating comprehensive usage pattern analysis report..."
    
    mkdir -p "$(dirname "$ANALYSIS_REPORT")"
    
    # Perform all analyses
    local frequency_analysis=$(analyze_deletion_frequency)
    local user_type_analysis=$(analyze_user_type_patterns)
    local failure_analysis=$(analyze_failure_scenarios)
    local performance_analysis=$(analyze_performance_patterns)
    local optimization_recommendations=$(generate_optimization_recommendations "$frequency_analysis" "$user_type_analysis" "$failure_analysis" "$performance_analysis")
    
    # Generate comprehensive report
    cat > "$ANALYSIS_REPORT" <<EOF
{
  "usage_pattern_analysis_report": {
    "report_type": "usage_pattern_analysis",
    "analysis_period_days": $(($ANALYSIS_PERIOD / 86400)),
    "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "target_system": "user_deletion_endpoint"
  },
  "deletion_frequency_analysis": $frequency_analysis,
  "user_type_pattern_analysis": $user_type_analysis,
  "failure_scenario_analysis": $failure_analysis,
  "performance_pattern_analysis": $performance_analysis,
  "optimization_recommendations": $optimization_recommendations,
  "key_insights": {
    "usage_summary": "$(echo "$frequency_analysis" | grep -o '"total_deletions": [0-9]*' | cut -d' ' -f2 || echo "0") total deletion operations analyzed",
    "performance_summary": "Average deletion time: $(echo "$performance_analysis" | grep -o '"average_duration_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")ms",
    "reliability_summary": "$(echo "$failure_analysis" | grep -o '"total_failures": [0-9]*' | cut -d' ' -f2 || echo "0") failure scenarios identified",
    "trend_summary": "$(echo "$failure_analysis" | grep -o '"failure_trend_percent_change": [0-9.-]*' | cut -d' ' -f2 || echo "0")% change in failure rate"
  },
  "next_analysis": {
    "recommended_frequency": "weekly",
    "focus_areas": [
      "Monitor implementation of optimization recommendations",
      "Track performance trend changes",
      "Validate effectiveness of failure reduction measures",
      "Analyze user behavior pattern evolution"
    ]
  }
}
EOF
    
    print_status "Usage pattern analysis report generated: $ANALYSIS_REPORT"
    
    # Display key insights summary
    print_header "USAGE PATTERN ANALYSIS SUMMARY"
    
    local total_deletions=$(echo "$frequency_analysis" | grep -o '"total_deletions": [0-9]*' | cut -d' ' -f2 || echo "0")
    local success_rate=$(echo "$frequency_analysis" | grep -o '"success_rate_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local avg_duration=$(echo "$performance_analysis" | grep -o '"average_duration_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local total_failures=$(echo "$failure_analysis" | grep -o '"total_failures": [0-9]*' | cut -d' ' -f2 || echo "0")
    
    print_info "📊 Analysis Overview:"
    print_info "  Period: $(($ANALYSIS_PERIOD / 86400)) days"
    print_info "  Total Operations: $total_deletions"
    print_info "  Success Rate: $success_rate%"
    print_info "  Average Duration: ${avg_duration}ms"
    print_info "  Total Failures: $total_failures"
    
    # Provide actionable insights
    if [ "$total_deletions" -gt 0 ]; then
        if (( $(echo "$success_rate < 95" | bc -l) )); then
            print_warning "Success rate below 95% - investigate failure causes"
        else
            print_status "Success rate is healthy"
        fi
        
        if (( $(echo "$avg_duration > 3000" | bc -l) )); then
            print_warning "Average duration exceeds 3 seconds - optimization recommended"
        else
            print_status "Performance is within acceptable limits"
        fi
    else
        print_info "No usage data available for the analysis period"
    fi
}

# Main execution
main() {
    print_header "USAGE PATTERN ANALYSIS FOR USER DELETION SYSTEM"
    
    print_info "Starting comprehensive usage pattern analysis..."
    print_info "Target: User deletion endpoint usage patterns"
    print_info "Analysis period: $(($ANALYSIS_PERIOD / 86400)) days"
    print_info "Analysis timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Check database connectivity
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    # Generate comprehensive usage pattern report
    generate_usage_pattern_report
    
    print_info ""
    print_info "📈 Complete Analysis Report: $ANALYSIS_REPORT"
}

# Handle script interruption
trap 'print_error "Usage pattern analysis interrupted"; exit 1' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage Pattern Analysis for User Deletion System"
    echo ""
    echo "Usage:"
    echo "  $0                    # Run comprehensive usage pattern analysis"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL          # Database connection string (required)"
    echo "  ANALYSIS_PERIOD       # Analysis period in seconds (default: 2419200 = 4 weeks)"
    echo ""
    echo "Analysis categories:"
    echo "  • Deletion frequency patterns (daily, weekly, hourly)"
    echo "  • User type deletion patterns and performance"
    echo "  • Failure scenario analysis and classification"
    echo "  • Performance pattern analysis and optimization opportunities"
    echo "  • Comprehensive optimization recommendations"
    echo ""
    echo "Outputs:"
    echo "  • Detailed JSON analysis report"
    echo "  • Actionable optimization recommendations"
    echo "  • Performance and reliability insights"
    echo "  • Trend analysis and pattern identification"
    echo ""
    exit 0
fi

# Run main function
main "$@"
