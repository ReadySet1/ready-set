/**
 * Helpers for creating a brand-new client delivery configuration from the
 * admin panel. New clients start from GENERIC_TEMPLATE (the in-memory base
 * that exists for exactly this purpose) and are persisted only in the
 * delivery_configurations table — they have no in-memory fallback entry.
 */

import {
  ClientDeliveryConfiguration,
  GENERIC_TEMPLATE,
} from './client-configurations';

export const NEW_CLIENT_TEMPLATE_ID = GENERIC_TEMPLATE.id;
export const CONFIG_KEY_MAX_LENGTH = 64;
export const CONFIG_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface NewClientInput {
  id: string;
  clientName: string;
  vendorName?: string;
}

/** "HY Food Co." → "hy-food-co". Returns '' when nothing usable remains. */
export function slugifyConfigKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CONFIG_KEY_MAX_LENGTH);
}

/** Returns an error message, or null when the key is acceptable. */
export function validateConfigKey(key: string): string | null {
  if (!key || key.trim() === '') {
    return 'Configuration key is required';
  }
  if (key.length > CONFIG_KEY_MAX_LENGTH) {
    return `Configuration key must be at most ${CONFIG_KEY_MAX_LENGTH} characters`;
  }
  if (!CONFIG_KEY_PATTERN.test(key)) {
    return 'Configuration key must be lowercase letters, numbers and single dashes (e.g. "new-client")';
  }
  return null;
}

/**
 * Build the draft configuration for a new client: a deep copy of the generic
 * template with the identity fields applied. The draft is active and carries
 * no template description/notes so the admin sees a clean slate.
 */
export function buildNewClientConfiguration(
  input: NewClientInput,
  now: Date = new Date(),
): ClientDeliveryConfiguration {
  const clientName = input.clientName.trim();
  const vendorName = input.vendorName?.trim() || clientName;

  const { createdAt: _c, updatedAt: _u, ...templateFields } = GENERIC_TEMPLATE;
  const base = JSON.parse(JSON.stringify(templateFields)) as Omit<
    ClientDeliveryConfiguration,
    'createdAt' | 'updatedAt'
  >;

  return {
    ...base,
    id: input.id,
    clientName,
    vendorName,
    description: undefined,
    notes: undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
