# ServiceFeaturesSection Component

A reusable, responsive hero section component with background image handling, partners carousel, and service features grid. This component addresses mobile performance issues with background attachment and includes comprehensive error boundaries and loading states.

## Features

✅ **Responsive Background Handling**: Fixed attachment for desktop, scroll for mobile/tablets  
✅ **Error Boundaries**: Graceful error handling with fallback UI  
✅ **Loading States**: Smooth loading transitions and image loading indicators  
✅ **Performance Optimized**: Debounced resize handlers and lazy loading  
✅ **Fully Accessible**: ARIA labels, proper alt texts, and keyboard navigation  
✅ **TypeScript Ready**: Complete type definitions and interfaces  
✅ **Customizable**: Configurable content, styling, and behavior

## Usage

```typescript
import ServiceFeaturesSection from '@/components/ui/ServiceFeaturesSection';
import { Clock, Truck, Shield } from 'lucide-react';

const MyPage = () => {
  const customFeatures = [
    {
      icon: Truck,
      title: "Fast Delivery",
      description: "Get your items delivered in under 2 hours"
    },
    {
      icon: Clock,
      title: "24/7 Support",
      description: "Round-the-clock customer assistance"
    },
    {
      icon: Shield,
      title: "Secure & Safe",
      description: "Your data and payments are protected"
    }
  ];

  const customPartners = [
    { name: "Partner 1", logo: "/logo1.jpg" },
    { name: "Partner 2", logo: "/logo2.jpg" }
  ];

  const handleGetQuote = () => {
    console.log("Quote requested");
  };

  const handleScheduleCall = () => {
    console.log("Call scheduled");
  };

  return (
    <ServiceFeaturesSection
      title="Premium Services"
      subtitle="Your trusted partner since 2019"
      backgroundImage="/images/hero-bg.jpg"
      features={customFeatures}
      partners={customPartners}
      primaryButtonText="Get Quote"
      secondaryButtonText="Schedule Call"
      onPrimaryClick={handleGetQuote}
      onSecondaryClick={handleScheduleCall}
      variant="logistics"
    />
  );
};

// Example with custom secondary button (for complex interactions like scheduling)
const MyPageWithCustomButton = () => {
  return (
    <ServiceFeaturesSection
      title="Premium Services"
      subtitle="Your trusted partner since 2019"
      primaryButtonText="Get Quote"
      onPrimaryClick={handleGetQuote}
      customSecondaryButton={
        <ScheduleDialog
          buttonText="Schedule a Call"
          calendarUrl="https://calendar.google.com/calendar/appointments/..."
          className="rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50"
        />
      }
      variant="logistics"
    />
  );
};
```

## Props

### ServiceFeaturesSectionProps

| Prop                    | Type                                                | Default                             | Description                                                    |
| ----------------------- | --------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `title`                 | `string`                                            | `"Premium Services"`                | Main heading text                                              |
| `subtitle`              | `string`                                            | `"Your trusted partner since 2019"` | Subtitle text                                                  |
| `backgroundImage`       | `string`                                            | `"/images/logistics/bg-hero.png"`   | Background image URL                                           |
| `partners`              | `Partner[]`                                         | Default partners array              | Array of partner objects                                       |
| `features`              | `ServiceFeature[]`                                  | Default features array              | Array of service feature objects                               |
| `primaryButtonText`     | `string`                                            | `"Get Quote"`                       | Primary button text                                            |
| `secondaryButtonText`   | `string`                                            | `"Schedule Call"`                   | Secondary button text                                          |
| `onPrimaryClick`        | `() => void`                                        | `undefined`                         | Primary button click handler                                   |
| `onSecondaryClick`      | `() => void`                                        | `undefined`                         | Secondary button click handler                                 |
| `customSecondaryButton` | `React.ReactNode`                                   | `undefined`                         | Custom secondary button component (overrides onSecondaryClick) |
| `variant`               | `"logistics" \| "bakery" \| "flowers" \| "default"` | `"default"`                         | Component variant                                              |
| `className`             | `string`                                            | `""`                                | Additional CSS classes                                         |

### Partner Interface

```typescript
interface Partner {
  name: string;
  logo: string;
}
```

### ServiceFeature Interface

```typescript
interface ServiceFeature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}
```

## Responsive Behavior

The component automatically adjusts background attachment based on screen size:

- **Desktop (≥1920px)**: `background-attachment: fixed` for parallax effect
- **Large Desktop (≥1366px)**: `background-attachment: fixed` with adjusted positioning
- **Tablet (768px-1023px)**: `background-attachment: scroll` for better performance
- **Mobile (<768px)**: `background-attachment: scroll` to prevent iOS issues

## Error Handling

The component includes a built-in error boundary that catches JavaScript errors and displays a fallback UI:

```typescript
// Custom fallback component
const ServiceFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center text-white p-8">
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-gray-300">
        {error?.message || "An unexpected error occurred. Please try again later."}
      </p>
    </div>
  </div>
);
```

## Performance Features

- **Debounced Resize Handlers**: Prevents excessive re-renders during window resize
- **Lazy Loading**: Partner images are loaded lazily for better initial page load
- **Loading States**: Smooth transitions with loading spinners
- **Image Preloading**: Background images are preloaded for better UX

## Testing

The component includes comprehensive unit tests covering:

- Basic rendering with default and custom props
- Loading states and transitions
- Partners carousel functionality
- Service features rendering
- Button interactions
- Responsive background behavior
- Background image handling
- Different variants
- Accessibility features

Run tests with:

```bash
pnpm test -- src/components/ui/__tests__/ServiceFeaturesSection.test.tsx
```

## Accessibility

- **ARIA Labels**: All interactive elements have proper ARIA labels
- **Alt Text**: All images include descriptive alt text
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Focus Management**: Proper focus indicators and management
- **Screen Reader Support**: Semantic HTML structure for screen readers

## Integration with LogisticsHero

The LogisticsHero component has been refactored to use this shared component:

```typescript
// Before: Complex, duplicated code
// After: Simple, reusable implementation

const LogisticsPage: React.FC = () => {
  const logisticsFeatures = [/* ... */];

  return (
    <ServiceFeaturesSection
      title="Premium Logistics Services"
      subtitle="Bay Area's Most Trusted Delivery Partner Since 2019"
      backgroundImage="/images/logistics/bg-hero.png"
      features={logisticsFeatures}
      variant="logistics"
    />
  );
};
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Graceful degradation for older browsers

## Migration Guide

When migrating existing hero components to use ServiceFeaturesSection:

1. Extract your custom features and partners data
2. Replace the existing component with ServiceFeaturesSection
3. Pass your data as props
4. Update any custom styling using the className prop
5. Implement button click handlers
6. Update tests to use the new component structure

## Contributing

When making changes to this component:

1. Ensure all tests pass: `pnpm test -- ServiceFeaturesSection.test.tsx`
2. Test on different screen sizes and devices
3. Verify accessibility with screen readers
4. Update this README if adding new features
5. Follow the existing TypeScript patterns and interfaces
