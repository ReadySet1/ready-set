#!/usr/bin/env node

const { execSync } = require('child_process');

// Perform thorough TypeScript check
try {
  console.log('🔍 Executing comprehensive TypeScript check...');

  // Use --noEmit to only check types without generating output files
  execSync('tsc --noEmit', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=8192',
    },
  });

  console.log('✅ TypeScript check passed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ TypeScript check failed.');
  process.exit(1);
}
