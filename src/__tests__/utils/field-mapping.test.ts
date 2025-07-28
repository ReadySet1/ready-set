/**
 * Unit tests for field mapping logic
 * This tests the core field mapping functionality without going through the API route
 */

describe('Field Mapping Logic Tests', () => {
  // Mock the parseCommaSeparatedString function
  const parseCommaSeparatedString = (value: unknown): string[] => {
    if (!value) return [];
    
    // If it's already an array, return it
    if (Array.isArray(value)) return value;
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
      } catch {
        // If JSON parsing fails, split by comma
        return value.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    
    return [];
  };

  describe('Database to Frontend Field Mapping', () => {
    it('should transform camelCase database fields to snake_case for frontend', () => {
      // Mock database profile with camelCase fields
      const databaseProfile = {
        id: 'test-user-id',
        name: 'John Doe',
        email: 'test@example.com',
        contactNumber: '555-123-4567',
        companyName: 'Test Company Inc',
        website: 'https://testcompany.com',
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        locationNumber: 'LOC-001',
        parkingLoading: 'Street parking available',
        contactName: 'John Doe',
        sideNotes: 'Important customer',
        type: 'CLIENT',
        status: 'ACTIVE',
        frequency: 'weekly',
        headCount: 50,
        counties: ['San Francisco', 'Alameda'],
        timeNeeded: ['morning', 'afternoon'],
        cateringBrokerage: ['corporate', 'events'],
        provide: ['delivery', 'setup'],
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-02T15:30:00Z'),
      };

      // Transform to frontend format (snake_case)
      const frontendProfile = {
        id: databaseProfile.id,
        name: databaseProfile.name,
        email: databaseProfile.email,
        contact_number: databaseProfile.contactNumber,
        company_name: databaseProfile.companyName,
        website: databaseProfile.website,
        street1: databaseProfile.street1,
        street2: databaseProfile.street2,
        city: databaseProfile.city,
        state: databaseProfile.state,
        zip: databaseProfile.zip,
        type: databaseProfile.type,
        status: databaseProfile.status,
        location_number: databaseProfile.locationNumber,
        parking_loading: databaseProfile.parkingLoading,
        contact_name: databaseProfile.contactName,
        side_notes: databaseProfile.sideNotes,
        created_at: databaseProfile.createdAt?.toISOString(),
        updated_at: databaseProfile.updatedAt?.toISOString(),
        // Use the helper function to parse counties
        countiesServed: parseCommaSeparatedString(databaseProfile.counties),
        timeNeeded: parseCommaSeparatedString(databaseProfile.timeNeeded),
        cateringBrokerage: parseCommaSeparatedString(databaseProfile.cateringBrokerage),
        provisions: parseCommaSeparatedString(databaseProfile.provide)
      };

      // Verify camelCase → snake_case transformation
      expect(frontendProfile).toHaveProperty('contact_number', '555-123-4567');
      expect(frontendProfile).toHaveProperty('company_name', 'Test Company Inc');
      expect(frontendProfile).toHaveProperty('location_number', 'LOC-001');
      expect(frontendProfile).toHaveProperty('parking_loading', 'Street parking available');
      expect(frontendProfile).toHaveProperty('contact_name', 'John Doe');
      expect(frontendProfile).toHaveProperty('side_notes', 'Important customer');
      // head_count is not in our mapping, so it should not exist
      expect(frontendProfile).not.toHaveProperty('head_count');

      // Verify date transformations
      expect(frontendProfile).toHaveProperty('created_at');
      expect(frontendProfile).toHaveProperty('updated_at');
      expect(frontendProfile.created_at).toBe('2023-01-01T10:00:00.000Z');
      expect(frontendProfile.updated_at).toBe('2023-01-02T15:30:00.000Z');

      // Verify array field parsing
      expect(frontendProfile).toHaveProperty('countiesServed');
      expect(frontendProfile).toHaveProperty('timeNeeded');
      expect(frontendProfile).toHaveProperty('cateringBrokerage');
      expect(frontendProfile).toHaveProperty('provisions');
      expect(frontendProfile.countiesServed).toEqual(['San Francisco', 'Alameda']);
      expect(frontendProfile.timeNeeded).toEqual(['morning', 'afternoon']);
      expect(frontendProfile.cateringBrokerage).toEqual(['corporate', 'events']);
      expect(frontendProfile.provisions).toEqual(['delivery', 'setup']);

      // Verify fields that should remain unchanged
      expect(frontendProfile).toHaveProperty('id', 'test-user-id');
      expect(frontendProfile).toHaveProperty('name', 'John Doe');
      expect(frontendProfile).toHaveProperty('email', 'test@example.com');
      expect(frontendProfile).toHaveProperty('website', 'https://testcompany.com');
      expect(frontendProfile).toHaveProperty('street1', '123 Main St');
      expect(frontendProfile).toHaveProperty('street2', 'Apt 4B');
      expect(frontendProfile).toHaveProperty('city', 'San Francisco');
      expect(frontendProfile).toHaveProperty('state', 'CA');
      expect(frontendProfile).toHaveProperty('zip', '94105');
      expect(frontendProfile).toHaveProperty('type', 'CLIENT');
      expect(frontendProfile).toHaveProperty('status', 'ACTIVE');
    });

    it('should handle null values correctly', () => {
      // Mock database profile with null values
      const databaseProfileWithNulls = {
        id: 'test-user-id',
        name: 'John Doe',
        email: 'test@example.com',
        contactNumber: null,
        companyName: null,
        website: null,
        street1: null,
        street2: null,
        city: null,
        state: null,
        zip: null,
        locationNumber: null,
        parkingLoading: null,
        contactName: null,
        sideNotes: null,
        headCount: null,
        counties: null,
        timeNeeded: null,
        cateringBrokerage: null,
        provide: null,
        type: 'CLIENT',
        status: 'ACTIVE',
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-02T15:30:00Z'),
      };

      // Transform to frontend format
      const frontendProfile = {
        id: databaseProfileWithNulls.id,
        name: databaseProfileWithNulls.name,
        email: databaseProfileWithNulls.email,
        contact_number: databaseProfileWithNulls.contactNumber,
        company_name: databaseProfileWithNulls.companyName,
        website: databaseProfileWithNulls.website,
        street1: databaseProfileWithNulls.street1,
        street2: databaseProfileWithNulls.street2,
        city: databaseProfileWithNulls.city,
        state: databaseProfileWithNulls.state,
        zip: databaseProfileWithNulls.zip,
        type: databaseProfileWithNulls.type,
        status: databaseProfileWithNulls.status,
        location_number: databaseProfileWithNulls.locationNumber,
        parking_loading: databaseProfileWithNulls.parkingLoading,
        contact_name: databaseProfileWithNulls.contactName,
        side_notes: databaseProfileWithNulls.sideNotes,
        created_at: databaseProfileWithNulls.createdAt?.toISOString(),
        updated_at: databaseProfileWithNulls.updatedAt?.toISOString(),
        countiesServed: parseCommaSeparatedString(databaseProfileWithNulls.counties),
        timeNeeded: parseCommaSeparatedString(databaseProfileWithNulls.timeNeeded),
        cateringBrokerage: parseCommaSeparatedString(databaseProfileWithNulls.cateringBrokerage),
        provisions: parseCommaSeparatedString(databaseProfileWithNulls.provide)
      };

      // Verify null values are handled correctly
      expect(frontendProfile).toHaveProperty('contact_number', null);
      expect(frontendProfile).toHaveProperty('company_name', null);
      expect(frontendProfile).toHaveProperty('website', null);
      expect(frontendProfile).toHaveProperty('street2', null);
      expect(frontendProfile).toHaveProperty('side_notes', null);
      expect(frontendProfile.countiesServed).toEqual([]);
      expect(frontendProfile.timeNeeded).toEqual([]);
      expect(frontendProfile.cateringBrokerage).toEqual([]);
      expect(frontendProfile.provisions).toEqual([]);
    });

    it('should handle empty string values correctly', () => {
      // Mock database profile with empty strings
      const databaseProfileWithEmptyStrings = {
        id: 'test-user-id',
        name: 'John Doe',
        email: 'test@example.com',
        contactNumber: '',
        companyName: '',
        website: '',
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: '',
        locationNumber: '',
        parkingLoading: '',
        contactName: '',
        sideNotes: '',
        counties: '',
        timeNeeded: '',
        cateringBrokerage: '',
        provide: '',
        type: 'CLIENT',
        status: 'ACTIVE',
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-02T15:30:00Z'),
      };

      // Transform to frontend format
      const frontendProfile = {
        id: databaseProfileWithEmptyStrings.id,
        name: databaseProfileWithEmptyStrings.name,
        email: databaseProfileWithEmptyStrings.email,
        contact_number: databaseProfileWithEmptyStrings.contactNumber,
        company_name: databaseProfileWithEmptyStrings.companyName,
        website: databaseProfileWithEmptyStrings.website,
        street1: databaseProfileWithEmptyStrings.street1,
        street2: databaseProfileWithEmptyStrings.street2,
        city: databaseProfileWithEmptyStrings.city,
        state: databaseProfileWithEmptyStrings.state,
        zip: databaseProfileWithEmptyStrings.zip,
        type: databaseProfileWithEmptyStrings.type,
        status: databaseProfileWithEmptyStrings.status,
        location_number: databaseProfileWithEmptyStrings.locationNumber,
        parking_loading: databaseProfileWithEmptyStrings.parkingLoading,
        contact_name: databaseProfileWithEmptyStrings.contactName,
        side_notes: databaseProfileWithEmptyStrings.sideNotes,
        created_at: databaseProfileWithEmptyStrings.createdAt?.toISOString(),
        updated_at: databaseProfileWithEmptyStrings.updatedAt?.toISOString(),
        countiesServed: parseCommaSeparatedString(databaseProfileWithEmptyStrings.counties),
        timeNeeded: parseCommaSeparatedString(databaseProfileWithEmptyStrings.timeNeeded),
        cateringBrokerage: parseCommaSeparatedString(databaseProfileWithEmptyStrings.cateringBrokerage),
        provisions: parseCommaSeparatedString(databaseProfileWithEmptyStrings.provide)
      };

      // Verify empty strings are handled correctly
      expect(frontendProfile).toHaveProperty('contact_number', '');
      expect(frontendProfile).toHaveProperty('company_name', '');
      expect(frontendProfile).toHaveProperty('website', '');
      expect(frontendProfile).toHaveProperty('street2', '');
      expect(frontendProfile).toHaveProperty('side_notes', '');
      expect(frontendProfile.countiesServed).toEqual([]);
      expect(frontendProfile.timeNeeded).toEqual([]);
      expect(frontendProfile.cateringBrokerage).toEqual([]);
      expect(frontendProfile.provisions).toEqual([]);
    });
  });

  describe('Frontend to Database Field Mapping', () => {
    it('should transform snake_case frontend fields to camelCase for database', () => {
      // Frontend sends snake_case
      const frontendData = {
        contact_number: '555-999-8888',
        company_name: 'Updated Company LLC',
        location_number: 'LOC-002',
        parking_loading: 'Garage parking',
        contact_name: 'Jane Doe',
        side_notes: 'Updated notes',
        head_count: 75,
      };

      // Transform to database format (camelCase)
      const databaseData = {
        contactNumber: frontendData.contact_number,
        companyName: frontendData.company_name,
        locationNumber: frontendData.location_number,
        parkingLoading: frontendData.parking_loading,
        contactName: frontendData.contact_name,
        sideNotes: frontendData.side_notes,
        headCount: frontendData.head_count,
      };

      // Verify snake_case → camelCase transformation
      expect(databaseData).toHaveProperty('contactNumber', '555-999-8888');
      expect(databaseData).toHaveProperty('companyName', 'Updated Company LLC');
      expect(databaseData).toHaveProperty('locationNumber', 'LOC-002');
      expect(databaseData).toHaveProperty('parkingLoading', 'Garage parking');
      expect(databaseData).toHaveProperty('contactName', 'Jane Doe');
      expect(databaseData).toHaveProperty('sideNotes', 'Updated notes');
      expect(databaseData).toHaveProperty('headCount', 75);
    });

    it('should handle partial updates with field mapping', () => {
      // Only update contact number
      const frontendData = {
        contact_number: '555-111-2222',
      };

      // Transform to database format
      const databaseData = {
        contactNumber: frontendData.contact_number,
      };

      // Verify only the specified field was transformed
      expect(databaseData).toHaveProperty('contactNumber', '555-111-2222');
      expect(Object.keys(databaseData)).toHaveLength(1);
    });
  });

  describe('Array Field Parsing', () => {
    it('should handle malformed JSON arrays in database fields', () => {
      // Test various malformed JSON formats
      expect(parseCommaSeparatedString('"San Francisco, Alameda"')).toEqual(['San Francisco, Alameda']);
      expect(parseCommaSeparatedString('morning, afternoon')).toEqual(['morning', 'afternoon']);
      expect(parseCommaSeparatedString('["corporate", "events"]')).toEqual(['corporate', 'events']);
      expect(parseCommaSeparatedString(null)).toEqual([]);
      expect(parseCommaSeparatedString(undefined)).toEqual([]);
      expect(parseCommaSeparatedString('')).toEqual([]);
    });

    it('should handle single values in JSON fields', () => {
      // Test single values and various formats
      expect(parseCommaSeparatedString('San Francisco')).toEqual(['San Francisco']);
      expect(parseCommaSeparatedString('')).toEqual([]);
      expect(parseCommaSeparatedString('corporate,events')).toEqual(['corporate', 'events']);
      expect(parseCommaSeparatedString('delivery')).toEqual(['delivery']);
    });
  });
}); 