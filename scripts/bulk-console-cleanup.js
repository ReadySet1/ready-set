#!/usr/bin/env node

/**
 * Bulk Console Log Cleanup Tool
 * Phase 6: Implementation Tools
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

// Console log patterns and their replacements
const logPatterns = [
  {
    pattern: /console\.log\(/g,
    replacement: 'loggers.app.debug(',
    type: 'log',
    description: 'console.log',
    priority: 'high'
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'loggers.app.info(',
    type: 'info',
    description: 'console.info',
    priority: 'medium'
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'loggers.app.warn(',
    type: 'warn',
    description: 'console.warn',
    priority: 'high'
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'loggers.app.debug(',
    type: 'debug',
    description: 'console.debug',
    priority: 'low'
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

// Files that need logger import
const filesNeedingLoggerImport = new Set();

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
  
  // Adjust import path based on file location
  if (filePath.includes('src/app/')) {
    importPath = '@/utils/logger';
  } else if (filePath.includes('src/components/')) {
    importPath = '@/utils/logger';
  } else if (filePath.includes('src/hooks/')) {
    importPath = '@/utils/logger';
  } else if (filePath.includes('src/lib/')) {
    importPath = '@/utils/logger';
  }
  
  // Find the best place to add the import
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
    filesNeedingLoggerImport.add(filePath);
  }
  
  // Write file if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return {
      success: true,
      changes,
      changesByType,
      addedImport: filesNeedingLoggerImport.has(filePath)
    };
  }
  
  return { success: true, changes: 0 };
}

/**
 * Clean files by priority
 */
function cleanFilesByPriority(priority, fileList, maxFiles = 10) {
  logSection(`CLEANING ${priority.toUpperCase()} PRIORITY FILES`);
  
  const filesToClean = fileList.slice(0, maxFiles);
  let totalChanges = 0;
  let successCount = 0;
  let skipCount = 0;
  
  filesToClean.forEach(file => {
    const result = cleanFile(file.path);
    
    if (result.success) {
      if (result.skipped) {
        log(`⏭️  ${file.path} - ${result.reason}`, 'yellow');
        skipCount++;
      } else if (result.changes > 0) {
        log(`✅ ${file.path} - ${result.changes} changes`, 'green');
        if (result.addedImport) {
          log(`   📦 Added logger import`, 'blue');
        }
        successCount++;
        totalChanges += result.changes;
      } else {
        log(`ℹ️  ${file.path} - No changes needed`, 'blue');
      }
    } else {
      log(`❌ ${file.path} - ${result.error}`, 'red');
    }
  });
  
  log(`\n📊 ${priority.toUpperCase()} PRIORITY SUMMARY:`, 'cyan');
  log(`  Files processed: ${filesToClean.length}`, 'blue');
  log(`  Successfully cleaned: ${successCount}`, 'green');
  log(`  Skipped: ${skipCount}`, 'yellow');
  log(`  Total changes: ${totalChanges}`, 'green');
  
  return { successCount, skipCount, totalChanges };
}

/**
 * Load analysis report
 */
function loadAnalysisReport() {
  const reportPath = 'console-log-analysis-report.json';
  if (!fs.existsSync(reportPath)) {
    log(`❌ Analysis report not found: ${reportPath}`, 'red');
    log('Please run: node scripts/analyze-console-logs.js', 'yellow');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

/**
 * Main cleanup function
 */
function runBulkCleanup() {
  log('🚀 Starting Bulk Console Log Cleanup', 'bright');
  log('Phase 6: Implementation Tools', 'cyan');
  
  // Load analysis report
  const report = loadAnalysisReport();
  const recommendations = report.recommendations;
  
  logSection('CLEANUP PLAN');
  log(`Files to clean: ${recommendations.immediate.length + recommendations.next.length + recommendations.later.length}`, 'blue');
  log(`Immediate priority: ${recommendations.immediate.length} files`, 'red');
  log(`Next priority: ${recommendations.next.length} files`, 'yellow');
  log(`Later priority: ${recommendations.later.length} files`, 'blue');
  
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalChanges = 0;
  
  // Clean immediate priority files
  if (recommendations.immediate.length > 0) {
    const result = cleanFilesByPriority('immediate', recommendations.immediate, 5);
    totalSuccess += result.successCount;
    totalSkipped += result.skipCount;
    totalChanges += result.totalChanges;
  }
  
  // Clean next priority files
  if (recommendations.next.length > 0) {
    const result = cleanFilesByPriority('next', recommendations.next, 10);
    totalSuccess += result.successCount;
    totalSkipped += result.skipCount;
    totalChanges += result.totalChanges;
  }
  
  // Clean later priority files (sample)
  if (recommendations.later.length > 0) {
    const result = cleanFilesByPriority('later', recommendations.later, 5);
    totalSuccess += result.successCount;
    totalSkipped += result.skipCount;
    totalChanges += result.totalChanges;
  }
  
  // Final summary
  logSection('CLEANUP COMPLETE');
  log(`Total files processed: ${totalSuccess + totalSkipped}`, 'blue');
  log(`Successfully cleaned: ${totalSuccess}`, 'green');
  log(`Skipped: ${totalSkipped}`, 'yellow');
  log(`Total changes made: ${totalChanges}`, 'green');
  log(`Files needing logger import: ${filesNeedingLoggerImport.size}`, 'blue');
  
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
  runBulkCleanup();
}

module.exports = {
  cleanFile,
  cleanFilesByPriority,
  runBulkCleanup,
};
