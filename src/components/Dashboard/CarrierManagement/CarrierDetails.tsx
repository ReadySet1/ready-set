"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  Package,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { CarrierService, CarrierConfig } from '@/lib/services/carrierService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CarrierDetailsProps {
  carrierId: string;
}

interface CarrierStats {
  totalOrders: number;
  activeOrders: number;
  todayOrders: number;
  webhookSuccess: number | null;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    orderTotal: number;
  }>;
}

export const CarrierDetails: React.FC<CarrierDetailsProps> = ({ carrierId }) => {
  const router = useRouter();
  const [carrier, setCarrier] = useState<CarrierConfig | null>(null);
  const [stats, setStats] = useState<CarrierStats | null>(null);
  const [connectivity, setConnectivity] = useState<{
    connected: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const loadCarrierData = useCallback(async () => {
    setLoading(true);
    try {
      // Get carrier configuration
      const carrierConfig = CarrierService.getCarrier(carrierId);
      if (!carrierConfig) {
        setLoading(false);
        router.push('/admin/carriers');
        return; // Early return prevents state updates after redirect
      }
      setCarrier(carrierConfig);

      // Test connectivity
      const connectivityResults = await CarrierService.testConnections();
      setConnectivity(connectivityResults[carrierId] || {
        connected: false,
        error: 'Not tested',
      });

      // Load statistics
      try {
        const response = await fetch(`/api/admin/carriers/${carrierId}/stats`);
        if (response.ok) {
          const statsData = await response.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error(`[CarrierDetails] Failed to load stats for carrier ${carrierId}:`, error);
        // Stats will remain null, showing empty state
      }
    } catch (error) {
      console.error(`[CarrierDetails] Error loading carrier data for ${carrierId}:`, error);
      // Will show loading state or redirect
    } finally {
      setLoading(false);
    }
  }, [carrierId, router]);

  useEffect(() => {
    loadCarrierData();
  }, [loadCarrierData]);

  const testConnectivity = async () => {
    setTesting(true);
    try {
      const results = await CarrierService.testConnections();
      setConnectivity(results[carrierId] || {
        connected: false,
        error: 'Test failed',
      });
    } catch (error) {
      console.error(`[CarrierDetails] Error testing connectivity for carrier ${carrierId}:`, error);
      // Connectivity will show last known state
    } finally {
      setTesting(false);
    }
  };

  if (loading || !carrier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/carriers')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Carriers
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnectivity}
            disabled={testing}
            className="gap-2"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button variant="outline" size="sm" onClick={loadCarrierData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Connection Status Alert */}
      {connectivity && (
        <Alert variant={connectivity.connected ? "default" : "destructive"}>
          {connectivity.connected ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {connectivity.connected ? 'Connected' : 'Disconnected'}
          </AlertTitle>
          <AlertDescription>
            {connectivity.connected ? (
              <>
                Successfully connected to {carrier.name}
                {connectivity.latencyMs && ` (${connectivity.latencyMs}ms latency)`}
              </>
            ) : (
              <>
                Unable to connect to {carrier.name}
                {connectivity.error && `: ${connectivity.error}`}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeOrders}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today</p>
                  <p className="text-2xl font-bold">{stats.todayOrders}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.webhookSuccess !== null ? `${stats.webhookSuccess}%` : 'N/A'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="configuration" className="w-full">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carrier Configuration</CardTitle>
              <CardDescription>
                Integration settings and status mappings for {carrier.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Carrier ID</p>
                  <p className="text-sm">{carrier.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge variant={carrier.enabled ? "default" : "secondary"}>
                    {carrier.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Order Prefix</p>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{carrier.orderPrefix}</code>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Webhook URL</p>
                  <p className="text-sm truncate">{carrier.webhookUrl}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Status Mapping</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(carrier.statusMapping).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="font-medium">{key}</span>
                      <span className="text-gray-600">→ {value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Retry Policy</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-600">Max Attempts</p>
                    <p className="font-medium">{carrier.retryPolicy.maxAttempts}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-600">Base Delay</p>
                    <p className="font-medium">{carrier.retryPolicy.baseDelayMs}ms</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-600">Timeout</p>
                    <p className="font-medium">{carrier.retryPolicy.timeoutMs}ms</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>
                Latest orders processed through {carrier.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && stats.recentOrders.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{order.status}</Badge>
                        <p className="text-sm font-medium mt-1">
                          ${order.orderTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent orders found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Settings for sending status updates to {carrier.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Webhook Headers</p>
                <div className="space-y-1">
                  {Object.entries(carrier.webhookHeaders).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                      <code className="font-medium">{key}</code>
                      <code className="text-gray-600">{value}</code>
                    </div>
                  ))}
                  {carrier.apiKey && (
                    <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                      <code className="font-medium">x-api-key</code>
                      <code className="text-gray-600">***************</code>
                    </div>
                  )}
                </div>
              </div>

              {stats && stats.webhookSuccess !== null && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Webhook Performance</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span className="font-medium">{stats.webhookSuccess}%</span>
                    </div>
                    <Progress value={stats.webhookSuccess} className="h-2" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
