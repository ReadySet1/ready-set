#!/usr/bin/env node

/**
 * Custom build script to handle Prisma initialization issues during Next.js build
 * This script builds the app while handling the problematic page data collection
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting custom build process...');

// First, ensure Prisma client is generated
console.log('📦 Setting up Prisma client...');
const prismaSetup = spawn('node', ['scripts/prisma-setup.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

prismaSetup.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Prisma setup failed');
    process.exit(1);
  }

  console.log('✅ Prisma setup complete');
  
  // Run TypeScript check
  console.log('🔍 Running TypeScript check...');
  const typeCheck = spawn('node', ['scripts/type-check.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  typeCheck.on('close', (typeCheckCode) => {
    if (typeCheckCode !== 0) {
      console.error('❌ TypeScript check failed');
      process.exit(1);
    }

    console.log('✅ TypeScript check passed');

    // Build with modified environment to skip problematic data collection
    console.log('🔨 Building application...');
    const env = {
      ...process.env,
      SKIP_TYPECHECK: 'true',
      NEXT_SKIP_PRECOMPILE: 'true',
      // Disable page data collection that causes Prisma issues
      __NEXT_PRIVATE_SKIP_CACHE: 'true'
    };

    const nextBuild = spawn('npx', ['next', 'build'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env
    });

    nextBuild.on('close', (buildCode) => {
      if (buildCode === 0) {
        console.log('🎉 Build completed successfully!');
      } else {
        console.error('❌ Build failed with code:', buildCode);
        process.exit(buildCode);
      }
    });

    nextBuild.on('error', (error) => {
      console.error('❌ Build process error:', error);
      process.exit(1);
    });
  });

  typeCheck.on('error', (error) => {
    console.error('❌ TypeScript check error:', error);
    process.exit(1);
  });
});

prismaSetup.on('error', (error) => {
  console.error('❌ Prisma setup error:', error);
  process.exit(1);
}); 