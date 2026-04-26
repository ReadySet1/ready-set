'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

type AdvancedFlags = Pick<
  ClientDeliveryConfiguration['driverPaySettings'],
  'requiresManualReview' | 'readySetFeeMatchesDeliveryFee' | 'includeDirectTipInReadySetTotal'
>;

interface AdvancedFlagsEditorProps {
  settings: AdvancedFlags;
  onChange: (field: keyof AdvancedFlags, value: boolean) => void;
}

const flags: Array<{
  key: keyof AdvancedFlags;
  label: string;
  description: string;
}> = [
  {
    key: 'requiresManualReview',
    label: 'Requires Manual Review',
    description:
      'Flag orders above the highest defined tier for manual pricing review',
  },
  {
    key: 'readySetFeeMatchesDeliveryFee',
    label: 'RS Fee Matches Delivery Fee',
    description:
      'Ready Set fee equals the customer delivery fee tier instead of a fixed amount',
  },
  {
    key: 'includeDirectTipInReadySetTotal',
    label: 'Include Direct Tip in RS Total',
    description:
      'Include direct tips in the Ready Set total fee calculation (RS Total = RS Fee + Addon + Toll + Tip)',
  },
];

export function AdvancedFlagsEditor({ settings, onChange }: AdvancedFlagsEditorProps) {
  return (
    <div className="space-y-4">
      {flags.map(({ key, label, description }) => (
        <div
          key={key}
          className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200"
        >
          <Switch
            id={`flag-${key}`}
            checked={settings[key] ?? false}
            onCheckedChange={(checked) => onChange(key, checked)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label htmlFor={`flag-${key}`} className="font-semibold text-slate-900 cursor-pointer">
              {label}
            </Label>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
