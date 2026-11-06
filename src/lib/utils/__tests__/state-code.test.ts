import { normalizeStateCode, stateCodeSchema } from '../state-code';

describe('normalizeStateCode', () => {
  it.each([
    ['California', 'CA'],
    ['california', 'CA'],
    ['CALIFORNIA', 'CA'],
    ['  California  ', 'CA'],
    ['New   York', 'NY'],
    ['north carolina', 'NC'],
    ['West Virginia', 'WV'],
    ['Texas', 'TX'],
    ['District of Columbia', 'DC'],
    ['Washington DC', 'DC'],
    ['Washington D.C.', 'DC'],
    ['Washington', 'WA'],
    ['Puerto Rico', 'PR'],
  ])('maps the full US state name %p to %p', (input, expected) => {
    expect(normalizeStateCode(input)).toBe(expected);
  });

  it.each([
    ['CA', 'CA'],
    ['ca', 'CA'],
    [' tx ', 'TX'],
  ])('passes a 2-letter code %p through uppercased (%p)', (input, expected) => {
    expect(normalizeStateCode(input)).toBe(expected);
  });

  it('covers all 50 states plus DC', () => {
    const names = [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
      'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
      'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
      'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
      'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
      'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
      'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia',
    ];
    const codes = names.map(normalizeStateCode);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(51);
  });

  it('leaves non-US regions untouched (no USPS code to invent)', () => {
    expect(normalizeStateCode('Guanajuato')).toBe('Guanajuato');
    expect(normalizeStateCode('  Guanajuato ')).toBe('Guanajuato');
    expect(normalizeStateCode('Jalisco')).toBe('Jalisco');
  });

  it('returns an empty string for empty / whitespace input', () => {
    expect(normalizeStateCode('')).toBe('');
    expect(normalizeStateCode('   ')).toBe('');
  });
});

describe('stateCodeSchema', () => {
  it('normalizes a full US state name to its code', () => {
    const result = stateCodeSchema.safeParse('California');
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe('CA');
  });

  it('accepts and uppercases a 2-letter code', () => {
    const result = stateCodeSchema.safeParse('ca');
    expect(result.success && result.data).toBe('CA');
  });

  it('rejects an empty state as required', () => {
    const result = stateCodeSchema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('State is required');
  });

  it('rejects an unmappable full name with a 2-letter-code hint', () => {
    const result = stateCodeSchema.safeParse('Guanajuato');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/2-letter/);
  });
});
