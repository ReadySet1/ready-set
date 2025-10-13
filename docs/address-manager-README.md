# Address Manager Feature

## Overview

The Address Manager is a comprehensive address management system that provides users with an intuitive interface for managing delivery and pickup addresses. This feature was implemented in phases 1-8 as documented in the phase completion files.

## Key Features

### 1. **Smart Address Selection**
- Unified address selector component for both pickup and delivery addresses
- Search functionality with real-time filtering
- Quick filters for shared, private, and restaurant addresses
- Recently used addresses tracking
- Favorite addresses management

### 2. **Address Organization**
- **Favorites**: Star addresses for quick access
- **Recents**: Automatically tracks recently used addresses
- **All Addresses**: Browse complete address book
- **Restaurant Addresses**: Pre-loaded restaurant database with 100+ Bay Area locations

### 3. **Modern UI/UX**
- Clean, responsive design with design tokens
- Smooth animations and transitions
- Accessible components following WCAG guidelines
- Mobile-first responsive layout
- Loading states and error handling

### 4. **Database Integration**
- New tables: `address_favorites`, `address_usage_history`
- Optimized indexes for performance
- RLS policies for secure data access
- Migration: `20251010122409_add_address_favorites_and_usage_tracking.sql`

## Component Architecture

### Main Components
- **AddressSelector** (`src/components/AddressSelector/`)
  - Main container component
  - Handles mode switching (client/admin)
  - Manages state and data fetching

- **AddressSearchCombobox**
  - Search and filter interface
  - Real-time address matching
  - Keyboard navigation support

- **AddressCompactCard**
  - Individual address display
  - Favorite toggle
  - Selection handling

### Custom Hooks
- **useAddressFavorites** - Manage favorite addresses
- **useAddressRecents** - Track and fetch recent addresses
- **useAddressSearch** - Search and filter logic
- **useDebounce** - Input debouncing utility

### Types
- **address-selector.ts** - Component prop types and interfaces
- Extends existing Address types from `src/types/address.ts`

## Design System

Design tokens defined in `src/styles/design-tokens.ts`:
- Colors: Primary, accent, neutral palette
- Typography: Font sizes, weights, line heights
- Spacing: Consistent spacing scale
- Borders and shadows
- Transitions and animations

## Integration Points

### Forms Using Address Manager
1. **CateringRequestForm** (Client-side)
   - Pickup address selection
   - Delivery address selection
   - Integration with existing form validation

2. **CreateCateringOrderForm** (Admin-side)
   - Similar integration as client form
   - Admin-specific features

## Database Schema

### address_favorites
```sql
CREATE TABLE address_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address_id)
);
```

### address_usage_history
```sql
CREATE TABLE address_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  context VARCHAR(50)
);
```

## Testing

Test suites located in `src/hooks/__tests__/` cover:
- Favorite management
- Recent address tracking
- Search functionality
- Component rendering and interactions

## Scripts

Utility scripts in `scripts/`:
- `import-restaurant-addresses.ts` - Import restaurant database
- `fix-problematic-restaurant-addresses.ts` - Data cleanup
- `verify-restaurant-imports.ts` - Verification tool

## Performance Considerations

- Query caching with React Query
- Debounced search (300ms)
- Optimized database indexes
- Lazy loading of address lists
- Efficient re-renders with proper memoization

## Future Enhancements

See `docs/address-manager-design.md` for:
- Geocoding integration
- Map-based address selection
- Bulk address import
- Address validation improvements
- Analytics and insights

## Documentation

Detailed phase documentation:
- `address-manager-design.md` - Initial design and architecture
- `address-manager-phases-1-2-complete.md` - Foundation & core components
- `address-manager-phases-3-4-complete.md` - Search & integration
- `address-manager-phases-5-6-complete.md` - Favorites & recents
- `address-manager-phases-7-8-complete.md` - Restaurant database & UI polish

## Migration Guide

To use the Address Manager in new forms:

1. Import the component:
```tsx
import { AddressSelector } from '@/components/AddressSelector';
```

2. Add to your form:
```tsx
<AddressSelector
  mode="client" // or "admin"
  type="pickup" // or "delivery"
  onSelect={(address) => {
    setValue("pickupAddress", address);
  }}
  selectedAddressId={watch("pickupAddress")?.id}
  showFavorites
  showRecents
  allowAddNew
/>
```

3. Ensure address type in form schema:
```typescript
pickupAddress: addressSchema,
deliveryAddress: addressSchema,
```

## Support

For questions or issues related to the Address Manager feature, refer to the phase completion documentation or contact the development team.
