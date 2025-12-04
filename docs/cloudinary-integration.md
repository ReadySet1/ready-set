# Cloudinary Image CDN Integration

This document provides comprehensive guidance for working with the Cloudinary image CDN integration in the Ready Set codebase.

## Overview

Cloudinary is a cloud-based image management service that provides:
- **Automatic format optimization** - Serves WebP to Chrome/Edge, AVIF to Safari, JPEG fallback
- **Quality auto-tuning** - Adjusts compression based on browser/device
- **On-the-fly transformations** - Resize, crop, and optimize images via URL parameters
- **Global CDN delivery** - Fast image loading worldwide

All static images in `/public/images/` have been migrated to Cloudinary and served via our utility functions.

## Setup Guide

### Environment Variables

Add these to your `.env.local` file:

```env
# Public (safe to expose to client - required for URL generation)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dzm8qcnfd

# Server-side only (for migration scripts - DO NOT expose to client)
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> **Note:** The cloud name is already configured with a default fallback. API credentials are only needed if running the migration script.

### Cloudinary Dashboard Access

1. Visit [cloudinary.com](https://cloudinary.com) and log in with team credentials
2. Navigate to **Media Library** > **ready-set** folder to view all migrated images
3. Use the **Media Explorer** to browse folder structure

### Verify Integration

Test that the integration is working:

```typescript
import { getCloudinaryUrl } from '@/lib/cloudinary';

// Should return a valid Cloudinary URL
console.log(getCloudinaryUrl('logo/new-logo-ready-set'));
// Output: https://res.cloudinary.com/dzm8qcnfd/image/upload/f_auto,q_auto/ready-set/logo/new-logo-ready-set
```

## Usage Guide

### Adding New Images

**Option 1: Upload via Cloudinary Dashboard (Recommended)**
1. Log into [Cloudinary Dashboard](https://cloudinary.com/console)
2. Navigate to **Media Library** > **ready-set**
3. Create appropriate subfolder (e.g., `team/`, `blog/`, `food/`)
4. Upload image - note the public ID (path without extension)
5. Use in code with `getCloudinaryUrl('folder/image-name')`

**Option 2: Use Migration Script (Bulk Upload)**
```bash
# Add images to /public/images/ folder first
# Then run migration script

# Preview what will be uploaded
npx ts-node scripts/migrate-images-to-cloudinary.ts --dry-run

# Run migration
npx ts-node scripts/migrate-images-to-cloudinary.ts

# Force re-upload existing images
npx ts-node scripts/migrate-images-to-cloudinary.ts --force
```

### Basic URL Generation

```typescript
import { getCloudinaryUrl } from '@/lib/cloudinary';

// Basic usage - auto format & quality optimization
const logoUrl = getCloudinaryUrl('logo/new-logo-ready-set');
```

### With Next.js Image Component

```tsx
import Image from 'next/image';
import { getCloudinaryUrl } from '@/lib/cloudinary';

// Fixed dimensions
<Image
  src={getCloudinaryUrl('logo/new-logo-ready-set')}
  alt="Ready Set Logo"
  width={140}
  height={30}
/>

// Fill container
<Image
  src={getCloudinaryUrl('hero/hero-bg')}
  alt="Hero background"
  fill
  className="object-cover"
/>
```

### With Transformations

```typescript
import { getCloudinaryUrl } from '@/lib/cloudinary';

// Resize and crop
const heroUrl = getCloudinaryUrl('hero/hero-bg', {
  width: 1920,
  height: 1080,
  crop: 'fill',
});

// Thumbnail with face detection
const avatarUrl = getCloudinaryUrl('team/john-doe', {
  width: 100,
  height: 100,
  crop: 'thumb',
  gravity: 'face',
});

// High quality for print
const printUrl = getCloudinaryUrl('brochure/cover', {
  quality: 95,
  format: 'png',
});
```

### Responsive Images

```tsx
import { getResponsiveCloudinaryUrl } from '@/lib/cloudinary';

const { src, srcSet } = getResponsiveCloudinaryUrl(
  'hero/hero-bg',
  [640, 1024, 1920]  // Breakpoints
);

<img
  src={src}
  srcSet={srcSet}
  sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px"
  alt="Hero"
/>
```

### Background Images in CSS

```tsx
import { getCloudinaryUrl } from '@/lib/cloudinary';

const backgroundStyle: React.CSSProperties = {
  backgroundImage: `url('${getCloudinaryUrl('hero/hero-bg')}')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};
```

## API Reference

### `getCloudinaryUrl(publicId, options?)`

Generate an optimized Cloudinary URL for an image.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `publicId` | `string` | Image path without folder prefix or extension (e.g., `'logo/logo-dark'`) |
| `options` | `CloudinaryTransformOptions` | Optional transformation options |

**Returns:** `string` - Full Cloudinary URL

**Example:**
```typescript
getCloudinaryUrl('logo/logo-dark')
// → https://res.cloudinary.com/dzm8qcnfd/image/upload/f_auto,q_auto/ready-set/logo/logo-dark

getCloudinaryUrl('hero/hero-bg', { width: 1920, height: 1080, crop: 'fill' })
// → https://res.cloudinary.com/dzm8qcnfd/image/upload/f_auto,q_auto,w_1920,h_1080,c_fill/ready-set/hero/hero-bg
```

### `getResponsiveCloudinaryUrl(publicId, breakpoints, options?)`

Generate responsive image URLs with srcSet for multiple breakpoints.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `publicId` | `string` | Image path |
| `breakpoints` | `number[]` | Array of widths for srcset (e.g., `[640, 1024, 1920]`) |
| `options` | `CloudinaryTransformOptions` | Optional base options (width excluded) |

**Returns:** `{ src: string; srcSet: string }`

### `localPathToPublicId(localPath)`

Convert a local image path to a Cloudinary public ID.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `localPath` | `string` | Local path (e.g., `'/images/logo/logo-dark.png'`) |

**Returns:** `string` - Public ID (e.g., `'logo/logo-dark'`)

### `CloudinaryTransformOptions`

| Option | Type | Description |
|--------|------|-------------|
| `width` | `number` | Width in pixels |
| `height` | `number` | Height in pixels |
| `format` | `'auto' \| 'webp' \| 'avif' \| 'png' \| 'jpg'` | Output format (default: `'auto'`) |
| `quality` | `'auto' \| number` | Quality 1-100 or auto (default: `'auto'`) |
| `crop` | `'fill' \| 'fit' \| 'scale' \| 'crop' \| 'thumb'` | Crop mode |
| `gravity` | `'auto' \| 'face' \| 'center'` | Focus point for cropping |
| `dpr` | `1 \| 2 \| 3 \| 'auto'` | Device pixel ratio |

**Crop Modes:**
- `fill` - Resize and crop to exact dimensions (may crop edges)
- `fit` - Resize to fit within dimensions, maintaining aspect ratio
- `scale` - Resize to exact dimensions (may distort)
- `crop` - Crop to exact dimensions from center
- `thumb` - Generate thumbnail

## Best Practices

### Image Optimization

1. **Use default auto-optimization** - Don't override `format` or `quality` unless necessary
2. **Specify dimensions** - Always provide `width`/`height` to prevent layout shift
3. **Use responsive images** - Use `getResponsiveCloudinaryUrl` for hero images and large visuals
4. **Lazy load** - Use Next.js Image component which handles lazy loading automatically

### Naming Conventions

- Use lowercase with hyphens: `team-photo.jpg` not `Team Photo.jpg`
- Descriptive names: `john-doe-headshot.jpg` not `IMG_1234.jpg`
- No special characters or spaces

### Folder Structure

All images are stored under `ready-set/` in Cloudinary:

```
ready-set/
├── logo/           # Logo variants
├── hero/           # Hero section backgrounds
├── food/           # Food delivery images
│   └── partners/   # Partner logos
├── team/           # Team member photos
├── testimonials/   # Testimonial avatars
├── blog/           # Blog content images
├── virtual/        # Virtual assistant images
├── resources/      # Resource guide images
├── logistics/      # Logistics/delivery images
├── specialty/      # Specialty delivery images
├── flowers/        # Flower delivery images
├── bakery/         # Bakery delivery images
├── social/         # Social media icons
├── footer/         # Footer branding
├── about/          # About page images
└── maps/           # Geographic maps
```

### When to Use Transformations

| Scenario | Recommended Options |
|----------|---------------------|
| Logos | None (use as-is for sharp edges) |
| Hero images | `{ width: 1920, height: 1080, crop: 'fill' }` |
| Thumbnails | `{ width: 100, height: 100, crop: 'thumb' }` |
| Team photos | `{ width: 400, height: 400, crop: 'fill', gravity: 'face' }` |
| Icons | `{ width: 48, height: 48, crop: 'fit' }` |

## Migration Log

### Migration Statistics
- **Total Images Migrated:** 227
- **Migration Date:** December 2024
- **Source:** `/public/images/`
- **Destination:** Cloudinary `ready-set/` folder

### Image Registry

A complete mapping of all migrated images is maintained in:
```
src/lib/cloudinary/image-map.json
```

Each entry includes:
```json
{
  "localPath": "/images/logo/logo-dark.png",
  "publicId": "logo/logo-dark",
  "cloudinaryUrl": "https://res.cloudinary.com/dzm8qcnfd/image/upload/v.../ready-set/logo/logo-dark.png",
  "format": "png",
  "size": 42941
}
```

### Migration Script

Located at: `scripts/migrate-images-to-cloudinary.ts`

```bash
# Commands
npx ts-node scripts/migrate-images-to-cloudinary.ts --dry-run  # Preview
npx ts-node scripts/migrate-images-to-cloudinary.ts            # Run migration
npx ts-node scripts/migrate-images-to-cloudinary.ts --force    # Force re-upload
npx ts-node scripts/migrate-images-to-cloudinary.ts --verbose  # Detailed output
```

Features:
- Dry-run mode for previewing
- Incremental sync (skips existing images)
- Rate limiting (100ms delay between uploads)
- Generates `image-map.json` registry

## Troubleshooting

### Image Not Loading

1. **Check public ID format:**
   - Correct: `logo/logo-dark` (no extension, no leading slash)
   - Wrong: `/images/logo/logo-dark.png`

2. **Verify image exists in Cloudinary:**
   - Check Cloudinary dashboard > Media Library > ready-set folder

3. **Check console for URL:**
   ```typescript
   console.log(getCloudinaryUrl('your/image-path'));
   ```

### 404 Errors

- Image may not have been migrated
- Check `image-map.json` for the correct public ID
- Re-run migration script if needed

### Slow Loading

- Ensure you're using appropriate dimensions (don't serve 4K images for thumbnails)
- Use `getResponsiveCloudinaryUrl` for large images
- Verify CDN is being used (URL should contain `res.cloudinary.com`)

### Build Errors

If TypeScript errors occur:
```bash
pnpm db:generate  # Regenerate Prisma client
pnpm typecheck    # Verify types
```

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/cloudinary/index.ts` | Main exports and module documentation |
| `src/lib/cloudinary/url-builder.ts` | URL generation functions |
| `src/lib/cloudinary/types.ts` | TypeScript interfaces |
| `src/lib/cloudinary/config.ts` | Configuration and constants |
| `src/lib/cloudinary/image-map.json` | Registry of migrated images |
| `scripts/migrate-images-to-cloudinary.ts` | Migration script |
| `.env.example` | Environment variable documentation |
