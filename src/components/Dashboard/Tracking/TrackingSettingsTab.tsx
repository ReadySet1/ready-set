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

const METERS_TO_FEET = 3.28084;

const metersToFeet = (m: number): number => Math.round(m * METERS_TO_FEET);
const feetToMeters = (ft: number): number => Math.round(ft / METERS_TO_FEET);

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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="max-w-32"
          value={form[id]}
          onChange={(e) => onChange(id, e.target.value)}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
      {errors[id] ? <p className="text-xs text-destructive">{errors[id]}</p> : null}
    </div>
  );
}

export default function TrackingSettingsTab() {
  const { settings, isLoaded } = useTrackingSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize the form once real values arrive; don't clobber in-progress edits.
  useEffect(() => {
    if (isLoaded && form === null) {
      setForm(settingsToForm(settings));
    }
  }, [isLoaded, settings, form]);

  const onChange = (id: keyof FormValues, value: string) => {
    setForm((prev) => (prev ? { ...prev, [id]: value } : prev));
  };

  const validate = (candidate: TrackingSettings): boolean => {
    const parsed = TrackingSettingsSchema.safeParse(candidate);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    // Map canonical-field errors back onto the form fields that edit them.
    const fieldByCanonical: Record<string, keyof FormValues> = {
      arrivalGeofenceRadiusM: 'arrivalGeofenceRadiusFt',
      endShiftPickupGuardMinutes: 'endShiftPickupGuardMinutes',
      locationUpdateIntervalSeconds: 'locationUpdateIntervalSeconds',
      staleGpsThresholdSeconds: 'staleGpsThresholdMinutes',
      mileageGpsAccuracyThresholdM: 'mileageGpsAccuracyThresholdFt',
      mileageMaxSpeedMph: 'mileageMaxSpeedMph',
      maxReasonableShiftMiles: 'maxReasonableShiftMiles',
    };
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const canonical = String(issue.path[0] ?? '');
      const formField = fieldByCanonical[canonical];
      if (formField && !next[formField]) {
        next[formField] = issue.message;
      }
    }
    setErrors(next);
    return false;
  };

  const handleSave = async () => {
    if (!form) return;
    const candidate = formToSettings(form);
    if (!validate(candidate)) {
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
