#!/bin/bash

# Production Deployment Monitor for User Deletion Endpoint
# This script monitors the deployment and provides real-time health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROD_APP_URL="${PROD_APP_URL:-https://ready-set.app}"
MONITORING_DURATION="${MONITORING_DURATION:-3600}"  # 1 hour default
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"              # 30 seconds
LOG_FILE="/var/logs/ready-set/deployment-monitor-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="/var/logs/ready-set/deployment-metrics-$(date +%Y%m%d-%H%M%S).json"

# Thresholds
ERROR_RATE_WARNING=0.5    # 0.5% error rate warning
ERROR_RATE_CRITICAL=2.0   # 2% error rate critical
RESPONSE_TIME_WARNING=5.0 # 5 seconds warning
RESPONSE_TIME_CRITICAL=10.0 # 10 seconds critical
MEMORY_WARNING=80         # 80% memory usage warning
MEMORY_CRITICAL=90        # 90% memory usage critical

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
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$LOG_FILE"
}

# Function to send alerts
send_alert() {
    local severity=$1
    local metric=$2
    local value=$3
    local threshold=$4
    local message="$metric: $value (threshold: $threshold)"
    
    print_info "ALERT [$severity]: $message"
    log_message "ALERT [$severity]: $message"
    
    # Integrate with your alerting system here
    # Examples:
    
    # Slack
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"🚨 DEPLOYMENT ALERT [$severity]: $message\"}" \
    #     "$SLACK_WEBHOOK_URL"
    
    # Email
    # echo "$message" | mail -s "DEPLOYMENT ALERT [$severity]" "$ALERT_EMAIL"
    
    # PagerDuty
    # curl -X POST -H "Content-Type: application/json" \
    #     -d '{"routing_key":"'$PAGERDUTY_KEY'","event_action":"trigger","payload":{"summary":"'$message'","severity":"'$severity'"}}' \
    #     https://events.pagerduty.com/v2/enqueue
}

# Function to check application health
check_application_health() {
    local start_time=$(date +%s%3N)  # milliseconds
    local health_status="UNKNOWN"
    local response_time=0
    
    if response=$(curl -s -w "%{http_code},%{time_total}" -o /dev/null "$PROD_APP_URL/api/health" 2>/dev/null); then
        local http_code=$(echo "$response" | cut -d',' -f1)
        local time_total=$(echo "$response" | cut -d',' -f2)
        
        response_time=$(echo "$time_total * 1000" | bc 2>/dev/null || echo "0")  # Convert to ms
        
        if [ "$http_code" = "200" ]; then
            health_status="HEALTHY"
            
            # Check response time thresholds
            if (( $(echo "$time_total > $RESPONSE_TIME_CRITICAL" | bc -l) )); then
                send_alert "CRITICAL" "Response Time" "${time_total}s" "${RESPONSE_TIME_CRITICAL}s"
            elif (( $(echo "$time_total > $RESPONSE_TIME_WARNING" | bc -l) )); then
                send_alert "WARNING" "Response Time" "${time_total}s" "${RESPONSE_TIME_WARNING}s"
            fi
        else
            health_status="UNHEALTHY"
            send_alert "CRITICAL" "Health Check" "HTTP $http_code" "HTTP 200"
        fi
    else
        health_status="UNREACHABLE"
        send_alert "CRITICAL" "Health Check" "Connection Failed" "HTTP 200"
    fi
    
    echo "$health_status,$response_time"
}

# Function to check user deletion endpoint specifically
check_user_deletion_endpoint() {
    local start_time=$(date +%s%3N)
    local endpoint_status="UNKNOWN"
    local response_time=0
    
    # Test with invalid auth (should get 401, not 500)
    if response=$(curl -s -w "%{http_code},%{time_total}" -o /dev/null \
        -X DELETE "$PROD_APP_URL/api/users/test-user-id" \
        -H "Authorization: Bearer invalid-token" 2>/dev/null); then
        
        local http_code=$(echo "$response" | cut -d',' -f1)
        local time_total=$(echo "$response" | cut -d',' -f2)
        
        response_time=$(echo "$time_total * 1000" | bc 2>/dev/null || echo "0")
        
        if [ "$http_code" = "401" ] || [ "$http_code" = "400" ]; then
            endpoint_status="HEALTHY"
        elif [ "$http_code" = "500" ]; then
            endpoint_status="ERROR"
            send_alert "CRITICAL" "User Deletion Endpoint" "HTTP 500" "HTTP 401/400"
        else
            endpoint_status="UNEXPECTED"
            send_alert "WARNING" "User Deletion Endpoint" "HTTP $http_code" "HTTP 401/400"
        fi
    else
        endpoint_status="UNREACHABLE"
        send_alert "CRITICAL" "User Deletion Endpoint" "Connection Failed" "HTTP 401/400"
    fi
    
    echo "$endpoint_status,$response_time"
}

# Function to check database performance
check_database_performance() {
    local db_status="UNKNOWN"
    local query_time=0
    
    if [ -n "$DATABASE_URL" ]; then
        local start_time=$(date +%s%3N)
        
        # Simple database connectivity test
        if timeout 10 pnpm prisma db push --preview-feature >/dev/null 2>&1; then
            local end_time=$(date +%s%3N)
            query_time=$((end_time - start_time))
            
            db_status="HEALTHY"
            
            # Check if query time is concerning (>2 seconds for simple operation)
            if [ $query_time -gt 2000 ]; then
                send_alert "WARNING" "Database Query Time" "${query_time}ms" "2000ms"
            fi
        else
            db_status="UNHEALTHY"
            send_alert "CRITICAL" "Database Connectivity" "Connection Failed" "Connection Success"
        fi
    else
        db_status="NO_CONFIG"
        print_warning "DATABASE_URL not configured - skipping database checks"
    fi
    
    echo "$db_status,$query_time"
}

# Function to check system resources
check_system_resources() {
    local cpu_usage=0
    local memory_usage=0
    local disk_usage=0
    
    # CPU usage (if available)
    if command -v top >/dev/null 2>&1; then
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//' 2>/dev/null || echo "0")
    fi
    
    # Memory usage
    if command -v free >/dev/null 2>&1; then
        memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' 2>/dev/null || echo "0")
        
        if (( $(echo "$memory_usage > $MEMORY_CRITICAL" | bc -l) )); then
            send_alert "CRITICAL" "Memory Usage" "${memory_usage}%" "${MEMORY_CRITICAL}%"
        elif (( $(echo "$memory_usage > $MEMORY_WARNING" | bc -l) )); then
            send_alert "WARNING" "Memory Usage" "${memory_usage}%" "${MEMORY_WARNING}%"
        fi
    fi
    
    # Disk usage
    if command -v df >/dev/null 2>&1; then
        disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//' 2>/dev/null || echo "0")
        
        if [ "$disk_usage" -gt 90 ]; then
            send_alert "CRITICAL" "Disk Usage" "${disk_usage}%" "90%"
        elif [ "$disk_usage" -gt 80 ]; then
            send_alert "WARNING" "Disk Usage" "${disk_usage}%" "80%"
        fi
    fi
    
    echo "$cpu_usage,$memory_usage,$disk_usage"
}

# Function to calculate error rates
calculate_error_rates() {
    local total_requests=${1:-0}
    local error_requests=${2:-0}
    local error_rate=0
    
    if [ "$total_requests" -gt 0 ]; then
        error_rate=$(echo "scale=2; $error_requests * 100 / $total_requests" | bc 2>/dev/null || echo "0")
        
        if (( $(echo "$error_rate > $ERROR_RATE_CRITICAL" | bc -l) )); then
            send_alert "CRITICAL" "Error Rate" "${error_rate}%" "${ERROR_RATE_CRITICAL}%"
        elif (( $(echo "$error_rate > $ERROR_RATE_WARNING" | bc -l) )); then
            send_alert "WARNING" "Error Rate" "${error_rate}%" "${ERROR_RATE_WARNING}%"
        fi
    fi
    
    echo "$error_rate"
}

# Function to record metrics
record_metrics() {
    local timestamp="$1"
    local app_health="$2"
    local app_response_time="$3"
    local endpoint_health="$4"
    local endpoint_response_time="$5"
    local db_status="$6"
    local db_query_time="$7"
    local cpu_usage="$8"
    local memory_usage="$9"
    local disk_usage="${10}"
    local error_rate="${11}"
    
    mkdir -p "$(dirname "$METRICS_FILE")"
    
    # Append metrics to JSON file
    cat >> "$METRICS_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "application": {
    "health_status": "$app_health",
    "response_time_ms": $app_response_time
  },
  "user_deletion_endpoint": {
    "health_status": "$endpoint_health", 
    "response_time_ms": $endpoint_response_time
  },
  "database": {
    "status": "$db_status",
    "query_time_ms": $db_query_time
  },
  "system": {
    "cpu_usage_percent": $cpu_usage,
    "memory_usage_percent": $memory_usage,
    "disk_usage_percent": $disk_usage
  },
  "metrics": {
    "error_rate_percent": $error_rate
  }
},
EOF
}

# Function to display real-time dashboard
display_dashboard() {
    local timestamp="$1"
    local app_health="$2"
    local app_response_time="$3"
    local endpoint_health="$4"
    local endpoint_response_time="$5"
    local db_status="$6"
    local db_query_time="$7"
    local cpu_usage="$8"
    local memory_usage="$9"
    local disk_usage="${10}"
    local error_rate="${11}"
    
    # Clear screen and show dashboard
    clear
    
    print_header "PRODUCTION DEPLOYMENT MONITOR - USER DELETION ENDPOINT"
    
    echo -e "${BLUE}Timestamp:${NC} $timestamp"
    echo -e "${BLUE}Application URL:${NC} $PROD_APP_URL"
    echo -e "${BLUE}Monitor Duration:${NC} $MONITORING_DURATION seconds"
    echo ""
    
    # Application Health
    echo -e "${BLUE}📱 APPLICATION HEALTH${NC}"
    if [ "$app_health" = "HEALTHY" ]; then
        echo -e "  Status: ${GREEN}✅ $app_health${NC}"
    else
        echo -e "  Status: ${RED}❌ $app_health${NC}"
    fi
    echo -e "  Response Time: ${app_response_time}ms"
    echo ""
    
    # User Deletion Endpoint
    echo -e "${BLUE}🗑️  USER DELETION ENDPOINT${NC}"
    if [ "$endpoint_health" = "HEALTHY" ]; then
        echo -e "  Status: ${GREEN}✅ $endpoint_health${NC}"
    else
        echo -e "  Status: ${RED}❌ $endpoint_health${NC}"
    fi
    echo -e "  Response Time: ${endpoint_response_time}ms"
    echo ""
    
    # Database
    echo -e "${BLUE}🗄️  DATABASE${NC}"
    if [ "$db_status" = "HEALTHY" ]; then
        echo -e "  Status: ${GREEN}✅ $db_status${NC}"
    else
        echo -e "  Status: ${RED}❌ $db_status${NC}"
    fi
    echo -e "  Query Time: ${db_query_time}ms"
    echo ""
    
    # System Resources
    echo -e "${BLUE}💻 SYSTEM RESOURCES${NC}"
    
    # Memory usage with color coding
    if (( $(echo "$memory_usage > $MEMORY_CRITICAL" | bc -l) )); then
        echo -e "  Memory: ${RED}$memory_usage%${NC} (Critical)"
    elif (( $(echo "$memory_usage > $MEMORY_WARNING" | bc -l) )); then
        echo -e "  Memory: ${YELLOW}$memory_usage%${NC} (Warning)"
    else
        echo -e "  Memory: ${GREEN}$memory_usage%${NC} (OK)"
    fi
    
    # Disk usage with color coding
    if [ "${disk_usage%.*}" -gt 90 ]; then
        echo -e "  Disk: ${RED}$disk_usage%${NC} (Critical)"
    elif [ "${disk_usage%.*}" -gt 80 ]; then
        echo -e "  Disk: ${YELLOW}$disk_usage%${NC} (Warning)"
    else
        echo -e "  Disk: ${GREEN}$disk_usage%${NC} (OK)"
    fi
    
    echo -e "  CPU: $cpu_usage%"
    echo ""
    
    # Error Rates
    echo -e "${BLUE}📊 METRICS${NC}"
    if (( $(echo "$error_rate > $ERROR_RATE_CRITICAL" | bc -l) )); then
        echo -e "  Error Rate: ${RED}$error_rate%${NC} (Critical)"
    elif (( $(echo "$error_rate > $ERROR_RATE_WARNING" | bc -l) )); then
        echo -e "  Error Rate: ${YELLOW}$error_rate%${NC} (Warning)"
    else
        echo -e "  Error Rate: ${GREEN}$error_rate%${NC} (OK)"
    fi
    echo ""
    
    # Actions
    echo -e "${BLUE}🔧 ACTIONS${NC}"
    echo "  Press Ctrl+C to stop monitoring"
    echo "  Logs: $LOG_FILE"
    echo "  Metrics: $METRICS_FILE"
    echo ""
    
    # Recent alerts (last 5)
    if [ -f "$LOG_FILE" ]; then
        echo -e "${BLUE}🚨 RECENT ALERTS${NC}"
        tail -n 5 "$LOG_FILE" | grep "ALERT" | tail -n 3 || echo "  No recent alerts"
    fi
}

# Function to monitor deployment
monitor_deployment() {
    print_info "Starting production deployment monitoring..."
    print_info "Duration: $MONITORING_DURATION seconds"
    print_info "Check interval: $CHECK_INTERVAL seconds"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITORING_DURATION))
    local check_count=0
    local error_count=0
    
    # Initialize metrics file
    echo "[" > "$METRICS_FILE"
    
    while [ $(date +%s) -lt $end_time ]; do
        local current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        ((check_count++))
        
        # Perform health checks
        local app_check=$(check_application_health)
        local app_health=$(echo "$app_check" | cut -d',' -f1)
        local app_response_time=$(echo "$app_check" | cut -d',' -f2)
        
        local endpoint_check=$(check_user_deletion_endpoint)
        local endpoint_health=$(echo "$endpoint_check" | cut -d',' -f1)
        local endpoint_response_time=$(echo "$endpoint_check" | cut -d',' -f2)
        
        local db_check=$(check_database_performance)
        local db_status=$(echo "$db_check" | cut -d',' -f1)
        local db_query_time=$(echo "$db_check" | cut -d',' -f2)
        
        local resource_check=$(check_system_resources)
        local cpu_usage=$(echo "$resource_check" | cut -d',' -f1)
        local memory_usage=$(echo "$resource_check" | cut -d',' -f2)
        local disk_usage=$(echo "$resource_check" | cut -d',' -f3)
        
        # Calculate error rate
        if [ "$app_health" != "HEALTHY" ] || [ "$endpoint_health" != "HEALTHY" ]; then
            ((error_count++))
        fi
        
        local error_rate=$(calculate_error_rates $check_count $error_count)
        
        # Record metrics
        record_metrics "$current_time" "$app_health" "$app_response_time" \
            "$endpoint_health" "$endpoint_response_time" "$db_status" "$db_query_time" \
            "$cpu_usage" "$memory_usage" "$disk_usage" "$error_rate"
        
        # Display dashboard
        display_dashboard "$current_time" "$app_health" "$app_response_time" \
            "$endpoint_health" "$endpoint_response_time" "$db_status" "$db_query_time" \
            "$cpu_usage" "$memory_usage" "$disk_usage" "$error_rate"
        
        # Sleep until next check
        sleep $CHECK_INTERVAL
    done
    
    # Close metrics JSON file
    sed -i '$ s/,$//' "$METRICS_FILE" 2>/dev/null  # Remove last comma
    echo "]" >> "$METRICS_FILE"
    
    print_header "MONITORING COMPLETED"
    
    print_info "Monitoring completed after $MONITORING_DURATION seconds"
    print_info "Total checks performed: $check_count"
    print_info "Error occurrences: $error_count"
    print_info "Final error rate: $error_rate%"
    
    if (( $(echo "$error_rate > $ERROR_RATE_CRITICAL" | bc -l) )); then
        print_critical "DEPLOYMENT MONITORING: CRITICAL ISSUES DETECTED"
        print_critical "Error rate ($error_rate%) exceeds critical threshold"
        print_critical "RECOMMENDATION: Consider rollback immediately"
    elif (( $(echo "$error_rate > $ERROR_RATE_WARNING" | bc -l) )); then
        print_warning "DEPLOYMENT MONITORING: ISSUES DETECTED"
        print_warning "Error rate ($error_rate%) exceeds warning threshold"
        print_warning "RECOMMENDATION: Monitor closely and investigate"
    else
        print_status "DEPLOYMENT MONITORING: SUCCESSFUL"
        print_status "Error rate ($error_rate%) within acceptable limits"
        print_status "RECOMMENDATION: Deployment appears stable"
    fi
    
    print_info ""
    print_info "Complete logs: $LOG_FILE"
    print_info "Metrics data: $METRICS_FILE"
}

# Main execution
main() {
    print_header "PRODUCTION DEPLOYMENT MONITOR"
    
    print_info "Initializing production deployment monitoring..."
    print_info "Target: User deletion endpoint"
    print_info "Environment: Production"
    print_info "Application URL: $PROD_APP_URL"
    
    # Validate prerequisites
    if ! command -v curl >/dev/null 2>&1; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v bc >/dev/null 2>&1; then
        print_error "bc is required but not installed"
        exit 1
    fi
    
    # Start monitoring
    monitor_deployment
}

# Handle script interruption
trap 'print_warning "Monitoring interrupted by user"; exit 0' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Production Deployment Monitor for User Deletion Endpoint"
    echo ""
    echo "Usage:"
    echo "  $0                    # Start monitoring with default settings"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  PROD_APP_URL          # Production application URL"
    echo "  MONITORING_DURATION   # Duration in seconds (default: 3600)"
    echo "  CHECK_INTERVAL        # Check interval in seconds (default: 30)"
    echo "  DATABASE_URL          # Database connection string"
    echo ""
    echo "Alerting configuration:"
    echo "  ERROR_RATE_WARNING    # Warning threshold (default: 0.5%)"
    echo "  ERROR_RATE_CRITICAL   # Critical threshold (default: 2%)"
    echo "  RESPONSE_TIME_WARNING # Warning threshold (default: 5s)"
    echo "  RESPONSE_TIME_CRITICAL # Critical threshold (default: 10s)"
    echo ""
    exit 0
fi

# Run main function
main "$@"
