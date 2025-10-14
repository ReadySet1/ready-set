# Address Manager Redesign - Complete Implementation Plan

## 🎯 Project Overview

**Goal:** Create a unified, modern, and functional address management system across client and admin interfaces with consistent design and UX patterns.

**Affected Routes:**

- Client: `/catering-request` (catering order creation)
- Client: `/addresses` (address management)
- Admin: `/admin/catering-orders/new` (admin order creation)

**Current Issues:**

- No search functionality (17+ pages to browse 150 addresses)
- Inconsistent UI/UX between client and admin
- Card grid layout wastes space and requires excessive pagination
- No favorites, recents, or smart filtering
- Duplicate address selectors for pickup/delivery with same content
- Not professional looking

------

## 📐 Design System Foundation

### Design Tokens

```typescript
// src/styles/design-tokens.ts
export const designTokens = {
  colors: {
    primary: {
      50: 'hsl(221, 83%, 97%)',
      100: 'hsl(221, 83%, 93%)',
      500: 'hsl(221, 83%, 53%)',
      600: 'hsl(221, 83%, 45%)',
      700: 'hsl(221, 83%, 37%)',
    },
    neutral: {
      50: 'hsl(210, 20%, 98%)',
      100: 'hsl(210, 20%, 96%)',
      200: 'hsl(210, 16%, 93%)',
      300: 'hsl(210, 14%, 89%)',
      700: 'hsl(210, 16%, 25%)',
      800: 'hsl(210, 18%, 20%)',
      900: 'hsl(210, 20%, 15%)',
    },
    success: {
      50: 'hsl(142, 76%, 96%)',
      500: 'hsl(142, 71%, 45%)',
      600: 'hsl(142, 76%, 36%)',
    },
    warning: {
      50: 'hsl(48, 96%, 95%)',
      500: 'hsl(48, 96%, 53%)',
    },
  },
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
  },
  borderRadius: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
  },
  typography: {
    fontFamily: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
};
```

------

## 🏗️ Component Architecture

### New Shared Components

```
src/components/AddressSelector/
├── index.ts                              # Barrel export
├── AddressSelectorProvider.tsx           # Context for shared state
├── AddressSearchCombobox.tsx             # Main search input
├── AddressSectionList.tsx                # Favorites/Recents/All sections
├── AddressCompactCard.tsx                # Modern compact card
├── AddressSectionHeader.tsx              # Section headers with icons
├── AddressQuickFilters.tsx               # Pills: All/Shared/Private
├── AddressEmptyState.tsx                 # No results state
├── AddNewAddressButton.tsx               # Consistent add button
└── types.ts                              # TypeScript interfaces

src/components/AddressForm/
├── AddressFormDialog.tsx                 # Modal wrapper
├── AddressFormFields.tsx                 # Form field components
└── types.ts                              # Form types

src/hooks/
├── useAddressSearch.ts                   # Search/filter logic
├── useAddressFavorites.ts                # Favorites management
├── useAddressRecents.ts                  # Recent addresses tracking
└── useAddressSelection.ts                # Selection state management
```

------

## 📋 Implementation Phases

### Phase 1: Core Infrastructure (Day 1-2)

**1.1 Create Design Tokens**

- File: `src/styles/design-tokens.ts`
- Export all design variables
- Update `tailwind.config.ts` to use these tokens

**1.2 Create Base Types**

```typescript
// src/types/address-selector.ts
export interface AddressSelectorProps {
  mode: 'client' | 'admin';
  type?: 'pickup' | 'delivery';
  onSelect: (address: Address) => void;
  selectedAddressId?: string;
  showFavorites?: boolean;
  showRecents?: boolean;
  allowAddNew?: boolean;
  className?: string;
}

export interface AddressSection {
  id: 'favorites' | 'recents' | 'all';
  title: string;
  icon: React.ComponentType;
  addresses: Address[];
  count: number;
  emptyMessage: string;
}

export interface AddressSearchFilters {
  query: string;
  filter: AddressFilter; // 'all' | 'shared' | 'private'
  city?: string;
  county?: string;
}

export interface AddressWithMetadata extends Address {
  isFavorite?: boolean;
  lastUsedAt?: Date;
  usageCount?: number;
  distance?: number; // For future geo-sorting
}
```

**1.3 Update Database Schema**

```sql
-- Add favorites and recents tracking
CREATE TABLE IF NOT EXISTS address_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address_id)
);

CREATE TABLE IF NOT EXISTS address_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  context TEXT -- 'pickup' | 'delivery' | 'order'
);

-- Indexes for performance
CREATE INDEX idx_address_favorites_user ON address_favorites(user_id);
CREATE INDEX idx_address_usage_user_date ON address_usage_history(user_id, used_at DESC);
```

------

### Phase 2: Shared Components (Day 2-3)

**2.1 AddressSearchCombobox Component**

```typescript
// src/components/AddressSelector/AddressSearchCombobox.tsx
interface AddressSearchComboboxProps {
  addresses: Address[];
  onSelect: (address: Address) => void;
  selectedAddressId?: string;
  placeholder?: string;
  disabled?: boolean;
}

// Features:
// - Instant search with debouncing (300ms)
// - Keyboard navigation (arrow keys, enter, escape)
// - Highlight matching text
// - Show address preview on hover
// - Clear button
// - Loading state
// - Virtualized list for performance (react-window)
```

**2.2 AddressCompactCard Component**

```typescript
// src/components/AddressSelector/AddressCompactCard.tsx
interface AddressCompactCardProps {
  address: AddressWithMetadata;
  onSelect: () => void;
  isSelected: boolean;
  variant: 'default' | 'compact' | 'minimal';
  showActions?: boolean;
  onFavoriteToggle?: () => void;
  onEdit?: () => void;
}

// Visual design:
// ┌─────────────────────────────────────────┐
// │ 🏪 Restaurant Name          ⭐ [Select] │
// │ 123 Main St, City, ST 12345             │
// │ 📞 (555) 123-4567  🅿️ Parking available │
// └─────────────────────────────────────────┘
```

**2.3 AddressSectionList Component**

```typescript
// src/components/AddressSelector/AddressSectionList.tsx
interface AddressSectionListProps {
  sections: AddressSection[];
  onAddressSelect: (address: Address) => void;
  selectedAddressId?: string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

// Features:
// - Collapsible sections
// - Section counts in headers
// - Smooth animations (framer-motion)
// - Loading skeletons
// - Lazy loading for "All" section
```

**2.4 AddressQuickFilters Component**

```typescript
// src/components/AddressSelector/AddressQuickFilters.tsx
interface AddressQuickFiltersProps {
  activeFilter: AddressFilter;
  onFilterChange: (filter: AddressFilter) => void;
  counts: {
    all: number;
    shared: number;
    private: number;
  };
}

// Design: Pill-style buttons
// [All 155] [Shared 150] [Private 5]
```

------

### Phase 3: Hooks & State Management (Day 3-4)

**3.1 useAddressSearch Hook**

```typescript
// src/hooks/useAddressSearch.ts
export function useAddressSearch(addresses: Address[]) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AddressSearchFilters>({
    query: '',
    filter: 'all',
  });

  const debouncedQuery = useDebounce(query, 300);

  const filteredAddresses = useMemo(() => {
    return addresses.filter((address) => {
      // Search in: name, street1, street2, city, county
      const searchText = `${address.name} ${address.street1} ${address.street2} ${address.city} ${address.county}`.toLowerCase();
      const matchesQuery = searchText.includes(debouncedQuery.toLowerCase());
      
      // Apply filter
      const matchesFilter = 
        filters.filter === 'all' ? true :
        filters.filter === 'shared' ? address.isShared :
        filters.filter === 'private' ? !address.isShared :
        true;

      return matchesQuery && matchesFilter;
    });
  }, [addresses, debouncedQuery, filters]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    filteredAddresses,
    resultCount: filteredAddresses.length,
  };
}
```

**3.2 useAddressFavorites Hook**

```typescript
// src/hooks/useAddressFavorites.ts
export function useAddressFavorites(userId: string) {
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['address-favorites', userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('address_favorites')
        .select('address_id, addresses(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data.map(f => f.addresses);
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (addressId: string) => {
      const supabase = createClient();
      const isFavorite = favorites.some(f => f.id === addressId);
      
      if (isFavorite) {
        await supabase
          .from('address_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('address_id', addressId);
      } else {
        await supabase
          .from('address_favorites')
          .insert({ user_id: userId, address_id: addressId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['address-favorites', userId]);
    },
  });

  return {
    favorites,
    isFavorite: (addressId: string) => favorites.some(f => f.id === addressId),
    toggleFavorite: toggleFavorite.mutate,
    isLoading: toggleFavorite.isPending,
  };
}
```

**3.3 useAddressRecents Hook**

```typescript
// src/hooks/useAddressRecents.ts
export function useAddressRecents(userId: string, limit = 5) {
  return useQuery({
    queryKey: ['address-recents', userId, limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('address_usage_history')
        .select('address_id, addresses(*), used_at')
        .eq('user_id', userId)
        .order('used_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Deduplicate addresses (same address may be used multiple times)
      const uniqueAddresses = Array.from(
        new Map(data.map(item => [item.address_id, item])).values()
      );
      
      return uniqueAddresses.map(item => ({
        ...item.addresses,
        lastUsedAt: item.used_at,
      }));
    },
  });

  // Helper to track address usage
  const trackUsage = async (addressId: string, context: string) => {
    const supabase = createClient();
    await supabase
      .from('address_usage_history')
      .insert({
        user_id: userId,
        address_id: addressId,
        context,
      });
  };
}
```

------

### Phase 4: Main AddressSelector Component (Day 4-5)

**4.1 AddressSelector Main Component**

```typescript
// src/components/AddressSelector/AddressSelector.tsx
export function AddressSelector({
  mode,
  type,
  onSelect,
  selectedAddressId,
  showFavorites = true,
  showRecents = true,
  allowAddNew = true,
  className,
}: AddressSelectorProps) {
  const { user } = useAuth();
  const { data: addresses = [], isLoading } = useAddresses({ filter: 'all' });
  const { favorites } = useAddressFavorites(user?.id || '');
  const { data: recents = [] } = useAddressRecents(user?.id || '', 5);
  
  const { query, setQuery, filters, setFilters, filteredAddresses } = 
    useAddressSearch(addresses);

  const sections: AddressSection[] = useMemo(() => {
    const result: AddressSection[] = [];

    if (showFavorites && favorites.length > 0) {
      result.push({
        id: 'favorites',
        title: 'Favorites',
        icon: Star,
        addresses: favorites.filter(addr => 
          !query || addressMatchesQuery(addr, query)
        ),
        count: favorites.length,
        emptyMessage: 'No favorite addresses yet',
      });
    }

    if (showRecents && recents.length > 0) {
      result.push({
        id: 'recents',
        title: 'Recently Used',
        icon: Clock,
        addresses: recents.filter(addr => 
          !query || addressMatchesQuery(addr, query)
        ),
        count: recents.length,
        emptyMessage: 'No recent addresses',
      });
    }

    result.push({
      id: 'all',
      title: 'All Addresses',
      icon: MapPin,
      addresses: filteredAddresses,
      count: addresses.length,
      emptyMessage: 'No addresses found',
    });

    return result;
  }, [favorites, recents, filteredAddresses, query, showFavorites, showRecents]);

  const handleAddressSelect = async (address: Address) => {
    // Track usage
    if (type) {
      await trackAddressUsage(user?.id || '', address.id, type);
    }
    onSelect(address);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search */}
      <AddressSearchCombobox
        addresses={addresses}
        onSelect={handleAddressSelect}
        selectedAddressId={selectedAddressId}
        placeholder={`Search ${type || ''} addresses...`}
      />

      {/* Quick Filters */}
      <AddressQuickFilters
        activeFilter={filters.filter}
        onFilterChange={(filter) => setFilters({ ...filters, filter })}
        counts={{
          all: addresses.length,
          shared: addresses.filter(a => a.isShared).length,
          private: addresses.filter(a => !a.isShared).length,
        }}
      />

      {/* Sections */}
      <AddressSectionList
        sections={sections}
        onAddressSelect={handleAddressSelect}
        selectedAddressId={selectedAddressId}
        isLoading={isLoading}
      />

      {/* Add New Button */}
      {allowAddNew && (
        <AddNewAddressButton onClick={() => {/* Open dialog */}} />
      )}
    </div>
  );
}
```

------

### Phase 5: Update Client Pages (Day 5-6)

**5.1 Update Catering Request Page**

```typescript
// src/app/(site)/catering-request/page.tsx
// Replace old address manager with new AddressSelector

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Pickup Address */}
  <div className="space-y-3">
    <Label htmlFor="pickup-address" className="text-lg font-semibold">
      Pickup Location
    </Label>
    <AddressSelector
      mode="client"
      type="pickup"
      onSelect={(address) => {
        setFieldValue('pickupAddressId', address.id);
        setPickupAddress(address);
      }}
      selectedAddressId={values.pickupAddressId}
      showFavorites
      showRecents
      allowAddNew
    />
  </div>

  {/* Delivery Address */}
  <div className="space-y-3">
    <Label htmlFor="delivery-address" className="text-lg font-semibold">
      Delivery Location
    </Label>
    <AddressSelector
      mode="client"
      type="delivery"
      onSelect={(address) => {
        setFieldValue('deliveryAddressId', address.id);
        setDeliveryAddress(address);
      }}
      selectedAddressId={values.deliveryAddressId}
      showFavorites
      showRecents
      allowAddNew
    />
  </div>
</div>
```

**5.2 Update Addresses Management Page**

```typescript
// src/app/(site)/addresses/page.tsx
// Create modern table view with AddressSelector in "management mode"

export default function AddressesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Addresses</h1>
          <p className="text-muted-foreground">
            Manage your saved delivery and pickup locations
          </p>
        </div>
        <AddNewAddressButton />
      </div>

      <AddressManagementTable 
        addresses={addresses}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
```

------

### Phase 6: Update Admin Pages (Day 6-7)

**6.1 Update Admin Catering Order Creation**

```typescript
// src/app/(backend)/admin/catering-orders/new/NewCateringOrderClient.tsx
// Replace AddressManagerWrapper with new AddressSelector

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="rounded-lg border bg-card p-6">
    <h3 className="mb-4 text-lg font-semibold">Pickup Address</h3>
    <AddressSelector
      mode="admin"
      type="pickup"
      onSelect={(address) => {
        setValue('pickupAddress', {
          street1: address.street1,
          street2: address.street2,
          city: address.city,
          state: address.state,
          zip: address.zip,
          county: address.county,
        });
        clearErrors('pickupAddress');
      }}
      selectedAddressId={selectedPickupId}
      showFavorites
      showRecents
      allowAddNew
    />
  </div>

  <div className="rounded-lg border bg-card p-6">
    <h3 className="mb-4 text-lg font-semibold">Delivery Address</h3>
    <AddressSelector
      mode="admin"
      type="delivery"
      onSelect={(address) => {
        setValue('deliveryAddress', {
          street1: address.street1,
          street2: address.street2,
          city: address.city,
          state: address.state,
          zip: address.zip,
          county: address.county,
        });
        clearErrors('deliveryAddress');
      }}
      selectedAddressId={selectedDeliveryId}
      showFavorites
      showRecents
      allowAddNew
    />
  </div>
</div>
```

------

### Phase 7: Performance Optimization (Day 7-8)

**7.1 Implement Virtualization**

```typescript
// For large address lists (150+ items)
import { FixedSizeList } from 'react-window';

// In AddressSectionList component
<FixedSizeList
  height={600}
  itemCount={addresses.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <AddressCompactCard address={addresses[index]} />
    </div>
  )}
</FixedSizeList>
```

**7.2 Add Caching Layer**

```typescript
// React Query cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});
```

**7.3 Debounce Search**

```typescript
// Already implemented in useAddressSearch
const debouncedQuery = useDebounce(query, 300);
```

------

### Phase 8: Testing & Polish (Day 8-9)

**8.1 Unit Tests**

```typescript
// src/components/AddressSelector/__tests__/AddressSelector.test.tsx
describe('AddressSelector', () => {
  it('renders search input', () => {});
  it('filters addresses on search', () => {});
  it('shows favorites section when enabled', () => {});
  it('calls onSelect when address is selected', () => {});
  it('respects address filter (all/shared/private)', () => {});
});
```

**8.2 Integration Tests**

```typescript
// e2e/address-selector.spec.ts
test('can search and select address in catering request', async ({ page }) => {
  await page.goto('/catering-request');
  await page.fill('[data-testid="address-search"]', 'Kasa Indian');
  await page.click('[data-testid="address-card-123"]');
  await expect(page.locator('[data-testid="selected-address"]')).toContainText('Kasa Indian');
});
```

**8.3 Accessibility Audit**

- Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Screen reader compatibility (ARIA labels, live regions)
- Color contrast (WCAG AA minimum)
- Focus indicators

**8.4 Mobile Responsiveness**

- Touch-friendly hit areas (minimum 44x44px)
- Responsive breakpoints
- Bottom sheet for mobile address selection
- Swipe gestures for favorites

------

## 📊 Success Metrics

**Before:**

- Time to find address: ~2-3 minutes (pagination through 17+ pages)
- Clicks to select: 5-10 clicks
- User satisfaction: Low (based on current UX issues)

**After:**

- Time to find address: ~5-10 seconds (instant search)
- Clicks to select: 1-2 clicks
- User satisfaction: High (modern, professional, functional)

**Performance:**

- Initial load: < 1s
- Search response: < 100ms
- Smooth animations: 60fps

------

## 🚀 Deployment Strategy

### Phase 1: Feature Flag (Day 9)

```typescript
// Enable new address selector behind feature flag
const useNewAddressSelector = featureFlags.newAddressSelector;

{useNewAddressSelector ? (
  <AddressSelector {...props} />
) : (
  <LegacyAddressManager {...props} />
)}
```

### Phase 2: Beta Testing (Day 10-12)

- Enable for internal team
- Enable for 10% of users
- Collect feedback

### Phase 3: Gradual Rollout (Day 13-14)

- 25% of users
- 50% of users
- 100% of users

### Phase 4: Remove Old Code (Day 15)

- Remove legacy components
- Clean up unused code
- Update documentation

------

## 📝 Migration Checklist

- [ ] Create design tokens file
- [ ] Set up database tables (favorites, usage history)
- [ ] Create AddressSelector shared components
- [ ] Implement search/filter hooks
- [ ] Implement favorites hook
- [ ] Implement recents hook
- [ ] Update client catering request page
- [ ] Update client addresses page
- [ ] Update admin order creation page
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Accessibility audit
- [ ] Mobile responsive testing
- [ ] Performance optimization
- [ ] Feature flag setup
- [ ] Beta testing
- [ ] Production rollout
- [ ] Remove legacy code

------

## 🎨 Visual Design Reference

### Color Palette

```css
/* Primary - Blue */
--primary-50: #eff6ff;
--primary-500: #3b82f6;
--primary-600: #2563eb;

/* Success - Green */
--success-50: #f0fdf4;
--success-500: #22c55e;

/* Warning - Amber */
--warning-50: #fffbeb;
--warning-500: #f59e0b;

/* Neutral - Slate */
--neutral-50: #f8fafc;
--neutral-100: #f1f5f9;
--neutral-700: #334155;
--neutral-900: #0f172a;
```

### Typography Scale

```css
/* Headings */
h1: 24px / 32px - font-bold
h2: 20px / 28px - font-semibold
h3: 18px / 24px - font-semibold
h4: 16px / 24px - font-medium

/* Body */
body: 16px / 24px - font-normal
small: 14px / 20px - font-normal
xs: 12px / 16px - font-normal
```

### Spacing System

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

------

## 🔧 Technical Decisions

### Why React Query?

- Built-in caching
- Automatic refetching
- Optimistic updates
- Better than manual state management

### Why Framer Motion?

- Smooth animations
- Better UX perception
- Easy spring physics

### Why react-window?

- Virtualization for 150+ addresses
- Better performance
- Smooth scrolling

### Why Combobox over Dropdown?

- Searchable
- Keyboard navigation
- Better UX for large lists

------

## 📚 Documentation Updates

After implementation, update:

1. Component Storybook stories
2. README.md with new features
3. API documentation
4. User guide (help center)
5. Admin training materials

------

## 🐛 Known Issues & Future Enhancements

### Known Issues

- None currently

### Future Enhancements (v2)

- Geolocation-based sorting (nearest first)
- Bulk import addresses from CSV
- Address validation API integration (Google Places)
- Map view for address selection
- Address sharing between team members
- Custom address categories/tags
- Address history/audit log
- Export addresses to PDF/CSV

------

This plan is ready for implementation with Claude Code. Each phase can be executed independently with clear acceptance criteria.