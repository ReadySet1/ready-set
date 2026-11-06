import { z } from 'zod';

/**
 * Full US state / territory name (lowercased, single-spaced) → USPS code.
 * Free-text address inputs (sign-up, profile, partner payloads) store names
 * like "California"; orders require the 2-letter code.
 */
const USPS_CODE_BY_NAME: Readonly<Record<string, string>> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d.c.': 'DC',
  'puerto rico': 'PR',
  guam: 'GU',
  'american samoa': 'AS',
  'northern mariana islands': 'MP',
  'us virgin islands': 'VI',
  'u.s. virgin islands': 'VI',
};

/**
 * Normalize a state value to its USPS 2-letter code.
 *
 * - 2-letter input → uppercased (`"ca"` → `"CA"`)
 * - full US state / territory name, any case or spacing → code
 *   (`" california "` → `"CA"`)
 * - anything else (e.g. a non-US region like `"Guanajuato"`) → trimmed but
 *   otherwise unchanged: there is no USPS code for it, so none is invented.
 */
export function normalizeStateCode(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  return USPS_CODE_BY_NAME[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Zod field for order-side address state: tolerates full US state names
 * (normalizing them to the code) and still requires a 2-letter result.
 */
export const stateCodeSchema = z
  .string()
  .overwrite(normalizeStateCode)
  .min(1, 'State is required')
  .refine((state) => state.length === 0 || state.length === 2, {
    message: 'Use the 2-letter state code (e.g. CA)',
  });
