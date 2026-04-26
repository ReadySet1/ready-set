'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

type ZeroOrderSettings = NonNullable<ClientDeliveryConfiguration['zeroOrderSettings']>;

interface ZeroOrderSettingsEditorProps {
  settings: ZeroOrderSettings | undefined;
  onChange: (settings: ZeroOrderSettings | undefined) => void;
}

const DEFAULT_SETTINGS: ZeroOrderSettings = {
  enabled: true,
  readySetFee: 0,
  customerDeliveryFee: 0,
  driverBasePay: 0,
  driverMileagePay: 0,
  driverBonusPay: 0,
  maxMileage: 10,
};

export function ZeroOrderSettingsEditor({
  settings,
  onChange,
}: ZeroOrderSettingsEditorProps) {
  const enabled = settings?.enabled ?? false;
  const current = settings ?? DEFAULT_SETTINGS;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      onChange({ ...current, enabled: true });
    } else {
      onChange({ ...current, enabled: false });
    }
  };

  const handleFieldChange = (field: keyof ZeroOrderSettings, value: number) => {
    onChange({ ...current, [field]: value });
  };

  const totalDriverPay =
    (current.driverBasePay ?? 0) +
    (current.driverMileagePay ?? 0) +
    (current.driverBonusPay ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <Switch
          id="zero-order-enabled"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
        <Label htmlFor="zero-order-enabled" className="cursor-pointer font-semibold">
          Enable Zero Order Settings
        </Label>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zo-rs-fee">Ready Set Fee</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="zo-rs-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={current.readySetFee}
                  onChange={(e) => handleFieldChange('readySetFee', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zo-cust-fee">Customer Delivery Fee</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="zo-cust-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={current.customerDeliveryFee}
                  onChange={(e) => handleFieldChange('customerDeliveryFee', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zo-base-pay">Driver Base Pay</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="zo-base-pay"
                  type="number"
                  min={0}
                  step="0.01"
                  value={current.driverBasePay}
                  onChange={(e) => handleFieldChange('driverBasePay', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zo-mileage">Driver Mileage Pay</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="zo-mileage"
                  type="number"
                  min={0}
                  step="0.01"
                  value={current.driverMileagePay}
                  onChange={(e) => handleFieldChange('driverMileagePay', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zo-bonus">Driver Bonus Pay</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="zo-bonus"
                  type="number"
                  min={0}
                  step="0.01"
                  value={current.driverBonusPay}
                  onChange={(e) => handleFieldChange('driverBonusPay', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zo-max-mileage">Max Mileage</Label>
              <div className="relative">
                <Input
                  id="zo-max-mileage"
                  type="number"
                  min={0}
                  step="0.1"
                  value={current.maxMileage ?? ''}
                  placeholder="Uses distance threshold"
                  onChange={(e) =>
                    handleFieldChange(
                      'maxMileage',
                      e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                    )
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">miles</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-semibold text-emerald-800">
              Total Driver Pay: ${totalDriverPay.toFixed(2)}{' '}
              <span className="font-normal text-emerald-600">
                (base + mileage + bonus)
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
