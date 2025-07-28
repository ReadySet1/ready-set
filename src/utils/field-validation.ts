export function validateRequiredFields(
  data: Record<string, any>, 
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    
    // Check for undefined, null, or empty string
    if (value === undefined || value === null || value === '') {
      return true;
    }
    
    // Check for whitespace-only strings
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    
    return false;
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
} 