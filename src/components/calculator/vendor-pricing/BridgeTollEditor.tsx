'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

interface BridgeTollEditorProps {
  settings: ClientDeliveryConfiguration['bridgeTollSettings'];
  onChange: (settings: ClientDeliveryConfiguration['bridgeTollSettings']) => void;
}

const COMMON_AREAS = ['San Francisco', 'Oakland', 'Marin County', 'Berkeley'];

export function BridgeTollEditor({ settings, onChange }: BridgeTollEditorProps) {
  const [newArea, setNewArea] = useState('');
  const areas = settings.autoApplyForAreas ?? [];

  const addArea = (area: string) => {
    const trimmed = area.trim();
    if (!trimmed || areas.includes(trimmed)) return;
    onChange({
      ...settings,
      autoApplyForAreas: [...areas, trimmed],
    });
    setNewArea('');
  };

  const removeArea = (area: string) => {
    onChange({
      ...settings,
      autoApplyForAreas: areas.filter((a) => a !== area),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="toll-amount">Default Toll Amount</Label>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <Input
            id="toll-amount"
            type="number"
            min={0}
            step="0.01"
            value={settings.defaultTollAmount}
            onChange={(e) =>
              onChange({ ...settings, defaultTollAmount: parseFloat(e.target.value) || 0 })
            }
            className="pl-7"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Auto-Apply Areas</Label>

        {areas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <Badge
                key={area}
                variant="secondary"
                className="gap-1 pl-3 pr-1.5 py-1.5 text-sm bg-blue-50 text-blue-700 border-blue-200"
              >
                {area}
                <button
                  type="button"
                  onClick={() => removeArea(area)}
                  className="ml-1 rounded-full p-0.5 hover:bg-blue-200 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 max-w-md">
          <Input
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            placeholder="Add area name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addArea(newArea);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => addArea(newArea)}
            disabled={!newArea.trim()}
            className="gap-1 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 mr-1 self-center">Quick add:</span>
          {COMMON_AREAS.filter((a) => !areas.includes(a)).map((area) => (
            <Button
              key={area}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => addArea(area)}
            >
              + {area}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
