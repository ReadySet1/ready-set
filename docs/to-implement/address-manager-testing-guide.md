# Address Manager Revamp - Testing Guide

## Quick Start Testing

### 1. Start the Development Server

```bash
cd /Users/fersanz/Documents/ready-set
npm run dev
```

### 2. Navigate to Address Manager

Open your browser to: `http://localhost:3000/addresses`

## Visual Inspection Checklist

### Header Section

- [ ] Large "Your Addresses" title with MapPin icon is visible
- [ ] Subtitle text is readable and properly positioned
- [ ] Gradient background displays correctly
- [ ] Filter pills show proper styling (rounded, with counts)
- [ ] Active filter has yellow/gold (primary) background
- [ ] "Add New Address" button is prominent with Plus icon

### Address Cards

- [ ] Cards display in responsive grid (1, 2, or 3 columns based on screen size)
- [ ] Each card has colored left border (blue=shared, green=owner, gray=standard)
- [ ] Badges (Owner, Shared, Restaurant) display with proper colors
- [ ] Edit/Delete icon buttons visible in top-right
- [ ] Hover effect shows shadow elevation
- [ ] MapPin, Phone, Car icons appear next to respective information
- [ ] Tooltips show on icon button hover

### Address Modal

- [ ] Modal opens with proper width (larger than before)
- [ ] Header shows MapPin icon and descriptive text
- [ ] Form sections are clearly separated with cards
- [ ] Section icons display (MapPin, Building2, Settings2)
- [ ] All form fields have proper labels with asterisks for required fields
- [ ] Placeholder text is helpful and clear
- [ ] Checkboxes have descriptive helper text below them
- [ ] Error messages appear inline in red when validation fails
- [ ] Submit button shows spinner during save
- [ ] Sticky footer stays visible when scrolling long form

### Loading States

- [ ] Skeleton cards appear during initial load
- [ ] Skeleton layout matches actual card layout
- [ ] Loading spinner appears in buttons during operations
- [ ] Page transitions are smooth

### Empty States

- [ ] Empty state shows large MapPin icon
- [ ] Contextual message changes based on filter type
- [ ] "Add Your First Address" button is prominent
- [ ] Layout is centered and visually appealing

### Pagination

- [ ] "Showing X-Y of Z addresses" text displays
- [ ] Page numbers show correctly
- [ ] Current page is highlighted with primary color
- [ ] Previous/Next buttons disable appropriately
- [ ] Ellipsis (...) shows for skipped page numbers
- [ ] Mobile view shows "X of Y" format

## Functional Testing

### Test Scenario 1: Add New Address

1. Click "Add New Address" button
2. Modal should open with empty form
3. Try submitting without filling required fields
   - Expected: Red error messages appear
4. Fill all required fields:
   - County: Select any county
   - Street Address: "123 Test St"
   - City: "San Francisco"
   - State: "CA"
   - ZIP: "94103"
5. Click "Save Address"
   - Expected: Spinner shows, modal closes, new address appears in grid

### Test Scenario 2: Edit Address

1. Click Edit button (pencil icon) on any address you own
2. Modal opens with pre-filled form
3. Change the name field to "Updated Test Address"
4. Click "Update Address"
   - Expected: Changes reflect immediately in card

### Test Scenario 3: Delete Address

1. Click Delete button (trash icon) on an address you own
2. Confirmation dialog appears
3. Click "Delete Address"
   - Expected: Address removes from grid

### Test Scenario 4: Filter Addresses

1. Click "Private" filter pill
   - Expected: Shows only private addresses
   - Count updates in pill
2. Click "Shared" filter pill
   - Expected: Shows only shared addresses
   - Count updates in pill
3. Click "All" filter pill
   - Expected: Shows all addresses

### Test Scenario 5: Permissions

1. Try to edit an address you don't own
   - Expected: Edit button is disabled with tooltip explanation
2. Try to delete a shared address
   - Expected: Delete button is disabled with tooltip explanation

### Test Scenario 6: Pagination (if you have >9 addresses)

1. Add more than 9 addresses if needed
2. Navigate to page 2
   - Expected: URL updates, new addresses load smoothly
3. Test Previous/Next buttons
4. Try clicking specific page numbers

## Responsive Testing

### Desktop (≥1024px)

- [ ] 3-column grid displays
- [ ] All page numbers visible in pagination
- [ ] Modal is comfortably wide
- [ ] Filter pills in single row

### Tablet (768px - 1023px)

- [ ] 2-column grid displays
- [ ] Most page numbers visible
- [ ] Modal still readable
- [ ] Filter pills might wrap

### Mobile (<768px)

- [ ] 1-column grid displays
- [ ] Pagination shows "X of Y" format
- [ ] Modal is full width with scroll
- [ ] Filter pills wrap to multiple rows
- [ ] Touch targets are adequate (48x48px minimum)
- [ ] Add button spans full width

## Dark Mode Testing

### Enable Dark Mode

Toggle your system or browser dark mode

### Check These Elements:

- [ ] Background colors invert properly
- [ ] Text remains readable (good contrast)
- [ ] Badges have dark mode variants
- [ ] Cards have proper dark background
- [ ] Border colors are subtle but visible
- [ ] Form sections have appropriate dark styling
- [ ] Modal background is dark
- [ ] Tooltips render correctly
- [ ] Empty state looks good

## Browser Testing

Test in these browsers (if available):

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Accessibility Testing

### Keyboard Navigation

1. Press Tab repeatedly
   - [ ] Focus indicators visible on all interactive elements
   - [ ] Tab order is logical
   - [ ] Can reach all buttons and form fields
2. Open modal with keyboard (Tab to button, press Enter)
   - [ ] Focus moves into modal
   - [ ] Can't tab out of modal (focus trap)
   - [ ] Escape closes modal
3. Navigate pagination with keyboard
   - [ ] All pagination controls accessible

### Screen Reader Testing (Optional)

If you have a screen reader:

1. Navigate through address cards
   - [ ] Card information is announced clearly
   - [ ] Badges are announced
2. Try form fields
   - [ ] Labels are announced
   - [ ] Required fields indicated
   - [ ] Error messages announced

## Performance Testing

### DevTools Performance

1. Open Chrome DevTools
2. Go to Performance tab
3. Record interaction (add/edit address)
4. Check for:
   - [ ] No long tasks (>50ms)
   - [ ] Smooth 60fps during animations
   - [ ] No unnecessary re-renders

### Network Throttling

1. Open DevTools Network tab
2. Set throttling to "Slow 3G"
3. Reload page
   - [ ] Skeleton loads immediately
   - [ ] Content loads progressively
   - [ ] Loading states are clear

## Error Testing

### Network Error

1. Open DevTools
2. Go to Network tab
3. Select "Offline"
4. Try to add an address
   - [ ] Error message displays
   - [ ] Retry button appears
   - [ ] Error is clear and actionable

### Validation Errors

1. Open add address modal
2. Submit with invalid data:
   - Empty required fields
   - ZIP code too short (e.g., "123")
   - [ ] Inline errors show immediately
   - [ ] Error messages are helpful

## Common Issues to Watch For

### Visual Issues

- ❌ Misaligned icons or text
- ❌ Overlapping elements on small screens
- ❌ Color contrast too low
- ❌ Truncated text
- ❌ Broken layouts at specific breakpoints

### Functional Issues

- ❌ Buttons not responding
- ❌ Modal not closing
- ❌ Form not submitting
- ❌ Data not refreshing after operations
- ❌ Pagination not working

### Performance Issues

- ❌ Slow animations/transitions
- ❌ Lag when scrolling
- ❌ Delayed response to clicks
- ❌ Flash of unstyled content

## Reporting Issues

If you find any issues, document:

1. What you were doing (steps to reproduce)
2. What you expected to happen
3. What actually happened
4. Screenshot/video if applicable
5. Browser and device information
6. Console errors (if any)

## Quick Visual Comparison

### Before (Old UI)

- Basic tabs for filters
- Simple text buttons
- Dense card layout
- Generic empty state
- Basic pagination
- Plain modal

### After (New UI)

- Custom pill filters with counts
- Icon buttons with tooltips
- Spacious card layout with status borders
- Engaging empty state with icon
- Enhanced pagination with info text
- Sectioned modal with better organization

## Success Criteria

The implementation is successful if:

- ✅ All functionality works as expected
- ✅ UI is visually appealing and modern
- ✅ Responsive on all screen sizes
- ✅ Dark mode looks good
- ✅ Performance is smooth
- ✅ No console errors
- ✅ Accessibility features work
- ✅ User experience feels improved

## Next Steps After Testing

1. **If everything works**: Ready for staging/production deployment
2. **If minor issues found**: Document and fix in follow-up PR
3. **If major issues found**: Review implementation and make corrections

---

**Happy Testing! 🎉**

For questions or issues, refer to the main implementation document:
`docs/to-implement/address-manager-revamp-completed.md`
