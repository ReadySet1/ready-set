/**
 * Address Normalization Utilities
 *
 * Provides functions for normalizing addresses for comparison and duplicate detection.
 */

/**
 * Common street suffix abbreviations and their expansions
 */
const STREET_SUFFIX_MAP: Record<string, string> = {
  'st': 'street',
  'st.': 'street',
  'ave': 'avenue',
  'ave.': 'avenue',
  'rd': 'road',
  'rd.': 'road',
  'dr': 'drive',
  'dr.': 'drive',
  'blvd': 'boulevard',
  'blvd.': 'boulevard',
  'ln': 'lane',
  'ln.': 'lane',
  'ct': 'court',
  'ct.': 'court',
  'cir': 'circle',
  'cir.': 'circle',
  'pl': 'place',
  'pl.': 'place',
  'pkwy': 'parkway',
  'pkwy.': 'parkway',
  'hwy': 'highway',
  'hwy.': 'highway',
  'ste': 'suite',
  'ste.': 'suite',
  'apt': 'apartment',
  'apt.': 'apartment',
};

/**
 * Normalize a street address for comparison
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes multiple spaces to single space
 * - Expands common abbreviations
 * - Converts # to "suite"
 */
export function normalizeStreet(street: string): string {
  let normalized = street.toLowerCase().trim().replace(/\s+/g, ' ');

  // Replace # with "suite "
  normalized = normalized.replace(/#\s*/g, 'suite ');

  // Replace common abbreviations
  const words = normalized.split(' ');
  const normalizedWords = words.map((word) => {
    const lowerWord = word.toLowerCase();
    return STREET_SUFFIX_MAP[lowerWord] || word;
  });

  return normalizedWords.join(' ');
}

/**
 * Normalize a city name for comparison
 */
export function normalizeCity(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a state code for comparison
 */
export function normalizeState(state: string): string {
  return state.toUpperCase().trim();
}

/**
 * Normalize a ZIP code for comparison
 * Only uses first 5 digits for comparison
 */
export function normalizeZip(zip: string): string {
  return zip.trim().substring(0, 5);
}

/**
 * Address input for normalization
 */
export interface AddressInput {
  street1: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Normalized address components
 */
export interface NormalizedAddress {
  street1: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Normalize an address for comparison
 * Returns normalized components
 */
export function normalizeAddress(address: AddressInput): NormalizedAddress {
  return {
    street1: normalizeStreet(address.street1),
    city: normalizeCity(address.city),
    state: normalizeState(address.state),
    zip: normalizeZip(address.zip),
  };
}

/**
 * Generate a comparison key from an address
 * Used to identify potential duplicates
 */
export function getAddressComparisonKey(address: AddressInput): string {
  const normalized = normalizeAddress(address);
  return `${normalized.street1}|${normalized.city}|${normalized.state}|${normalized.zip}`;
}

/**
 * Check if two addresses are potentially duplicates
 */
export function areAddressesSimilar(
  address1: AddressInput,
  address2: AddressInput
): boolean {
  return getAddressComparisonKey(address1) === getAddressComparisonKey(address2);
}
