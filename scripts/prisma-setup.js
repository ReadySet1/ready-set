#!/usr/bin/env node

/**
 * This script ensures that Prisma client is generated before build
 * and handles any initialization issues that might occur in Vercel with pnpm
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

try {
  log('Starting Prisma client setup...');
  
  // Check if Prisma schema exists
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Prisma schema not found at: ' + schemaPath);
  }
  
  log('Found Prisma schema, generating client...');
  
  // Clear any existing Prisma client to avoid conflicts
  const prismaClientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
  if (fs.existsSync(prismaClientPath)) {
    log('Removing existing Prisma client...');
    fs.rmSync(prismaClientPath, { recursive: true, force: true });
  }
  
  // Use pnpm as the preferred package manager
  try {
    log('Using pnpm to generate Prisma client...');
    execSync('pnpm prisma generate', { stdio: 'inherit' });
  } catch (error) {
    log('pnpm prisma failed, trying npx...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (npxError) {
      log('npx prisma generate failed, trying npm...');
      try {
        execSync('npm run db:generate', { stdio: 'inherit' });
      } catch (npmError) {
        log('All Prisma generation attempts failed');
        throw error;
      }
    }
  }
  
  // Verify that Prisma client was generated
  if (!fs.existsSync(prismaClientPath)) {
    throw new Error('Prisma client not generated at: ' + prismaClientPath);
  }
  
  log('Prisma client generated successfully!');
  
  // Create a verification file to ensure Prisma client is initialized
  const verificationPath = path.join(process.cwd(), '.prisma-initialized');
  fs.writeFileSync(verificationPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    prismaClientPath: prismaClientPath,
    version: require('../package.json').version,
    packageManager: 'pnpm'
  }, null, 2));
  
  // For pnpm, ensure the client is properly linked (skip if already running from postinstall)
  const pnpmLockPath = path.join(process.cwd(), 'pnpm-lock.yaml');
  if (fs.existsSync(pnpmLockPath) && !process.env.npm_lifecycle_event) {
    log('Detected pnpm, ensuring proper client linking...');
    try {
      execSync('pnpm install --frozen-lockfile --ignore-scripts', { stdio: 'inherit' });
    } catch (error) {
      log('pnpm install failed, but continuing...');
    }
  }
  
  // Validate that the unified Prisma client can be imported
  try {
    const prismaUtilsPath = path.join(process.cwd(), 'src', 'utils', 'prismaDB.ts');
    if (fs.existsSync(prismaUtilsPath)) {
      log('Unified Prisma client file found at expected location');
    } else {
      log('Warning: Unified Prisma client file not found - build may fail');
    }
  } catch (validationError) {
    log('Warning: Could not validate unified Prisma client:', validationError.message);
  }
  
  log('Prisma setup complete!');
  process.exit(0);
} catch (error) {
  log(`Error during Prisma setup: ${error.message}`);
  process.exit(1);
} 