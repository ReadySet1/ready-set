"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Settings,
  Truck,
  Activity,
  Zap,
  Loader2,
  FileText
} from 'lucide-react';
import { CarrierService, CarrierConfig } from '@/lib/services/carrierService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface CarrierStatus {
  config: CarrierConfig;
  connectivity: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  stats: {
    totalOrders: number;
    activeOrders: number;
    todayOrders: number;
    webhookSuccess: number | null;
  };
}

export const CarrierOverview: React.FC = () => {
  const router = useRouter();
  const [carriers, setCarriers] = useState<CarrierStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadCarrierData();
  }, []);

  const loadCarrierData = async () => {
    setLoading(true);
    try {
      // Get carrier configurations
      const configs = CarrierService.getCarriers();
      
      // Test connectivity for enabled carriers
      const connectivityResults = await CarrierService.testConnections();
      
      // Get carrier statistics (would need to implement this API)
      const statsPromises = configs.map(async (config) => {
        try {
          const response = await fetch(`/api/admin/carriers/${config.id}/stats`);
          if (response.ok) {
            return await response.json();
          }
        } catch (error) {
          console.error(`[CarrierOverview] Failed to load stats for carrier ${config.id}:`, error);
          // Will use defaults
        }
        return {
          totalOrders: 0,
          activeOrders: 0,
          todayOrders: 0,
          webhookSuccess: null,
        };
      });

      const stats = await Promise.all(statsPromises);

      const carrierData: CarrierStatus[] = configs.map((config, index) => ({
        config,
        connectivity: connectivityResults[config.id] || {
          connected: false,
          error: 'Not tested',
        },
        stats: stats[index],
      }));

      setCarriers(carrierData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[CarrierOverview] Error loading carrier data:', error);
      // Will show empty state
    } finally {
      setLoading(false);
    }
  };

  const testConnectivity = async () => {
    setTesting(true);
    try {
      const connectivityResults = await CarrierService.testConnections();

      setCarriers(prev => prev.map(carrier => ({
        ...carrier,
        connectivity: connectivityResults[carrier.config.id] || {
          connected: false,
          error: 'Test failed',
        },
      })));

      setLastUpdated(new Date());
    } catch (error) {
      console.error('[CarrierOverview] Error testing connectivity:', error);
      // Will keep previous connectivity state
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (carrier: CarrierStatus) => {
    if (!carrier.config.enabled) {
      return <Clock className="h-4 w-4 text-gray-400" />;
    }
    
    if (carrier.connectivity.connected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (carrier: CarrierStatus) => {
    if (!carrier.config.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    if (carrier.connectivity.connected) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
    }
    
    return <Badge variant="destructive">Disconnected</Badge>;
  };

  const getLatencyColor = (latencyMs?: number) => {
    if (!latencyMs) return 'text-gray-400';
    if (latencyMs < 500) return 'text-green-600';
    if (latencyMs < 1500) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-6"> 
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-gray-600">Welcome to the carriers dashboard</p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
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
            Test All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCarrierData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Carriers</p>
                <p className="text-2xl font-bold">{carriers.length}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {carriers.filter(c => c.config.enabled && c.connectivity.connected).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders Today</p>
                <p className="text-2xl font-bold">
                  {carriers.reduce((sum, c) => sum + c.stats.todayOrders, 0)}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {(() => {
                    const validRates = carriers.filter(c => c.stats.webhookSuccess !== null);
                    return validRates.length > 0
                      ? `${Math.round(validRates.reduce((sum, c) => sum + (c.stats.webhookSuccess || 0), 0) / validRates.length)}%`
                      : 'N/A';
                  })()}
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {carriers.map((carrier) => (
          <Card key={carrier.config.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(carrier)}
                  <CardTitle className="text-lg">{carrier.config.name}</CardTitle>
                </div>
                {getStatusBadge(carrier)}
              </div>
              <CardDescription className="text-sm">
                Order prefix: <code className="bg-gray-100 px-1 rounded">{carrier.config.orderPrefix}</code>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Connection Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Connection</span>
                  {carrier.connectivity.latencyMs && (
                    <span className={`font-medium ${getLatencyColor(carrier.connectivity.latencyMs)}`}>
                      {carrier.connectivity.latencyMs}ms
                    </span>
                  )}
                </div>
                
                {carrier.connectivity.error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {carrier.connectivity.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Order Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total Orders</p>
                  <p className="font-semibold">{carrier.stats.totalOrders}</p>
                </div>
                <div>
                  <p className="text-gray-600">Active</p>
                  <p className="font-semibold">{carrier.stats.activeOrders}</p>
                </div>
                <div>
                  <p className="text-gray-600">Today</p>
                  <p className="font-semibold">{carrier.stats.todayOrders}</p>
                </div>
                <div>
                  <p className="text-gray-600">Success Rate</p>
                  <p className="font-semibold">
                    {carrier.stats.webhookSuccess !== null ? `${carrier.stats.webhookSuccess}%` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Webhook Success Rate Progress */}
              {carrier.stats.webhookSuccess !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Webhook Success Rate</span>
                    <span>{carrier.stats.webhookSuccess}%</span>
                  </div>
                  <Progress
                    value={carrier.stats.webhookSuccess}
                    className="h-2"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => router.push(`/admin/carriers/${carrier.config.id}`)}
                >
                  <Settings className="h-4 w-4" />
                  Manage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/admin/carriers/${carrier.config.id}/logs`)}
                  title="View webhook logs"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Carrier Button */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Truck className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="text-lg font-medium">Add New Carrier</h3>
            <p className="text-sm text-gray-600 max-w-sm">
              Integrate with additional delivery platforms to expand your service reach
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/admin/carriers/configure')}
            >
              Configure Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 