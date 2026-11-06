/**
 * Saved addresses often carry the full state name ("California") while the
 * order forms used to demand exactly two characters, which blocked admin order
 * creation with "State must be 2 characters". Every order-side address schema
 * must accept a full US state name and hand the 2-letter code downstream.
 */
import { addressSchema as cateringAddressSchema } from '@/app/(backend)/admin/catering-orders/_actions/schemas';
import { addressSchema as onDemandAddressSchema } from '@/app/(backend)/admin/on-demand-orders/_actions/schemas';
import { addressUpdateSchema } from '@/app/api/orders/[order_number]/schemas';

const savedAddress = {
  street1: '110 Linden Av',
  city: 'South San Francisco',
  state: 'California',
  zip: '94080',
};

describe.each([
  ['catering create', cateringAddressSchema],
  ['on-demand create', onDemandAddressSchema],
  ['order edit', addressUpdateSchema],
])('%s address schema — state', (_label, schema) => {
  it('accepts a full US state name and normalizes it to the USPS code', () => {
    const result = schema.safeParse(savedAddress);
    expect(result.success).toBe(true);
    expect(result.success && result.data.state).toBe('CA');
  });

  it('accepts an uppercase full name (legacy POST /api/addresses rows)', () => {
    const result = schema.safeParse({ ...savedAddress, state: 'CALIFORNIA' });
    expect(result.success && result.data.state).toBe('CA');
  });

  it('still accepts a 2-letter code, uppercased', () => {
    const result = schema.safeParse({ ...savedAddress, state: 'ca' });
    expect(result.success && result.data.state).toBe('CA');
  });

  it('rejects a region with no USPS code instead of guessing one', () => {
    const result = schema.safeParse({ ...savedAddress, state: 'Guanajuato' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty state', () => {
    const result = schema.safeParse({ ...savedAddress, state: '' });
    expect(result.success).toBe(false);
  });
});
