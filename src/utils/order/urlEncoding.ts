// src/utils/order/urlEncoding.ts

/**
 * Encodes an order number for safe URL usage
 * Handles special characters like slashes by double encoding
 * 
 * @param orderNumber - The order number to encode (e.g., "CV-P4ZAG6/2")
 * @returns Double-encoded order number safe for URLs
 */
export function encodeOrderNumber(orderNumber: string): string {
  if (!orderNumber) return "";
  
  try {
    // Double encode to handle slashes and other special characters
    // First encoding handles special characters
    const firstEncode = encodeURIComponent(orderNumber);
    // Second encoding ensures it survives Next.js routing
    const finalEncode = encodeURIComponent(firstEncode);
    return finalEncode;
  } catch (error) {
    console.error("Error encoding order number:", error);
    // Fallback to basic encoding
    return encodeURIComponent(orderNumber);
  }
}

/**
 * Decodes an order number from URL parameters
 * Handles double-encoded order numbers with slashes
 * 
 * @param encodedOrderNumber - The encoded order number from URL
 * @returns Decoded order number
 */
export function decodeOrderNumber(encodedOrderNumber: string): string {
  if (!encodedOrderNumber) return "";
  
  try {
    // Double decode to handle order numbers with slashes
    const firstDecode = decodeURIComponent(encodedOrderNumber);
    const finalDecode = decodeURIComponent(firstDecode);
    return finalDecode;
  } catch (error) {
    console.error("Error decoding order number:", error);
    // Fallback to basic decode
    try {
      return decodeURIComponent(encodedOrderNumber);
    } catch (fallbackError) {
      console.error("Fallback decode also failed:", fallbackError);
      return encodedOrderNumber;
    }
  }
}

/**
 * Creates a safe URL path for order details
 * 
 * @param orderNumber - The order number (e.g., "CV-P4ZAG6/2")
 * @param basePath - Base path (e.g., "/admin/catering-orders")
 * @returns Complete URL path with properly encoded order number
 */
export function createOrderUrl(orderNumber: string, basePath: string): string {
  if (!orderNumber || !basePath) return basePath;
  
  const encodedOrderNumber = encodeOrderNumber(orderNumber);
  return `${basePath}/${encodedOrderNumber}`;
}

/**
 * Type guard to check if a string looks like an order number
 * 
 * @param value - String to check
 * @returns Boolean indicating if it looks like an order number
 */
export function isValidOrderNumber(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Check for common order number patterns
  const orderPatterns = [
    /^CV-[A-Z0-9]+\/?\d*$/i,  // CaterValley format: CV-XXXXX/X
    /^OD-[A-Z0-9]+\/?\d*$/i,  // OnDemand format: OD-XXXXX/X
    /^[A-Z]{2,3}-[A-Z0-9]+$/i // General format: XX-XXXXX
  ];
  
  return orderPatterns.some(pattern => pattern.test(value));
}
