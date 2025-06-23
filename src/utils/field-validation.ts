export function validateRequiredFields(
  data: Record<string, any>, 
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => 
    data[field] === undefined || data[field] === null || data[field] === ''
  );
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
} 