# Address Manager Revamp - Comprehensive Refactor

## Project Context
You're working on a Next.js application with TypeScript, using Prisma/Supabase, shadcn/ui components, and Tailwind CSS. The current address manager has consistency issues, outdated UI patterns, and poor UX flow.

## Current Codebase Location
```
Users/ealanis/Development/current-projects/ready-set
```

## Files to Refactor

### Primary Components
1. `src/components/AddressManager/UserAddresses.tsx` - Main address list view
2. `src/components/AddressManager/AddressModal.tsx` - Add/Edit modal
3. `src/components/AddressManager/AddAddressForm.tsx` - Form component
4. `src/app/(site)/addresses/page.tsx` - Page wrapper

## Design System Requirements

### Color Palette
- Primary: `#FBD113` (yellow/gold from logo)
- Accent: `#ffc61a` (custom yellow)
- Use existing Tailwind dark mode support
- Semantic colors: success (green), error (red), info (blue), warning (amber)

### Typography
- Headings: Font semibold with proper hierarchy
- Body: Clear readable sizes (14px-16px base)
- Labels: 12px-14px, medium weight
- Consistent spacing using Tailwind's spacing scale

### Component Patterns
- Use shadcn/ui components exclusively
- Follow Tailwind best practices
- Mobile-first responsive design
- Smooth transitions and animations
- Loading states with skeleton screens

## Specific Issues to Fix

### 1. Inconsistent Modal Experience
**Current Problems:**
- Modal uses generic white background without brand consistency
- Form fields lack proper spacing and visual hierarchy
- No clear visual separation between sections
- Cancel/Save buttons lack proper emphasis

**Required Changes:**
- Redesign modal with better visual hierarchy
- Add subtle background colors to distinguish sections
- Implement proper form field grouping
- Use card components within modal for better organization
- Add clear visual feedback for required fields

### 2. Address Card Layout Issues
**Current Problems:**
- Cards feel cramped and information is dense
- Badge placement is inconsistent
- Action buttons compete for attention
- No clear visual hierarchy between address types

**Required Changes:**
- Redesign address cards with better spacing (p-6 instead of p-4)
- Create a clear header section with badges
- Implement a hierarchical layout: Name → Badges → Address → Metadata
- Use icon buttons for edit/delete actions
- Add hover states with subtle elevation changes
- Implement status indicators using color-coded left borders

### 3. Filtering System
**Current Problems:**
- Tab system feels basic and lacks visual feedback
- Active state is not prominent enough
- No count indicators for each filter

**Required Changes:**
- Redesign tabs with pill-style buttons
- Add address counts for each filter type
- Implement smooth transitions between filter states
- Use primary color for active state
- Add subtle hover effects

### 4. Empty States
**Current Problems:**
- Generic "No addresses found" message
- Lacks helpful guidance
- No visual elements

**Required Changes:**
- Create engaging empty state components
- Add relevant icons or illustrations
- Provide contextual help text
- Make CTA button prominent and inviting

### 5. Pagination
**Current Problems:**
- Basic pagination controls
- Poor mobile experience
- No loading states between pages

**Required Changes:**
- Implement skeleton loading during pagination
- Better mobile pagination with page info
- Smooth transitions between pages
- Add subtle animations

## Detailed Implementation Tasks

### Task 1: Redesign AddressCard Component
Create a new component: `src/components/AddressManager/AddressCard.tsx`

**Requirements:**
- Use Card, CardHeader, CardContent from shadcn/ui
- Implement status indicator (left border: 3px solid)
  - Shared addresses: blue-500
  - Owner addresses: green-500
  - Standard addresses: gray-300
- Header section:
  - Address name (text-lg font-semibold)
  - Badge row with proper spacing (gap-2)
  - Owner badge: bg-green-100 text-green-800
  - Shared badge: bg-blue-100 text-blue-800
  - Restaurant badge: bg-purple-100 text-purple-800
- Address section:
  - Clear typography hierarchy
  - Proper line height (leading-relaxed)
  - Icon prefixes for phone and parking info (use lucide-react icons)
- Actions section:
  - Icon buttons instead of text buttons
  - Edit: Pencil icon with primary color on hover
  - Delete: Trash2 icon with destructive color
  - Implement tooltips for action buttons
  - Disable states with proper opacity and cursor

### Task 2: Modernize AddressModal
Update: `src/components/AddressManager/AddressModal.tsx`

**Requirements:**
- Larger modal width: max-w-2xl
- Header redesign:
  - Add icon (MapPin from lucide-react)
  - Improve title typography
  - Add subtle description text
- Form sections:
  - Group related fields in Card components
  - Section 1: "Location Details" (County, Name)
  - Section 2: "Address Information" (Street, City, State, ZIP)
  - Section 3: "Additional Information" (Phone, Parking)
  - Section 4: "Options" (Checkboxes with better labels)
- Field improvements:
  - Add helper text for complex fields
  - Implement real-time validation with error messages
  - Use proper icons in inputs where appropriate
  - Better placeholder text
- Footer:
  - Sticky footer that stays visible during scroll
  - Cancel button: variant="outline"
  - Save button: variant="default" with primary color, includes loading spinner
  - Better spacing and alignment

### Task 3: Enhance UserAddresses Component
Update: `src/components/AddressManager/UserAddresses.tsx`

**Requirements:**
- Header redesign:
  - Larger, more prominent title (text-3xl)
  - Better subtitle with icon
  - Improved layout with proper spacing
- Filter system:
  - Replace Tabs with custom pill buttons
  - Show address count in each pill: "All (12)"
  - Active state: bg-primary text-black
  - Inactive state: bg-gray-100 hover:bg-gray-200
  - Smooth transitions
- Add New button:
  - Prominent placement
  - Use Plus icon from lucide-react
  - Better hover state with slight scale effect
- Address grid/list:
  - Use CSS Grid instead of space-y
  - Responsive: 1 column on mobile, 2 on tablet, 3 on desktop
  - Smooth loading transitions
  - Skeleton screens during loading
- Pagination redesign:
  - Better mobile experience
  - Add "Showing X-Y of Z addresses" text
  - Smooth transitions with opacity changes

### Task 4: Improve AddAddressForm
Update: `src/components/AddressManager/AddAddressForm.tsx`

**Requirements:**
- Better form field organization using Grid
- Proper responsive breakpoints
- Add field icons (MapPin, Building2, Phone, etc.)
- Improve error messaging:
  - Inline errors with red-500 color
  - Error icons
  - Helpful error messages
- Better checkbox styling:
  - Larger clickable area
  - Better label typography
  - Helper text for "shared" option
- Loading states:
  - Disable all fields during submission
  - Spinner on submit button
  - Prevent double submissions

### Task 5: Create Supporting Components

#### AddressCardSkeleton
`src/components/AddressManager/AddressCardSkeleton.tsx`
- Skeleton loader matching AddressCard layout
- Use Skeleton component from shadcn/ui
- Proper animation

#### EmptyAddressState
`src/components/AddressManager/EmptyAddressState.tsx`
- Centered content with icon
- Engaging copy
- Prominent CTA button
- Responsive layout

#### AddressFormSection
`src/components/AddressManager/AddressFormSection.tsx`
- Reusable section wrapper for form
- Props: title, description, children
- Consistent styling across sections

### Task 6: Enhance TypeScript Types
Update: `src/types/address.ts`

**Add:**
```typescript
// Filter type for better type safety
export type AddressFilter = 'all' | 'shared' | 'private';

// Enhanced Address type with computed properties
export interface EnhancedAddress extends Address {
  displayName: string;
  fullAddress: string;
  isOwner: boolean;
}

// Form validation errors
export interface AddressFormErrors {
  county?: string;
  name?: string;
  street1?: string;
  city?: string;
  state?: string;
  zip?: string;
  [key: string]: string | undefined;
}
```

## Animation & Transitions

### Use Tailwind Transitions
- Card hover: `transition-all duration-200 ease-in-out hover:shadow-lg`
- Button hover: `transition-colors duration-150`
- Filter pills: `transition-all duration-200 ease-out`
- Modal: `animate-in fade-in-50 duration-300`
- Skeleton: `animate-pulse`

### Custom Animations
Add to `tailwind.config.ts` if needed:
```typescript
animation: {
  'slide-up': 'slideUp 0.3s ease-out',
  'fade-in': 'fadeIn 0.2s ease-in',
}
keyframes: {
  slideUp: {
    '0%': { transform: 'translateY(10px)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
}
```

## Accessibility Requirements

1. **Keyboard Navigation**
   - All interactive elements must be keyboard accessible
   - Proper focus indicators (ring-2 ring-primary)
   - Skip links for screen readers

2. **ARIA Labels**
   - Proper ARIA labels for icon buttons
   - Form field descriptions for screen readers
   - Loading state announcements

3. **Color Contrast**
   - Ensure WCAG AA compliance
   - Test with dark mode enabled
   - Don't rely solely on color for information

4. **Focus Management**
   - Trap focus in modal
   - Return focus to trigger after modal close
   - Logical tab order

## Performance Optimizations

1. **React Query Implementation**
   - Already implemented in useAddresses hook
   - Ensure proper cache invalidation
   - Optimize stale time settings

2. **Component Memoization**
   - Memo AddressCard for list rendering
   - useCallback for event handlers in UserAddresses
   - Prevent unnecessary re-renders

3. **Lazy Loading**
   - Consider dynamic imports for modal
   - Image optimization if added
   - Code splitting where appropriate

4. **Bundle Size**
   - Use lucide-react icons (already tree-shakeable)
   - Avoid unnecessary dependencies
   - Check bundle impact of changes

## Testing Requirements

1. **Component Tests**
   - Ensure existing tests still pass
   - Update snapshots if needed
   - Add tests for new components

2. **Integration Tests**
   - Test complete add/edit/delete flow
   - Test filter functionality
   - Test pagination

3. **Accessibility Tests**
   - Keyboard navigation
   - Screen reader compatibility
   - Color contrast

## Migration Strategy

1. **Phase 1: New Components** (Non-breaking)
   - Create AddressCard.tsx
   - Create AddressCardSkeleton.tsx
   - Create EmptyAddressState.tsx
   - Create AddressFormSection.tsx

2. **Phase 2: Update Modal** (Low risk)
   - Refactor AddressModal.tsx
   - Update AddAddressForm.tsx
   - Test thoroughly

3. **Phase 3: Update Main View** (Higher risk)
   - Refactor UserAddresses.tsx
   - Update addresses/page.tsx if needed
   - Ensure backward compatibility

4. **Phase 4: Polish & Optimize**
   - Add animations
   - Performance testing
   - Accessibility audit
   - Dark mode verification

## Success Criteria

- [ ] All current functionality preserved
- [ ] No breaking changes to API
- [ ] Responsive on mobile, tablet, desktop
- [ ] Dark mode works correctly
- [ ] All tests passing
- [ ] Improved performance (React DevTools profiling)
- [ ] Better UX based on user testing
- [ ] Accessibility compliance
- [ ] Code is maintainable and well-documented

## Important Notes

1. **Don't break existing functionality** - This is a UI/UX revamp, not a feature rewrite
2. **Preserve type safety** - Maintain strict TypeScript usage
3. **Follow existing patterns** - Stay consistent with rest of codebase
4. **Test thoroughly** - Each phase should be tested before moving forward
5. **Maintain dark mode** - Ensure all new components work in dark mode
6. **Document changes** - Update component documentation and comments

## Getting Started

1. Review current implementation in listed files
2. Create new components in Phase 1
3. Test new components in isolation
4. Integrate progressively
5. Get feedback at each phase
6. Iterate based on testing

Remember: The goal is to modernize the UI while maintaining reliability and performance. Focus on incremental improvements rather than a complete rewrite.