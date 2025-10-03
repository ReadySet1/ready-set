#!/bin/bash

# Immediate Post-Deployment Monitoring Script (24-48 hours)
# This script monitors the user deletion endpoint immediately after production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DURATION="${MONITORING_DURATION:-172800}"  # 48 hours default
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"               # 1 minute default
PROD_APP_URL="${PROD_APP_URL:-https://ready-set.app}"
LOG_DIR="/var/logs/ready-set/monitoring"
METRICS_DIR="/var/logs/ready-set/metrics"
ALERT_LOG="$LOG_DIR/immediate-alerts-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="$METRICS_DIR/immediate-metrics-$(date +%Y%m%d-%H%M%S).json"

# Thresholds for immediate monitoring
ERROR_RATE_THRESHOLD=1.0      # 1% error rate threshold
RESPONSE_TIME_THRESHOLD=3000  # 3 seconds response time threshold
TIMEOUT_THRESHOLD=5           # 5 timeouts per hour threshold
MEMORY_INCREASE_THRESHOLD=20  # 20% memory increase threshold

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ OK]${NC} $1"
    log_message "OK: $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARN]${NC} $1"
    log_message "WARN: $1"
}

print_error() {
    echo -e "${RED}[❌ ERROR]${NC} $1"
    log_message "ERROR: $1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
    log_message "INFO: $1"
}

print_critical() {
    echo -e "${PURPLE}[🚨 CRITICAL]${NC} $1"
    log_message "CRITICAL: $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
    log_message "HEADER: $1"
}

# Function to log messages
log_message() {
    mkdir -p "$LOG_DIR"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$ALERT_LOG"
}

# Function to send critical alerts
send_critical_alert() {
    local metric=$1
    local value=$2
    local threshold=$3
    local message="🚨 CRITICAL: $metric exceeded threshold - Value: $value, Threshold: $threshold"
    
    print_critical "$message"
    
    # Log critical alert
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] CRITICAL_ALERT: $message" >> "$ALERT_LOG"
    
    # Integration with alerting systems (customize as needed)
    # Slack
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"$message\"}" \
    #     "$SLACK_WEBHOOK_URL"
    
    # PagerDuty
    # curl -X POST -H "Content-Type: application/json" \
    #     -d "{\"routing_key\":\"$PAGERDUTY_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"$message\",\"severity\":\"critical\",\"source\":\"user-deletion-monitoring\"}}" \
    #     https://events.pagerduty.com/v2/enqueue
}

# Function to query database for deletion metrics
query_deletion_metrics() {
    local time_window="${1:-3600}"  # Default 1 hour window
    local metrics_json=""
    
    if [ -n "$DATABASE_URL" ]; then
        # Parse database connection details
        if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
            local db_user="${BASH_REMATCH[1]}"
            local db_password="${BASH_REMATCH[2]}"
            local db_host="${BASH_REMATCH[3]}"
            local db_port="${BASH_REMATCH[4]}"
            local db_name="${BASH_REMATCH[5]%%\?*}"
            
            export PGPASSWORD="$db_password"
            
            # Query deletion metrics from audit logs
            local query="
                SELECT 
                    COUNT(*) as total_deletions,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful_deletions,
                    COUNT(CASE WHEN success = false THEN 1 END) as failed_deletions,
                    AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) * 1000) as avg_response_time_ms,
                    COUNT(CASE WHEN error LIKE '%timeout%' THEN 1 END) as timeout_errors,
                    COUNT(CASE WHEN error LIKE '%P2025%' THEN 1 END) as not_found_errors,
                    COUNT(CASE WHEN error LIKE '%P2003%' THEN 1 END) as constraint_errors
                FROM audit_logs 
                WHERE action = 'USER_DELETION' 
                    AND timestamp > NOW() - INTERVAL '$time_window seconds';
            "
            
            if result=$(psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "$query" 2>/dev/null); then
                # Parse result and create JSON
                local total_deletions=$(echo "$result" | awk '{print $1}' | head -1)
                local successful_deletions=$(echo "$result" | awk '{print $2}' | head -1)
                local failed_deletions=$(echo "$result" | awk '{print $3}' | head -1)
                local avg_response_time=$(echo "$result" | awk '{print $4}' | head -1)
                local timeout_errors=$(echo "$result" | awk '{print $5}' | head -1)
                local not_found_errors=$(echo "$result" | awk '{print $6}' | head -1)
                local constraint_errors=$(echo "$result" | awk '{print $7}' | head -1)
                
                # Handle null/empty values
                total_deletions=${total_deletions:-0}
                successful_deletions=${successful_deletions:-0}
                failed_deletions=${failed_deletions:-0}
                avg_response_time=${avg_response_time:-0}
                timeout_errors=${timeout_errors:-0}
                not_found_errors=${not_found_errors:-0}
                constraint_errors=${constraint_errors:-0}
                
                # Calculate error rate
                local error_rate=0
                if [ "$total_deletions" -gt 0 ]; then
                    error_rate=$(echo "scale=2; $failed_deletions * 100 / $total_deletions" | bc 2>/dev/null || echo "0")
                fi
                
                metrics_json="{
                    \"total_deletions\": $total_deletions,
                    \"successful_deletions\": $successful_deletions,
                    \"failed_deletions\": $failed_deletions,
                    \"error_rate_percent\": $error_rate,
                    \"avg_response_time_ms\": $avg_response_time,
                    \"timeout_errors\": $timeout_errors,
                    \"not_found_errors\": $not_found_errors,
                    \"constraint_errors\": $constraint_errors,
                    \"time_window_seconds\": $time_window
                }"
            else
                print_warning "Could not query database metrics"
                metrics_json="{\"error\": \"database_query_failed\"}"
            fi
        else
            print_warning "Could not parse DATABASE_URL"
            metrics_json="{\"error\": \"invalid_database_url\"}"
        fi
    else
        print_warning "DATABASE_URL not configured"
        metrics_json="{\"error\": \"no_database_url\"}"
    fi
    
    echo "$metrics_json"
}

# Function to check application health and performance
check_application_performance() {
    local app_metrics=""
    
    # Test endpoint response time
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "%{http_code},%{time_total},%{size_download}" -o /dev/null \
        "$PROD_APP_URL/api/health" 2>/dev/null || echo "000,0,0")
    local end_time=$(date +%s%3N)
    
    local http_code=$(echo "$response" | cut -d',' -f1)
    local curl_time=$(echo "$response" | cut -d',' -f2)
    local response_size=$(echo "$response" | cut -d',' -f3)
    local total_time=$((end_time - start_time))
    
    # Test user deletion endpoint (expect 401/400)
    local deletion_start_time=$(date +%s%3N)
    local deletion_response=$(curl -s -w "%{http_code},%{time_total}" -o /dev/null \
        -X DELETE "$PROD_APP_URL/api/users/monitoring-test-user" \
        -H "Authorization: Bearer monitoring-test-token" 2>/dev/null || echo "000,0")
    local deletion_end_time=$(date +%s%3N)
    
    local deletion_http_code=$(echo "$deletion_response" | cut -d',' -f1)
    local deletion_curl_time=$(echo "$deletion_response" | cut -d',' -f2)
    local deletion_total_time=$((deletion_end_time - deletion_start_time))
    
    app_metrics="{
        \"health_endpoint\": {
            \"http_code\": \"$http_code\",
            \"response_time_ms\": $total_time,
            \"curl_time_seconds\": $curl_time,
            \"response_size_bytes\": $response_size,
            \"status\": \"$([ "$http_code" = "200" ] && echo "healthy" || echo "unhealthy")\"
        },
        \"deletion_endpoint\": {
            \"http_code\": \"$deletion_http_code\",
            \"response_time_ms\": $deletion_total_time,
            \"curl_time_seconds\": $deletion_curl_time,
            \"status\": \"$([ "$deletion_http_code" = "401" ] || [ "$deletion_http_code" = "400" ] && echo "secure" || echo "concerning")\"
        }
    }"
    
    echo "$app_metrics"
}

# Function to check system resources
check_system_resources() {
    local cpu_usage=0
    local memory_usage=0
    local memory_used_mb=0
    local memory_total_mb=0
    local disk_usage=0
    local load_average="0.0"
    
    # CPU usage
    if command -v top >/dev/null 2>&1; then
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//' 2>/dev/null || echo "0")
    fi
    
    # Memory usage  
    if command -v free >/dev/null 2>&1; then
        local mem_info=$(free -m | grep Mem)
        memory_total_mb=$(echo "$mem_info" | awk '{print $2}')
        memory_used_mb=$(echo "$mem_info" | awk '{print $3}')
        memory_usage=$(echo "scale=1; $memory_used_mb * 100 / $memory_total_mb" | bc 2>/dev/null || echo "0")
    fi
    
    # Disk usage
    if command -v df >/dev/null 2>&1; then
        disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//' 2>/dev/null || echo "0")
    fi
    
    # Load average
    if [ -f /proc/loadavg ]; then
        load_average=$(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo "0.0")
    fi
    
    local system_metrics="{
        \"cpu_usage_percent\": $cpu_usage,
        \"memory_usage_percent\": $memory_usage,
        \"memory_used_mb\": $memory_used_mb,
        \"memory_total_mb\": $memory_total_mb,
        \"disk_usage_percent\": $disk_usage,
        \"load_average_1min\": $load_average
    }"
    
    echo "$system_metrics"
}

# Function to analyze and alert on metrics
analyze_metrics() {
    local deletion_metrics="$1"
    local app_metrics="$2"
    local system_metrics="$3"
    local timestamp="$4"
    
    # Extract key values for analysis
    local error_rate=$(echo "$deletion_metrics" | grep -o '"error_rate_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local avg_response_time=$(echo "$deletion_metrics" | grep -o '"avg_response_time_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local timeout_errors=$(echo "$deletion_metrics" | grep -o '"timeout_errors": [0-9]*' | cut -d' ' -f2 || echo "0")
    local memory_usage=$(echo "$system_metrics" | grep -o '"memory_usage_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local app_response_time=$(echo "$app_metrics" | grep -o '"response_time_ms": [0-9]*' | head -1 | cut -d' ' -f2 || echo "0")
    
    # Check error rate threshold
    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        send_critical_alert "Error Rate" "$error_rate%" "${ERROR_RATE_THRESHOLD}%"
    fi
    
    # Check response time threshold
    if [ "$avg_response_time" != "0" ] && [ "$avg_response_time" != "" ]; then
        if (( $(echo "$avg_response_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
            send_critical_alert "Average Response Time" "${avg_response_time}ms" "${RESPONSE_TIME_THRESHOLD}ms"
        fi
    fi
    
    # Check timeout errors
    if [ "$timeout_errors" -gt "$TIMEOUT_THRESHOLD" ]; then
        send_critical_alert "Timeout Errors" "$timeout_errors" "$TIMEOUT_THRESHOLD"
    fi
    
    # Check memory usage
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        send_critical_alert "Memory Usage" "$memory_usage%" "90%"
    elif (( $(echo "$memory_usage > 80" | bc -l) )); then
        print_warning "Memory usage high: $memory_usage%"
    fi
    
    # Check application response time
    if [ "$app_response_time" -gt "5000" ]; then  # 5 seconds
        send_critical_alert "Application Response Time" "${app_response_time}ms" "5000ms"
    fi
}

# Function to record comprehensive metrics
record_comprehensive_metrics() {
    local timestamp="$1"
    local deletion_metrics="$2"
    local app_metrics="$3"
    local system_metrics="$4"
    
    mkdir -p "$METRICS_DIR"
    
    # Create comprehensive metrics entry
    cat >> "$METRICS_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "monitoring_type": "immediate_post_deployment",
  "deletion_metrics": $deletion_metrics,
  "application_metrics": $app_metrics,
  "system_metrics": $system_metrics,
  "thresholds": {
    "error_rate_threshold_percent": $ERROR_RATE_THRESHOLD,
    "response_time_threshold_ms": $RESPONSE_TIME_THRESHOLD,
    "timeout_threshold_per_hour": $TIMEOUT_THRESHOLD,
    "memory_threshold_percent": 90
  }
},
EOF
}

# Function to display monitoring dashboard
display_monitoring_dashboard() {
    local timestamp="$1"
    local deletion_metrics="$2"
    local app_metrics="$3"
    local system_metrics="$4"
    local check_count="$5"
    local elapsed_hours="$6"
    
    # Clear screen and display dashboard
    clear
    
    print_header "IMMEDIATE POST-DEPLOYMENT MONITORING - USER DELETION ENDPOINT"
    
    echo -e "${BLUE}Timestamp:${NC} $timestamp"
    echo -e "${BLUE}Monitoring Duration:${NC} $MONITORING_DURATION seconds ($(($MONITORING_DURATION / 3600)) hours)"
    echo -e "${BLUE}Elapsed Time:${NC} ${elapsed_hours} hours"
    echo -e "${BLUE}Check Count:${NC} $check_count"
    echo -e "${BLUE}Application URL:${NC} $PROD_APP_URL"
    echo ""
    
    # Deletion Metrics
    echo -e "${BLUE}🗑️  USER DELETION METRICS (Last Hour)${NC}"
    local total_deletions=$(echo "$deletion_metrics" | grep -o '"total_deletions": [0-9]*' | cut -d' ' -f2 || echo "0")
    local successful_deletions=$(echo "$deletion_metrics" | grep -o '"successful_deletions": [0-9]*' | cut -d' ' -f2 || echo "0")
    local failed_deletions=$(echo "$deletion_metrics" | grep -o '"failed_deletions": [0-9]*' | cut -d' ' -f2 || echo "0")
    local error_rate=$(echo "$deletion_metrics" | grep -o '"error_rate_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local avg_response_time=$(echo "$deletion_metrics" | grep -o '"avg_response_time_ms": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local timeout_errors=$(echo "$deletion_metrics" | grep -o '"timeout_errors": [0-9]*' | cut -d' ' -f2 || echo "0")
    
    echo -e "  Total Deletions: $total_deletions"
    echo -e "  Successful: ${GREEN}$successful_deletions${NC}"
    echo -e "  Failed: $([ "$failed_deletions" -gt 0 ] && echo "${RED}$failed_deletions${NC}" || echo "$failed_deletions")"
    
    # Error rate with color coding
    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        echo -e "  Error Rate: ${RED}$error_rate%${NC} (CRITICAL)"
    elif (( $(echo "$error_rate > 0.5" | bc -l) )); then
        echo -e "  Error Rate: ${YELLOW}$error_rate%${NC} (Warning)"
    else
        echo -e "  Error Rate: ${GREEN}$error_rate%${NC} (OK)"
    fi
    
    echo -e "  Avg Response Time: ${avg_response_time}ms"
    echo -e "  Timeout Errors: $([ "$timeout_errors" -gt "$TIMEOUT_THRESHOLD" ] && echo "${RED}$timeout_errors${NC}" || echo "$timeout_errors")"
    echo ""
    
    # Application Health
    echo -e "${BLUE}📱 APPLICATION HEALTH${NC}"
    local health_status=$(echo "$app_metrics" | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
    local app_response_time=$(echo "$app_metrics" | grep -o '"response_time_ms": [0-9]*' | head -1 | cut -d' ' -f2 || echo "0")
    
    if [ "$health_status" = "healthy" ]; then
        echo -e "  Health Status: ${GREEN}✅ $health_status${NC}"
    else
        echo -e "  Health Status: ${RED}❌ $health_status${NC}"
    fi
    echo -e "  Response Time: ${app_response_time}ms"
    echo ""
    
    # System Resources
    echo -e "${BLUE}💻 SYSTEM RESOURCES${NC}"
    local memory_usage=$(echo "$system_metrics" | grep -o '"memory_usage_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local cpu_usage=$(echo "$system_metrics" | grep -o '"cpu_usage_percent": [0-9.]*' | cut -d' ' -f2 || echo "0")
    local disk_usage=$(echo "$system_metrics" | grep -o '"disk_usage_percent": [0-9]*' | cut -d' ' -f2 || echo "0")
    local load_average=$(echo "$system_metrics" | grep -o '"load_average_1min": [0-9.]*' | cut -d' ' -f2 || echo "0.0")
    
    # Memory with color coding
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        echo -e "  Memory Usage: ${RED}$memory_usage%${NC} (Critical)"
    elif (( $(echo "$memory_usage > 80" | bc -l) )); then
        echo -e "  Memory Usage: ${YELLOW}$memory_usage%${NC} (Warning)"
    else
        echo -e "  Memory Usage: ${GREEN}$memory_usage%${NC} (OK)"
    fi
    
    echo -e "  CPU Usage: $cpu_usage%"
    echo -e "  Disk Usage: $disk_usage%"
    echo -e "  Load Average: $load_average"
    echo ""
    
    # Recent Alerts
    echo -e "${BLUE}🚨 RECENT ALERTS (Last 5)${NC}"
    if [ -f "$ALERT_LOG" ]; then
        tail -n 5 "$ALERT_LOG" | grep "CRITICAL_ALERT" | tail -n 3 || echo "  No critical alerts"
    else
        echo "  No alerts logged yet"
    fi
    echo ""
    
    # Instructions
    echo -e "${BLUE}📋 MONITORING STATUS${NC}"
    echo "  Press Ctrl+C to stop monitoring"
    echo "  Logs: $ALERT_LOG"
    echo "  Metrics: $METRICS_FILE"
    echo "  Next check in: $CHECK_INTERVAL seconds"
}

# Main monitoring loop
main_monitoring_loop() {
    print_info "Starting immediate post-deployment monitoring..."
    print_info "Duration: $MONITORING_DURATION seconds ($(($MONITORING_DURATION / 3600)) hours)"
    print_info "Check interval: $CHECK_INTERVAL seconds"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITORING_DURATION))
    local check_count=0
    
    # Initialize metrics file
    echo "[" > "$METRICS_FILE"
    
    while [ $(date +%s) -lt $end_time ]; do
        local current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        local elapsed_seconds=$(( $(date +%s) - start_time ))
        local elapsed_hours=$(echo "scale=1; $elapsed_seconds / 3600" | bc)
        ((check_count++))
        
        # Collect all metrics
        local deletion_metrics=$(query_deletion_metrics 3600)  # Last hour
        local app_metrics=$(check_application_performance)
        local system_metrics=$(check_system_resources)
        
        # Analyze metrics and send alerts if needed
        analyze_metrics "$deletion_metrics" "$app_metrics" "$system_metrics" "$current_time"
        
        # Record metrics
        record_comprehensive_metrics "$current_time" "$deletion_metrics" "$app_metrics" "$system_metrics"
        
        # Display dashboard
        display_monitoring_dashboard "$current_time" "$deletion_metrics" "$app_metrics" "$system_metrics" "$check_count" "$elapsed_hours"
        
        # Sleep until next check
        sleep $CHECK_INTERVAL
    done
    
    # Close metrics JSON file
    sed -i '$ s/,$//' "$METRICS_FILE" 2>/dev/null || true
    echo "]" >> "$METRICS_FILE"
    
    print_header "IMMEDIATE MONITORING COMPLETED"
    
    local total_hours=$(($MONITORING_DURATION / 3600))
    print_info "Immediate monitoring completed after $total_hours hours"
    print_info "Total checks performed: $check_count"
    print_info "Complete logs: $ALERT_LOG"
    print_info "Metrics data: $METRICS_FILE"
    
    # Generate summary report
    generate_monitoring_summary
}

# Function to generate monitoring summary
generate_monitoring_summary() {
    local summary_file="$LOG_DIR/immediate-monitoring-summary-$(date +%Y%m%d-%H%M%S).json"
    
    print_info "Generating monitoring summary..."
    
    # Get final metrics
    local final_deletion_metrics=$(query_deletion_metrics $MONITORING_DURATION)
    local critical_alerts_count=$(grep -c "CRITICAL_ALERT" "$ALERT_LOG" 2>/dev/null || echo "0")
    
    cat > "$summary_file" <<EOF
{
  "monitoring_summary": {
    "monitoring_type": "immediate_post_deployment",
    "duration_hours": $(($MONITORING_DURATION / 3600)),
    "completed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "total_checks": "$(grep -c '"timestamp"' "$METRICS_FILE" 2>/dev/null || echo "0")",
    "critical_alerts": $critical_alerts_count
  },
  "final_metrics": $final_deletion_metrics,
  "files": {
    "alert_log": "$ALERT_LOG",
    "metrics_file": "$METRICS_FILE",
    "summary_file": "$summary_file"
  },
  "next_steps": [
    "Review critical alerts if any were generated",
    "Analyze trends in the metrics file",
    "Proceed to long-term monitoring phase",
    "Schedule data integrity audits"
  ]
}
EOF
    
    print_status "Monitoring summary saved to: $summary_file"
    
    if [ "$critical_alerts_count" -gt 0 ]; then
        print_warning "$critical_alerts_count critical alerts were generated during monitoring"
        print_warning "Please review the alert log: $ALERT_LOG"
    else
        print_status "No critical alerts generated - system appears stable"
    fi
}

# Main execution
main() {
    print_header "IMMEDIATE POST-DEPLOYMENT MONITORING"
    
    print_info "Initializing immediate monitoring for user deletion endpoint..."
    print_info "Target: User deletion endpoint (DELETE /api/users/[userId])"
    print_info "Environment: Production"
    print_info "Application URL: $PROD_APP_URL"
    
    # Validate prerequisites
    if ! command -v curl >/dev/null 2>&1; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v bc >/dev/null 2>&1; then
        print_error "bc is required for calculations but not installed"
        exit 1
    fi
    
    # Create directories
    mkdir -p "$LOG_DIR" "$METRICS_DIR"
    
    # Start monitoring
    main_monitoring_loop
}

# Handle script interruption
trap 'print_warning "Immediate monitoring interrupted by user"; generate_monitoring_summary; exit 0' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Immediate Post-Deployment Monitoring for User Deletion Endpoint"
    echo ""
    echo "Usage:"
    echo "  $0                    # Start 48-hour monitoring with default settings"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  MONITORING_DURATION   # Duration in seconds (default: 172800 = 48 hours)"
    echo "  CHECK_INTERVAL        # Check interval in seconds (default: 60)"
    echo "  PROD_APP_URL          # Production application URL"
    echo "  DATABASE_URL          # Database connection string"
    echo ""
    echo "Monitoring thresholds:"
    echo "  ERROR_RATE_THRESHOLD  # Error rate threshold (default: 1%)"
    echo "  RESPONSE_TIME_THRESHOLD # Response time threshold (default: 3000ms)"
    echo "  TIMEOUT_THRESHOLD     # Timeout errors per hour (default: 5)"
    echo ""
    exit 0
fi

# Run main function
main "$@"
