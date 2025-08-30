"use client";

import React, { useState, useEffect } from "react";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface PerformanceMetrics {
  apiCalls: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastCallTime: number;
  suspiciousPatterns: number;
  errors: number;
  callsPerMinute: number;
  errorRate: string;
  isHealthy: boolean;
}

export default function PerformanceDashboard() {
  const { getPerformanceReport, resetMetrics, checkForInfiniteLoops } =
    usePerformanceMonitor();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Update metrics every second when monitoring is active
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      const report = getPerformanceReport();
      setMetrics(report);

      // Check for infinite loops
      const hasInfiniteLoop = checkForInfiniteLoops();
      if (hasInfiniteLoop) {
        setAlerts((prev) => [
          ...prev,
          `🚨 Infinite loop detected at ${new Date().toLocaleTimeString()}`,
        ]);
      }

      // Check for suspicious patterns
      if (report.suspiciousPatterns > 0) {
        setAlerts((prev) => [
          ...prev,
          `⚠️ Suspicious API pattern detected at ${new Date().toLocaleTimeString()}`,
        ]);
      }

      // Check for high error rates
      const errorRate = parseFloat(report.errorRate);
      if (errorRate > 20) {
        setAlerts((prev) => [
          ...prev,
          `❌ High error rate (${report.errorRate}) at ${new Date().toLocaleTimeString()}`,
        ]);
      }

      // Keep only last 10 alerts
      setAlerts((prev) => prev.slice(-10));
    }, 1000);

    return () => clearInterval(interval);
  }, [isMonitoring, getPerformanceReport, checkForInfiniteLoops]);

  const handleResetMetrics = () => {
    resetMetrics();
    setAlerts([]);
  };

  const getHealthColor = (isHealthy: boolean) => {
    return isHealthy ? "bg-green-500" : "bg-red-500";
  };

  const getHealthIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-4 w-4" />
    ) : (
      <XCircle className="h-4 w-4" />
    );
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-gray-400" />
          <p className="text-gray-500">
            Initializing performance monitoring...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Performance Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of API performance and infinite loop detection
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={isMonitoring ? "destructive" : "default"}
            onClick={() => setIsMonitoring(!isMonitoring)}
            size="sm"
          >
            {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
          </Button>
          <Button onClick={handleResetMetrics} variant="outline" size="sm">
            Reset Metrics
          </Button>
        </div>
      </div>

      {/* Health Status */}
      <Card
        className={`border-l-4 border-l-${getHealthColor(metrics.isHealthy).split("-")[2]}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {getHealthIcon(metrics.isHealthy)}
            <CardTitle className="text-lg">
              System Health: {metrics.isHealthy ? "Healthy" : "Issues Detected"}
            </CardTitle>
          </div>
          <CardDescription>
            Overall system performance and stability status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics.apiCalls}
              </div>
              <div className="text-muted-foreground text-sm">
                Total API Calls
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.callsPerMinute}
              </div>
              <div className="text-muted-foreground text-sm">Calls/Minute</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {metrics.suspiciousPatterns}
              </div>
              <div className="text-muted-foreground text-sm">
                Suspicious Patterns
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {metrics.errors}
              </div>
              <div className="text-muted-foreground text-sm">Total Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Response Time Metrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageResponseTime.toFixed(0)}ms
            </div>
            <p className="text-muted-foreground text-xs">
              Average response time
            </p>
            <Progress
              value={Math.min((metrics.averageResponseTime / 1000) * 100, 100)}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.errorRate}</div>
            <p className="text-muted-foreground text-xs">
              Percentage of failed requests
            </p>
            <Progress value={parseFloat(metrics.errorRate)} className="mt-2" />
          </CardContent>
        </Card>

        {/* API Call Frequency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Call Frequency
            </CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.callsPerMinute}</div>
            <p className="text-muted-foreground text-xs">
              API calls per minute
            </p>
            <div className="mt-2">
              <Badge
                variant={
                  metrics.callsPerMinute > 20 ? "destructive" : "default"
                }
              >
                {metrics.callsPerMinute > 20 ? "High" : "Normal"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Last Call */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last API Call</CardTitle>
            <Database className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {metrics.lastCallTime
                ? new Date(metrics.lastCallTime).toLocaleTimeString()
                : "Never"}
            </div>
            <p className="text-muted-foreground text-xs">
              Time of most recent API call
            </p>
          </CardContent>
        </Card>

        {/* Suspicious Patterns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Suspicious Patterns
            </CardTitle>
            <Zap className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.suspiciousPatterns}
            </div>
            <p className="text-muted-foreground text-xs">
              Detected suspicious API call patterns
            </p>
            {metrics.suspiciousPatterns > 0 && (
              <div className="mt-2">
                <Badge variant="destructive">Investigate</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Performance Trend
            </CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {metrics.isHealthy ? "Stable" : "Degrading"}
            </div>
            <p className="text-muted-foreground text-xs">
              Overall performance trend
            </p>
            <div className="mt-2">
              <Badge variant={metrics.isHealthy ? "default" : "destructive"}>
                {metrics.isHealthy ? "Good" : "Poor"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Monitoring */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                System Alerts
              </CardTitle>
              <CardDescription>
                Recent performance issues and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <p>No alerts - system is running smoothly</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription>{alert}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Status</CardTitle>
              <CardDescription>
                Real-time monitoring configuration and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Performance Monitoring</span>
                  <Badge variant={isMonitoring ? "default" : "secondary"}>
                    {isMonitoring ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Infinite Loop Detection</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pattern Analysis</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Error Tracking</span>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {!metrics.isHealthy && (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.suspiciousPatterns > 0 && (
                <p className="text-sm">
                  • Investigate suspicious API call patterns - potential
                  infinite loop detected
                </p>
              )}
              {parseFloat(metrics.errorRate) > 20 && (
                <p className="text-sm">
                  • High error rate detected - check API endpoints and network
                  connectivity
                </p>
              )}
              {metrics.callsPerMinute > 20 && (
                <p className="text-sm">
                  • High API call frequency - consider implementing request
                  throttling
                </p>
              )}
              {metrics.averageResponseTime > 1000 && (
                <p className="text-sm">
                  • Slow response times - optimize database queries and API
                  performance
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
