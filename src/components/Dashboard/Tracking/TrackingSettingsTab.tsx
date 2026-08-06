'use client';

/**
 * Admin-editable driver-tracking settings (Settings tab of /admin/tracking).
 *
 * Values are stored in canonical units (meters/seconds/minutes) but every
 * distance is edited in imperial units — feet — per the product rule that
 * user-facing distances are never metric. Conversion happens only at this
 * form boundary.
 */

import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPinIcon, RadioIcon, RouteIcon, RotateCcwIcon, SaveIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useTrackingSettings,
  TRACKING_SETTINGS_QUERY_KEY,
} from '@/hooks/tracking/useTrackingSettings';
import {
  TrackingSettingsSchema,
  TRACKING_SETTINGS_DEFAULTS,
  type TrackingSettings,
} from '@/types/tracking-settings';
import { metersToFeet, feetToMeters } from '@/lib/units';

/** The form edits display units (feet/minutes); this is its shape. */
interface FormValues {
  arrivalGeofenceRadiusFt: string;
  endShiftPickupGuardMinutes: string;
  locationUpdateIntervalSeconds: string;
  staleGpsThresholdMinutes: string;
  mileageGpsAccuracyThresholdFt: string;
  mileageMaxSpeedMph: string;
  maxReasonableShiftMiles: string;
}

/**
 * Per-field bounds in DISPLAY units. The canonical Zod schema validates
 * metric/second values; error messages must speak the form's units, so each
 * field carries its own display-unit range (chosen to round-trip exactly onto
 * the canonical bounds).
 */
const FIELD_RULES: Record<keyof FormValues, { min: number; max: number; unit: string }> = {
  arrivalGeofenceRadiusFt: { min: 50, max: 5280, unit: 'ft' },
  endShiftPickupGuardMinutes: { min: 0, max: 1440, unit: 'min' },
  locationUpdateIntervalSeconds: { min: 2, max: 60, unit: 'sec' },
  staleGpsThresholdMinutes: { min: 1, max: 60, unit: 'min' },
  mileageGpsAccuracyThresholdFt: { min: 33, max: 1640, unit: 'ft' },
  mileageMaxSpeedMph: { min: 30, max: 150, unit: 'mph' },
  maxReasonableShiftMiles: { min: 50, max: 2000, unit: 'mi' },
};

function settingsToForm(settings: TrackingSettings): FormValues {
  return {
    arrivalGeofenceRadiusFt: String(metersToFeet(settings.arrivalGeofenceRadiusM)),
    endShiftPickupGuardMinutes: String(settings.endShiftPickupGuardMinutes),
    locationUpdateIntervalSeconds: String(settings.locationUpdateIntervalSeconds),
    staleGpsThresholdMinutes: String(Math.round(settings.staleGpsThresholdSeconds / 60)),
    mileageGpsAccuracyThresholdFt: String(metersToFeet(settings.mileageGpsAccuracyThresholdM)),
    mileageMaxSpeedMph: String(settings.mileageMaxSpeedMph),
    maxReasonableShiftMiles: String(settings.maxReasonableShiftMiles),
  };
}

function formToSettings(form: FormValues): TrackingSettings {
  return {
    arrivalGeofenceRadiusM: feetToMeters(Number(form.arrivalGeofenceRadiusFt)),
    endShiftPickupGuardMinutes: Number(form.endShiftPickupGuardMinutes),
    locationUpdateIntervalSeconds: Number(form.locationUpdateIntervalSeconds),
    staleGpsThresholdSeconds: Number(form.staleGpsThresholdMinutes) * 60,
    mileageGpsAccuracyThresholdM: feetToMeters(Number(form.mileageGpsAccuracyThresholdFt)),
    mileageMaxSpeedMph: Number(form.mileageMaxSpeedMph),
    maxReasonableShiftMiles: Number(form.maxReasonableShiftMiles),
  };
}

interface FieldProps {
  id: keyof FormValues;
  label: string;
  unit: string;
  help: string;
  form: FormValues;
  errors: Record<string, string>;
  onChange: (id: keyof FormValues, value: string) => void;
}

function SettingsField({ id, label, unit, help, form, errors, onChange }: FieldProps) {
  const rules = FIELD_RULES[id];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={rules.min}
          max={rules.max}
          step={1}
          className="max-w-32"
          value={form[id]}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={!!errors[id]}
          aria-describedby={errors[id] ? `${id}-error` : `${id}-help`}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {help}
      </p>
      {errors[id] ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {errors[id]}
        </p>
      ) : null}
    </div>
  );
}

export default function TrackingSettingsTab() {
  const { settings, isLoaded, isServerData } = useTrackingSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize the form only from server-confirmed values; never from the
  // fail-open defaults — saving a defaults-seeded form would silently reset
  // every customized setting. Don't clobber in-progress edits.
  useEffect(() => {
    if (isServerData && form === null) {
      setForm(settingsToForm(settings));
    }
  }, [isServerData, settings, form]);

  const onChange = (id: keyof FormValues, value: string) => {
    setForm((prev) => (prev ? { ...prev, [id]: value } : prev));
  };

  /**
   * Validate in DISPLAY units so error messages speak the same units as the
   * inputs (the canonical Zod schema still runs server-side as the backstop).
   * Blank fields are errors — Number('') would silently coerce to 0, which
   * for the pickup guard means "disabled".
   */
  const validate = (candidate: FormValues): boolean => {
    const next: Record<string, string> = {};
    for (const id of Object.keys(FIELD_RULES) as Array<keyof FormValues>) {
      const rules = FIELD_RULES[id];
      const raw = candidate[id].trim();
      if (raw === '') {
        next[id] = 'Enter a value.';
        continue;
      }
      const value = Number(raw);
      if (!Number.isInteger(value)) {
        next[id] = 'Enter a whole number.';
        continue;
      }
      if (value < rules.min || value > rules.max) {
        next[id] = `Must be between ${rules.min} and ${rules.max} ${rules.unit}.`;
      }
    }
    // Cross-field: the offline threshold must cover several GPS posts or
    // healthy drivers flap offline between legitimate updates.
    if (!next.staleGpsThresholdMinutes && !next.locationUpdateIntervalSeconds) {
      const staleSeconds = Number(candidate.staleGpsThresholdMinutes) * 60;
      const intervalSeconds = Number(candidate.locationUpdateIntervalSeconds);
      if (staleSeconds < 3 * intervalSeconds) {
        next.staleGpsThresholdMinutes =
          'Must be at least 3× the GPS update interval.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!form) return;
    if (!validate(form)) {
      toast.error('Fix the highlighted fields before saving.');
      return;
    }
    const candidate = formToSettings(form);
    // Canonical backstop — display-unit rules should already guarantee this.
    if (!TrackingSettingsSchema.safeParse(candidate).success) {
      toast.error('Fix the highlighted fields before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/tracking/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        toast.error(json?.error ?? 'Failed to save tracking settings.');
        return;
      }
      // Round-trip the saved values so unit conversions display consistently.
      setForm(settingsToForm(candidate));
      await queryClient.invalidateQueries({ queryKey: TRACKING_SETTINGS_QUERY_KEY });
      toast.success('Tracking settings saved.');
    } catch {
      toast.error('Failed to save tracking settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm(settingsToForm(TRACKING_SETTINGS_DEFAULTS));
    setErrors({});
    toast('Defaults loaded — hit Save to apply them.');
  };

  if (!form) {
    // Loaded but not from the server → the fetch failed; offer retry instead
    // of editing fallback values.
    if (isLoaded && !isServerData) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load the current tracking settings. Editing is
              disabled so saved values aren&apos;t accidentally reset.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: TRACKING_SETTINGS_QUERY_KEY })
              }
            >
              <RotateCcwIcon className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading tracking settings…
        </CardContent>
      </Card>
    );
  }

  const fieldProps = { form, errors, onChange };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinIcon className="h-4 w-4" />
            Check-in
          </CardTitle>
          <CardDescription>
            Gates on the driver&apos;s “Arrived” and “End shift” actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <SettingsField
            id="arrivalGeofenceRadiusFt"
            label="Arrival geofence radius"
            unit="ft"
            help="How close a driver must be to check in at a stop. Fail-open: never blocks when GPS or the address location is unknown."
            {...fieldProps}
          />
          <SettingsField
            id="endShiftPickupGuardMinutes"
            label="End-shift pickup guard"
            unit="min"
            help="An assigned pickup due within this window (or overdue) blocks ending the shift. 0 disables the guard; in-progress deliveries always block."
            {...fieldProps}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RadioIcon className="h-4 w-4" />
            Live tracking
          </CardTitle>
          <CardDescription>GPS reporting cadence and offline detection.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <SettingsField
            id="locationUpdateIntervalSeconds"
            label="GPS update interval"
            unit="sec"
            help="Minimum time between driver location reports (client throttle and server rate limit)."
            {...fieldProps}
          />
          <SettingsField
            id="staleGpsThresholdMinutes"
            label="Driver offline threshold"
            unit="min"
            help="A driver whose last GPS fix is older than this shows as offline on this dashboard."
            {...fieldProps}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RouteIcon className="h-4 w-4" />
            Mileage
          </CardTitle>
          <CardDescription>
            Filters applied when calculating shift mileage from the GPS trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <SettingsField
            id="mileageGpsAccuracyThresholdFt"
            label="GPS accuracy filter"
            unit="ft"
            help="GPS points with worse accuracy than this are excluded from mileage."
            {...fieldProps}
          />
          <SettingsField
            id="mileageMaxSpeedMph"
            label="Max speed filter"
            unit="mph"
            help="Segments faster than this are dropped as GPS glitches."
            {...fieldProps}
          />
          <SettingsField
            id="maxReasonableShiftMiles"
            label="Max shift distance"
            unit="mi"
            help="Shift totals above this trigger a review warning (still saved)."
            {...fieldProps}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Changes take effect within a minute across drivers and servers.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcwIcon className="mr-1.5 h-4 w-4" />
            Reset to defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <SaveIcon className="mr-1.5 h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
