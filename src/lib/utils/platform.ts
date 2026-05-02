/**
 * Platform detection and native integration utilities for mobile drivers.
 */

/**
 * Detects iPhone or iPad via userAgent.
 * Returns false during SSR.
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Returns a maps URL appropriate for the device platform.
 * iOS -> Apple Maps, everything else -> Google Maps.
 */
export function getNavigationUrl(lat: number, lng: number, label?: string): string {
  if (isIOSDevice()) {
    const q = label ? `&q=${encodeURIComponent(label)}` : '';
    return `https://maps.apple.com/?daddr=${lat},${lng}${q}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Returns a tel: URI for initiating a phone call.
 */
export function getPhoneCallUrl(phone: string): string {
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}
