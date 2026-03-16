'use client';

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import LocationInput from '@/components/RouteOptimizer/LocationInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Route, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MileageStop } from '@/types/mileage';

const MAX_DROPOFFS = 5;

interface MileageFormValues {
  pickup: MileageStop;
  dropoffs: MileageStop[];
}

interface MileageFormProps {
  onCalculate: (pickup: MileageStop, dropoffs: MileageStop[]) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export default function MileageForm({
  onCalculate,
  isLoading,
  error,
}: MileageFormProps) {
  const { control, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<MileageFormValues>({
      defaultValues: {
        pickup: { address: '', label: 'Pickup' },
        dropoffs: [{ address: '', label: 'Drop-off 1' }],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'dropoffs',
  });

  const pickup = watch('pickup');
  const dropoffs = watch('dropoffs');

  const canSubmit =
    pickup.address.length >= 3 &&
    dropoffs.every((d) => d.address.length >= 3);

  const onSubmit = async (data: MileageFormValues) => {
    await onCalculate(data.pickup, data.dropoffs);
  };

  const addStop = () => {
    if (fields.length < MAX_DROPOFFS) {
      append({ address: '', label: `Drop-off ${fields.length + 1}` });
    }
  };

  const removeStop = (index: number) => {
    remove(index);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Pickup */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white">
        <CardContent className="pt-5 pb-5">
          <LocationInput
            label="Pickup Location"
            placeholder="Enter pickup address..."
            value={pickup.address}
            onChange={(address) => setValue('pickup.address', address)}
            onCoordinatesResolved={(lat, lng) => {
              setValue('pickup.lat', lat);
              setValue('pickup.lng', lng);
            }}
            icon="pickup"
            error={errors.pickup?.address?.message}
          />
        </CardContent>
      </Card>

      {/* Drop-offs */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card
            key={field.id}
            className="border-0 shadow-sm rounded-2xl bg-white"
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <LocationInput
                    label={`Drop-off ${index + 1}`}
                    placeholder="Enter drop-off address..."
                    value={dropoffs[index]?.address ?? ''}
                    onChange={(address) =>
                      setValue(`dropoffs.${index}.address`, address)
                    }
                    onCoordinatesResolved={(lat, lng) => {
                      setValue(`dropoffs.${index}.lat`, lat);
                      setValue(`dropoffs.${index}.lng`, lng);
                    }}
                    icon="dropoff"
                    error={errors.dropoffs?.[index]?.address?.message}
                  />
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-7 h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    onClick={() => removeStop(index)}
                    aria-label={`Remove drop-off ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {fields.length < MAX_DROPOFFS && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 rounded-xl h-11 transition-all"
            onClick={addStop}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stop ({fields.length}/{MAX_DROPOFFS})
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert className="border-red-200 bg-red-50 rounded-xl">
          <AlertDescription className="text-red-700 text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-lg transition-all duration-200 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            <Route className="h-4 w-4 mr-2" />
            Calculate Mileage
          </>
        )}
      </Button>
    </form>
  );
}
