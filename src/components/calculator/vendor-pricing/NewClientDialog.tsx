'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';
import {
  buildNewClientConfiguration,
  slugifyConfigKey,
  validateConfigKey,
} from '@/lib/calculator/new-client-configuration';

interface NewClientDialogProps {
  open: boolean;
  /** Keys already taken (DB rows and in-memory configs shown in the tab). */
  existingIds: string[];
  onOpenChange: (open: boolean) => void;
  /** Receives the template-based draft; nothing is persisted yet. */
  onCreate: (draft: ClientDeliveryConfiguration) => void;
}

export function NewClientDialog({
  open,
  existingIds,
  onOpenChange,
  onCreate,
}: NewClientDialogProps) {
  const [clientName, setClientName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<{ clientName?: string; key?: string }>({});

  const handleClientNameChange = (value: string) => {
    setClientName(value);
    if (!keyTouched) setKey(slugifyConfigKey(value));
  };

  const handleKeyChange = (value: string) => {
    setKeyTouched(true);
    setKey(value);
  };

  const handleContinue = () => {
    const nextErrors: typeof errors = {};
    if (clientName.trim() === '') {
      nextErrors.clientName = 'Client name is required';
    }
    const keyError = validateConfigKey(key);
    if (keyError) {
      nextErrors.key = keyError;
    } else if (existingIds.includes(key)) {
      nextErrors.key = `A configuration with key "${key}" already exists`;
    }
    setErrors(nextErrors);
    if (nextErrors.clientName || nextErrors.key) return;

    onCreate(buildNewClientConfiguration({ id: key, clientName, vendorName }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Starts from the generic pricing template. You will review and adjust every
            value before the client is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nc-client-name">Client name *</Label>
            <Input
              id="nc-client-name"
              value={clientName}
              onChange={(e) => handleClientNameChange(e.target.value)}
              placeholder="e.g., Acme Catering"
              autoFocus
            />
            {errors.clientName && (
              <p className="text-sm text-red-600">{errors.clientName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-vendor-name">Vendor name</Label>
            <Input
              id="nc-vendor-name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Defaults to the client name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-config-key">Configuration key *</Label>
            <Input
              id="nc-config-key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="e.g., acme-catering"
              className="font-mono"
            />
            <p className="text-xs text-slate-500">
              Lowercase letters, numbers and dashes. Used by the calculator to look this
              client up; it cannot be changed later.
            </p>
            {errors.key && <p className="text-sm text-red-600">{errors.key}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            Continue to pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
