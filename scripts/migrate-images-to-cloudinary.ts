#!/usr/bin/env npx ts-node

/**
 * Cloudinary Image Migration Script
 *
 * Migrates all images from /public/images/ to Cloudinary CDN.
 *
 * Usage:
 *   npx ts-node scripts/migrate-images-to-cloudinary.ts [options]
 *
 * Options:
 *   --dry-run    Preview what would be uploaded without actually uploading
 *   --force      Re-upload images even if they already exist in Cloudinary
 *   --verbose    Show detailed progress for each file
 *
 * Environment Variables Required:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * @example
 * # Dry run to see what would be uploaded
 * npx ts-node scripts/migrate-images-to-cloudinary.ts --dry-run
 *
 * # Full migration
 * npx ts-node scripts/migrate-images-to-cloudinary.ts
 *
 * # Force re-upload all images
 * npx ts-node scripts/migrate-images-to-cloudinary.ts --force
 */

import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables from .env.local
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });

// Configuration
const CONFIG = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dzm8qcnfd',
  folder: 'ready-set',
  publicImagesDir: path.join(process.cwd(), 'public', 'images'),
  outputMappingFile: path.join(
    process.cwd(),
    'src',
    'lib',
    'cloudinary',
    'image-map.json'
  ),
  // Rate limiting: delay between uploads (ms)
  uploadDelay: 100,
  // Supported image extensions
  supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
};

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const VERBOSE = args.includes('--verbose');

// Stats tracking
interface MigrationStats {
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: { file: string; error: string }[];
}

const stats: MigrationStats = {
  total: 0,
  uploaded: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

// Image mapping for components
interface ImageMapping {
  localPath: string;
  publicId: string;
  cloudinaryUrl: string;
  format: string;
  size: number;
}

const imageMapping: ImageMapping[] = [];

/**
 * Configure Cloudinary SDK
 */
function configureCloudinary(): void {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('\n❌ Error: Cloudinary credentials not configured');
    console.error('Set the following environment variables:');
    console.error('  - CLOUDINARY_API_KEY');
    console.error('  - CLOUDINARY_API_SECRET');
    console.error('\nYou can find these in your Cloudinary dashboard.');
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: CONFIG.cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  console.log(`✅ Cloudinary configured for cloud: ${CONFIG.cloudName}`);
}

/**
 * Recursively find all image files in a directory
 */
function findImageFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findImageFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONFIG.supportedExtensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Convert local file path to Cloudinary public ID
 */
function getPublicId(filePath: string): string {
  // Get relative path from public/images/
  const relativePath = path.relative(CONFIG.publicImagesDir, filePath);

  // Remove extension
  const withoutExt = relativePath.replace(/\.[^/.]+$/, '');

  // Replace backslashes with forward slashes (Windows compatibility)
  const normalized = withoutExt.replace(/\\/g, '/');

  // Prefix with folder
  return `${CONFIG.folder}/${normalized}`;
}

/**
 * Get local path for component reference
 */
function getLocalPath(filePath: string): string {
  const relativePath = path.relative(CONFIG.publicImagesDir, filePath);
  return `/images/${relativePath.replace(/\\/g, '/')}`;
}

/**
 * Check if image already exists in Cloudinary
 */
async function imageExists(publicId: string): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a single image to Cloudinary
 */
async function uploadImage(filePath: string): Promise<boolean> {
  const publicId = getPublicId(filePath);
  const localPath = getLocalPath(filePath);
  const fileSize = fs.statSync(filePath).size;
  const format = path.extname(filePath).slice(1).toLowerCase();

  if (VERBOSE) {
    console.log(`  Processing: ${localPath}`);
  }

  // Check if already exists (unless force flag)
  if (!FORCE) {
    const exists = await imageExists(publicId);
    if (exists) {
      if (VERBOSE) {
        console.log(`    ⏭️  Skipped (already exists): ${publicId}`);
      }
      stats.skipped++;
      // Still add to mapping
      imageMapping.push({
        localPath,
        publicId: publicId.replace(`${CONFIG.folder}/`, ''),
        cloudinaryUrl: `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${publicId}`,
        format,
        size: fileSize,
      });
      return true;
    }
  }

  if (DRY_RUN) {
    console.log(`  📝 Would upload: ${localPath} → ${publicId}`);
    stats.uploaded++;
    imageMapping.push({
      localPath,
      publicId: publicId.replace(`${CONFIG.folder}/`, ''),
      cloudinaryUrl: `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${publicId}`,
      format,
      size: fileSize,
    });
    return true;
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      overwrite: FORCE,
      resource_type: 'image',
      // Preserve original format for SVGs, optimize others
      format: format === 'svg' ? 'svg' : undefined,
    });

    if (VERBOSE) {
      console.log(`    ✅ Uploaded: ${result.secure_url}`);
    }

    stats.uploaded++;
    imageMapping.push({
      localPath,
      publicId: publicId.replace(`${CONFIG.folder}/`, ''),
      cloudinaryUrl: result.secure_url,
      format,
      size: fileSize,
    });

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, CONFIG.uploadDelay));

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`    ❌ Failed: ${localPath} - ${errorMessage}`);
    stats.failed++;
    stats.errors.push({ file: localPath, error: errorMessage });
    return false;
  }
}

/**
 * Save image mapping to JSON file
 */
function saveMapping(): void {
  const output = {
    generatedAt: new Date().toISOString(),
    cloudName: CONFIG.cloudName,
    folder: CONFIG.folder,
    totalImages: imageMapping.length,
    images: imageMapping.sort((a, b) => a.localPath.localeCompare(b.localPath)),
  };

  // Ensure directory exists
  const dir = path.dirname(CONFIG.outputMappingFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.outputMappingFile, JSON.stringify(output, null, 2));
  console.log(`\n📄 Image mapping saved to: ${CONFIG.outputMappingFile}`);
}

/**
 * Print migration summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(50));
  console.log('Migration Summary');
  console.log('='.repeat(50));
  console.log(`Total images found:  ${stats.total}`);
  console.log(`Successfully uploaded: ${stats.uploaded}`);
  console.log(`Skipped (existing):    ${stats.skipped}`);
  console.log(`Failed:                ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n📝 This was a DRY RUN - no files were actually uploaded.');
    console.log('   Run without --dry-run to perform actual migration.');
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('\n🚀 Cloudinary Image Migration');
  console.log('='.repeat(50));

  if (DRY_RUN) {
    console.log('📝 DRY RUN MODE - No files will be uploaded');
  }
  if (FORCE) {
    console.log('⚠️  FORCE MODE - Existing images will be overwritten');
  }

  // Configure Cloudinary
  configureCloudinary();

  // Find all images
  console.log(`\n📁 Scanning: ${CONFIG.publicImagesDir}`);
  const imageFiles = findImageFiles(CONFIG.publicImagesDir);
  stats.total = imageFiles.length;

  if (stats.total === 0) {
    console.log('No images found to migrate.');
    return;
  }

  console.log(`Found ${stats.total} images to process\n`);

  // Process each image
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    if (!file) continue;

    const progress = `[${i + 1}/${stats.total}]`;

    if (!VERBOSE) {
      process.stdout.write(`\r${progress} Processing...`);
    } else {
      console.log(`${progress}`);
    }

    await uploadImage(file);
  }

  if (!VERBOSE) {
    process.stdout.write('\r');
  }

  // Save mapping file
  if (!DRY_RUN || imageMapping.length > 0) {
    saveMapping();
  }

  // Print summary
  printSummary();
}

// Run migration
main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
