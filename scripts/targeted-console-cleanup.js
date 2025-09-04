#!/usr/bin/env node

/**
 * Targeted Console Log Cleanup Tool
 * Phase 6: Implementation Tools - Focused Approach
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logSection = (title) => {
  console.log('\n' + '='.repeat(80));
  log(`🔧 ${title}`, 'cyan');
  console.log('='.repeat(80));
};

// High-priority files to clean
const highPriorityFiles = [
  'src/app/api/admin/job-applications/[id]/status/route.ts',
  'src/app/api/admin/job-applications/[id]/route.ts',
  'src/app/api/admin/job-applications/route.ts',
  'src/app/api/admin/job-applications/stats/route.ts',
  'src/app/api/admin/make-super-admin/route.ts',
  'src/app/api/auth/current-user/route.ts',
  'src/app/api/auth/redirect/route.ts',
  'src/app/api/auth/session/route.ts',
  'src/app/api/auth/signup/route.ts',
  'src/app/api/auth/user-role/route.ts',
];

// Console log patterns and their replacements
const logPatterns = [
  {
    pattern: /console\.log\(/g,
    replacement: 'loggers.app.debug(',
    type: 'log',
    description: 'console.log',
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'loggers.app.info(',
    type: 'info',
    description: 'console.info',
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'loggers.app.warn(',
    type: 'warn',
    description: 'console.warn',
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'loggers.app.debug(',
    type: 'debug',
    description: 'console.debug',
  },
  // Keep console.error as is - these are critical
];

// Files to preserve (don't clean)
const preserveFiles = [
  'useRealTimeTracking.ts', // Preserved for testing
  '.test.ts',
  '.spec.ts',
  '__tests__',
  'test-',
];

/**
 * Check if file should be preserved
 */
function shouldPreserveFile(filePath) {
  return preserveFiles.some(preserve => filePath.includes(preserve));
}

/**
 * Check if file needs logger import
 */
function needsLoggerImport(content) {
  return content.includes('loggers.') && !content.includes("import { loggers }");
}

/**
 * Add logger import to file
 */
function addLoggerImport(content, filePath) {
  // Determine the correct import path based on file location
  let importPath = '@/utils/logger';
  
  // Add the import at the top
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Look for existing imports
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      break;
    }
  }
  
  // Add the import
  const importStatement = `import { loggers } from '${importPath}';`;
  lines.splice(insertIndex, 0, importStatement);
  
  return lines.join('\n');
}

/**
 * Clean console logs in a single file
 */
function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }
  
  if (shouldPreserveFile(filePath)) {
    return { success: true, skipped: true, reason: 'File preserved' };
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let changes = 0;
  const changesByType = {};
  
  // Apply log pattern replacements
  logPatterns.forEach(({ pattern, replacement, type, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      const count = matches.length;
      content = content.replace(pattern, replacement);
      changes += count;
      changesByType[type] = (changesByType[type] || 0) + count;
    }
  });
  
  // Add logger import if needed
  if (changes > 0 && needsLoggerImport(content)) {
    content = addLoggerImport(content, filePath);
  }
  
  // Write file if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return {
      success: true,
      changes,
      changesByType,
      addedImport: needsLoggerImport(content)
    };
  }
  
  return { success: true, changes: 0 };
}

/**
 * Clean specific files
 */
function cleanSpecificFiles() {
  logSection('TARGETED CONSOLE LOG CLEANUP');
  
  let totalChanges = 0;
  let successCount = 0;
  let skipCount = 0;
  
  highPriorityFiles.forEach(filePath => {
    log(`Processing: ${filePath}`, 'blue');
    const result = cleanFile(filePath);
    
    if (result.success) {
      if (result.skipped) {
        log(`⏭️  ${filePath} - ${result.reason}`, 'yellow');
        skipCount++;
      } else if (result.changes > 0) {
        log(`✅ ${filePath} - ${result.changes} changes`, 'green');
        if (result.addedImport) {
          log(`   📦 Added logger import`, 'blue');
        }
        successCount++;
        totalChanges += result.changes;
      } else {
        log(`ℹ️  ${filePath} - No changes needed`, 'blue');
      }
    } else {
      log(`❌ ${filePath} - ${result.error}`, 'red');
    }
  });
  
  log(`\n📊 CLEANUP SUMMARY:`, 'cyan');
  log(`  Files processed: ${highPriorityFiles.length}`, 'blue');
  log(`  Successfully cleaned: ${successCount}`, 'green');
  log(`  Skipped: ${skipCount}`, 'yellow');
  log(`  Total changes: ${totalChanges}`, 'green');
  
  return { successCount, skipCount, totalChanges };
}

/**
 * Find and clean files with console logs
 */
function findAndCleanFiles() {
  logSection('FINDING FILES WITH CONSOLE LOGS');
  
  const srcDir = 'src';
  const files = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.match(/\.(ts|tsx|js|jsx)$/)) {
        files.push(fullPath);
      }
    });
  }
  
  scanDirectory(srcDir);
  
  // Find files with console logs
  const filesWithLogs = files.filter(filePath => {
    if (shouldPreserveFile(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf8');
    return /console\.(log|warn|info|debug)\(/.test(content);
  });
  
  log(`Found ${filesWithLogs.length} files with console logs`, 'blue');
  
  // Clean first 10 files
  const filesToClean = filesWithLogs.slice(0, 10);
  let totalChanges = 0;
  let successCount = 0;
  let skipCount = 0;
  
  filesToClean.forEach(filePath => {
    log(`Processing: ${filePath}`, 'blue');
    const result = cleanFile(filePath);
    
    if (result.success) {
      if (result.skipped) {
        log(`⏭️  ${filePath} - ${result.reason}`, 'yellow');
        skipCount++;
      } else if (result.changes > 0) {
        log(`✅ ${filePath} - ${result.changes} changes`, 'green');
        if (result.addedImport) {
          log(`   📦 Added logger import`, 'blue');
        }
        successCount++;
        totalChanges += result.changes;
      } else {
        log(`ℹ️  ${filePath} - No changes needed`, 'blue');
      }
    } else {
      log(`❌ ${filePath} - ${result.error}`, 'red');
    }
  });
  
  log(`\n📊 CLEANUP SUMMARY:`, 'cyan');
  log(`  Files processed: ${filesToClean.length}`, 'blue');
  log(`  Successfully cleaned: ${successCount}`, 'green');
  log(`  Skipped: ${skipCount}`, 'yellow');
  log(`  Total changes: ${totalChanges}`, 'green');
  
  return { successCount, skipCount, totalChanges };
}

/**
 * Main cleanup function
 */
function runTargetedCleanup() {
  log('🚀 Starting Targeted Console Log Cleanup', 'bright');
  log('Phase 6: Implementation Tools - Focused Approach', 'cyan');
  
  // Clean specific high-priority files
  const specificResult = cleanSpecificFiles();
  
  // Find and clean additional files
  const findResult = findAndCleanFiles();
  
  // Final summary
  logSection('CLEANUP COMPLETE');
  const totalSuccess = specificResult.successCount + findResult.successCount;
  const totalSkipped = specificResult.skipCount + findResult.skipCount;
  const totalChanges = specificResult.totalChanges + findResult.totalChanges;
  
  log(`Total files processed: ${totalSuccess + totalSkipped}`, 'blue');
  log(`Successfully cleaned: ${totalSuccess}`, 'green');
  log(`Skipped: ${totalSkipped}`, 'yellow');
  log(`Total changes made: ${totalChanges}`, 'green');
  
  if (totalChanges > 0) {
    log('\n🎉 Console log cleanup completed successfully!', 'green');
    log('Next steps:', 'yellow');
    log('1. Run tests to ensure functionality is preserved', 'blue');
    log('2. Check for any linting errors', 'blue');
    log('3. Verify development experience is maintained', 'blue');
  } else {
    log('\nℹ️  No changes were made. All files may already be clean.', 'blue');
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  runTargetedCleanup();
}

module.exports = {
  cleanFile,
  cleanSpecificFiles,
  findAndCleanFiles,
  runTargetedCleanup,
};
