"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  AlertCircle,
  Truck,
  ExternalLink,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react';
import { CarrierService, CarrierConfig } from '@/lib/services/carrierService';
import Link from 'next/link';

interface CarrierSummary {
  name: string;
  enabled: boolean;
  connected: boolean;
  todayOrders: number;
  activeOrders: number;
}

export const CarrierSummaryWidget: React.FC = () => {
  const [carriers, setCarriers] = useState<CarrierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadCarrierSummary();
  }, []);

  const loadCarrierSummary = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const configs = CarrierService.getCarriers();
      const connectivityResults = await CarrierService.testConnections();

      let totalTodayOrders = 0;

      const summaryPromises = configs.map(async (config) => {
        let stats = { todayOrders: 0, activeOrders: 0 };

        try {
          const response = await fetch(`/api/admin/carriers/${config.id}/stats`);
          if (response.ok) {
            stats = await response.json();
            totalTodayOrders += stats.todayOrders;
          }
        } catch (error) {
          // Error silently handled - stats will use defaults
        }

        return {
          name: config.name,
          enabled: config.enabled,
          connected: connectivityResults[config.id]?.connected || false,
          todayOrders: stats.todayOrders,
          activeOrders: stats.activeOrders,
        };
      });

      const summaries = await Promise.all(summaryPromises);
      setCarriers(summaries);
      setTotalOrders(totalTodayOrders);
      setLastUpdated(new Date());
    } catch (error) {
      // Error silently handled - will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadCarrierSummary(true);
  };

  const getStatusIcon = (carrier: CarrierSummary) => {
    if (!carrier.enabled) {
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
    
    if (carrier.connected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const connectedCarriers = carriers.filter(c => c.enabled && c.connected).length;
  const totalEnabledCarriers = carriers.filter(c => c.enabled).length;

  if (loading) {
    return (
      <Card className="animate-pulse">
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
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Carrier Integrations</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-7 w-7 p-0"
              title="Refresh carrier data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Badge
              variant={connectedCarriers === totalEnabledCarriers && connectedCarriers > 0 ? "default" : "secondary"}
              className={connectedCarriers === totalEnabledCarriers && connectedCarriers > 0 ? "bg-green-100 text-green-800" : ""}
            >
              {connectedCarriers}/{totalEnabledCarriers} Active
            </Badge>
          </div>
        </div>
        <CardDescription className="text-sm flex items-center justify-between">
          <span>External delivery platform connections</span>
          {lastUpdated && !loading && (
            <span className="text-xs text-gray-500">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-gray-600">Today's Orders</p>
              <p className="font-semibold">{totalOrders}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-gray-600">Active Orders</p>
              <p className="font-semibold">{carriers.reduce((sum, c) => sum + c.activeOrders, 0)}</p>
            </div>
          </div>
        </div>

        {/* Carrier List */}
        <div className="space-y-2">
          {carriers.slice(0, 3).map((carrier) => (
            <div key={carrier.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {getStatusIcon(carrier)}
                <span className="font-medium">{carrier.name}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <span>{carrier.todayOrders} today</span>
                {carrier.activeOrders > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {carrier.activeOrders} active
                  </Badge>
                )}
              </div>
            </div>
          ))}
          
          {carriers.length > 3 && (
            <div className="text-xs text-gray-500 text-center pt-2">
              +{carriers.length - 3} more carriers
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t">
          <Link href="/admin/carriers" className="block">
            <Button variant="outline" className="w-full gap-2 text-sm">
              <ExternalLink className="h-4 w-4" />
              Manage Integrations
            </Button>
          </Link>
        </div>

        {/* Quick Status Indicators */}
        {(connectedCarriers < totalEnabledCarriers || totalEnabledCarriers === 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {totalEnabledCarriers === 0 
                  ? "No carriers configured" 
                  : `${totalEnabledCarriers - connectedCarriers} carrier(s) disconnected`}
              </span>
            </div>
            {totalEnabledCarriers > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Check your carrier configurations and network connectivity.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 