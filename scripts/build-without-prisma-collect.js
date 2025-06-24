#!/usr/bin/env node

/**
 * Custom build script to handle Prisma initialization issues during Next.js build
 * This script builds the app while handling the problematic page data collection
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting custom build process...');

// First, ensure Prisma client is generated
console.log('📦 Setting up Prisma client...');
try {
  execSync('node scripts/prisma-setup.js', { stdio: 'inherit' });
  console.log('✅ Prisma client setup completed');
} catch (error) {
  console.error('❌ Prisma setup failed:', error.message);
  process.exit(1);
}

// Set environment variables to handle problematic build scenarios
process.env.SKIP_TYPECHECK = 'true';
process.env.NEXT_TELEMETRY_DISABLED = '1';

// Function to run Next.js build with proper error handling
function runBuild() {
  return new Promise((resolve, reject) => {
    console.log('🔨 Starting Next.js build...');
    
    const buildProcess = spawn('pnpm', ['next', 'build'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SKIP_TYPECHECK: 'true',
        // Ensure Prisma uses mock client during build if needed
        PRISMA_MOCK_BUILD: 'true'
      }
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Build completed successfully');
        resolve();
      } else {
        console.error(`❌ Build failed with code ${code}`);
        reject(new Error(`Build process exited with code ${code}`));
      }
    });
    
    buildProcess.on('error', (error) => {
      console.error('❌ Build process error:', error);
      reject(error);
    });
  });
}

// Run the build process
runBuild()
  .then(() => {
    console.log('🎉 Custom build completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Build failed:', error.message);
    process.exit(1);
  }); 