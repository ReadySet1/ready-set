/**
 * Configuration Template Card
 * Compact card component displaying configuration overview for Templates tab
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Check, Settings, Edit, DollarSign, TrendingUp, Truck, MapPin } from 'lucide-react';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';
import { ClientConfigurationManager } from './ClientConfigurationManager';

interface ConfigurationTemplateCardProps {
  configuration: ClientDeliveryConfiguration;
  isActive?: boolean;
  onSelect?: () => void;
  onUpdate?: (config: ClientDeliveryConfiguration) => void;
}

export function ConfigurationTemplateCard({
  configuration,
  isActive = false,
  onSelect,
  onUpdate
}: ConfigurationTemplateCardProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleConfigurationChange = (updatedConfig: ClientDeliveryConfiguration) => {
    if (onUpdate) {
      onUpdate(updatedConfig);
    }
  };

  return (
    <>
      <Card className={`border-2 transition-all duration-200 hover:shadow-lg ${
        isActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                {configuration.clientName}
                {isActive && (
                  <Badge variant="default" className="ml-2 bg-blue-500">
                    <Check className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
                {configuration.id === 'ready-set-food-standard' && (
                  <Badge variant="outline" className="ml-1">Ready Set</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-600">{configuration.description}</p>
            </div>

            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configuration Settings - {configuration.clientName}</DialogTitle>
                </DialogHeader>
                <ClientConfigurationManager
                  currentConfigId={configuration.id}
                  onConfigurationChange={handleConfigurationChange}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Pricing Tiers</span>
              </div>
              <div className="text-xl font-bold text-blue-900">
                {configuration.pricingTiers.length}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                ${configuration.pricingTiers[0]?.regularRate} - ${configuration.pricingTiers[configuration.pricingTiers.length - 2]?.regularRate}
              </div>
            </div>

            <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-900">Mileage Rate</span>
              </div>
              <div className="text-xl font-bold text-emerald-900">
                ${configuration.mileageRate.toFixed(2)}
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                per mile (&gt;{configuration.distanceThreshold}mi)
              </div>
            </div>
          </div>

          <Separator />

          {/* Driver Pay Summary */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Truck className="h-4 w-4" />
              Driver Pay Structure
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span className="text-slate-600">Base Pay:</span>
                <span className="font-semibold">${configuration.driverPaySettings.basePayPerDrop}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span className="text-slate-600">Max Pay:</span>
                <span className="font-semibold">${configuration.driverPaySettings.maxPayPerDrop}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span className="text-slate-600">Bonus:</span>
                <span className="font-semibold text-emerald-600">+${configuration.driverPaySettings.bonusPay}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span className="text-slate-600">Ready Set Fee:</span>
                <span className="font-semibold">${configuration.driverPaySettings.readySetFee}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Daily Drive Discounts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <TrendingUp className="h-4 w-4" />
              Daily Drive Discounts
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-semibold text-amber-900">2 Drives</div>
                <div className="text-xs text-amber-700">-${configuration.dailyDriveDiscounts.twoDrivers}/drive</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-semibold text-amber-900">3 Drives</div>
                <div className="text-xs text-amber-700">-${configuration.dailyDriveDiscounts.threeDrivers}/drive</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded border border-amber-200">
                <div className="font-semibold text-amber-900">4+ Drives</div>
                <div className="text-xs text-amber-700">-${configuration.dailyDriveDiscounts.fourPlusDrivers}/drive</div>
              </div>
            </div>
          </div>

          {/* Features Highlight */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-900 mb-2">Features:</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                Tiered compensation
              </Badge>
              <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                ${configuration.mileageRate}/mile rate
              </Badge>
              {configuration.bridgeTollSettings.autoApplyForAreas && configuration.bridgeTollSettings.autoApplyForAreas.length > 0 && (
                <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                  Auto bridge toll
                </Badge>
              )}
            </div>
          </div>

          {/* Action Button */}
          {isActive ? (
            <Button
              variant="default"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled
            >
              <Check className="h-4 w-4 mr-2" />
              Currently Active
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full border-blue-300 hover:bg-blue-50 hover:border-blue-400"
              onClick={onSelect}
            >
              <Edit className="h-4 w-4 mr-2" />
              Select & Configure
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
