#!/usr/bin/env node

/**
 * Console Log Analysis Tool
 * Phase 5: File Priority Order Analysis
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
  log(`🔍 ${title}`, 'cyan');
  console.log('='.repeat(80));
};

// Console log patterns to analyze
const logPatterns = [
  { pattern: /console\.log\(/g, type: 'log', description: 'console.log', priority: 'high' },
  { pattern: /console\.error\(/g, type: 'error', description: 'console.error', priority: 'critical' },
  { pattern: /console\.warn\(/g, type: 'warn', description: 'console.warn', priority: 'high' },
  { pattern: /console\.info\(/g, type: 'info', description: 'console.info', priority: 'medium' },
  { pattern: /console\.debug\(/g, type: 'debug', description: 'console.debug', priority: 'low' },
];

// File priority categories
const filePriorities = {
  high: [
    'src/utils/prismaDB.ts',
    'src/contexts/UserContext.tsx',
    'src/components/Header/index.tsx',
    'src/lib/db/prisma-pooled.ts',
  ],
  medium: [
    'src/app/api/',
    'src/hooks/',
    'src/components/',
    'src/lib/',
  ],
  low: [
    'src/__tests__/',
    'src/utils/',
    'src/components/ui/',
  ]
};

// Analysis results
const analysis = {
  totalFiles: 0,
  totalLogs: 0,
  byPriority: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
  byFilePriority: {
    high: [],
    medium: [],
    low: [],
  },
  byType: {
    log: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
  },
  files: {},
};

/**
 * Analyze a single file for console logs
 */
function analyzeFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileAnalysis = {
    path: filePath,
    totalLogs: 0,
    logs: [],
    byType: {},
    priority: 'low',
    shouldClean: true,
  };

  // Count logs by type
  logPatterns.forEach(({ pattern, type, description, priority }) => {
    const matches = content.match(pattern);
    if (matches) {
      const count = matches.length;
      fileAnalysis.totalLogs += count;
      fileAnalysis.byType[type] = count;
      analysis.byType[type] += count;
      analysis.byPriority[priority] += count;

      // Add individual log entries
      matches.forEach((match, index) => {
        fileAnalysis.logs.push({
          type,
          description,
          priority,
          match,
          line: findLineNumber(content, match, index),
        });
      });
    }
  });

  // Determine file priority
  if (filePriorities.high.some(priorityPath => filePath.includes(priorityPath))) {
    fileAnalysis.priority = 'high';
  } else if (filePriorities.medium.some(priorityPath => filePath.includes(priorityPath))) {
    fileAnalysis.priority = 'medium';
  }

  // Determine if file should be cleaned
  fileAnalysis.shouldClean = fileAnalysis.totalLogs > 0 && 
    !filePath.includes('useRealTimeTracking.ts') && // Preserved for testing
    !filePath.includes('__tests__/') && // Test files
    !filePath.includes('test-') && // Test files
    !filePath.includes('.test.') && // Test files
    !filePath.includes('.spec.') && // Test files
    fileAnalysis.byType.error < 3; // Keep files with many errors

  return fileAnalysis;
}

/**
 * Find line number for a match
 */
function findLineNumber(content, match, index) {
  const lines = content.split('\n');
  let currentIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    const matchIndex = lineContent.indexOf(match);
    
    if (matchIndex !== -1) {
      if (currentIndex === index) {
        return i + 1;
      }
      currentIndex++;
    }
  }
  
  return 0;
}

/**
 * Categorize files by priority
 */
function categorizeFiles(files) {
  Object.keys(files).forEach(filePath => {
    const file = files[filePath];
    if (file && file.shouldClean) {
      analysis.byFilePriority[file.priority].push({
        path: filePath,
        totalLogs: file.totalLogs,
        byType: file.byType,
        priority: file.priority,
      });
    }
  });
}

/**
 * Generate cleanup recommendations
 */
function generateRecommendations() {
  const recommendations = {
    immediate: [],
    next: [],
    later: [],
    preserve: [],
  };

  // High priority files
  analysis.byFilePriority.high.forEach(file => {
    if (file.totalLogs > 5) {
      recommendations.immediate.push({
        file: file.path,
        reason: 'High priority file with many logs',
        logs: file.totalLogs,
        types: file.byType,
      });
    } else {
      recommendations.next.push({
        file: file.path,
        reason: 'High priority file with moderate logs',
        logs: file.totalLogs,
        types: file.byType,
      });
    }
  });

  // Medium priority files
  analysis.byFilePriority.medium.forEach(file => {
    if (file.totalLogs > 10) {
      recommendations.next.push({
        file: file.path,
        reason: 'Medium priority file with many logs',
        logs: file.totalLogs,
        types: file.byType,
      });
    } else {
      recommendations.later.push({
        file: file.path,
        reason: 'Medium priority file with moderate logs',
        logs: file.totalLogs,
        types: file.byType,
      });
    }
  });

  // Low priority files
  analysis.byFilePriority.low.forEach(file => {
    recommendations.later.push({
      file: file.path,
      reason: 'Low priority file',
      logs: file.totalLogs,
      types: file.byType,
    });
  });

  return recommendations;
}

/**
 * Main analysis function
 */
function analyzeConsoleLogs() {
  logSection('CONSOLE LOG ANALYSIS');
  
  // Get all TypeScript/JavaScript files
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
  analysis.totalFiles = files.length;
  
  log(`Found ${files.length} TypeScript/JavaScript files`, 'blue');
  
  // Analyze each file
  files.forEach(filePath => {
    const fileAnalysis = analyzeFile(filePath);
    if (fileAnalysis && fileAnalysis.totalLogs > 0) {
      analysis.files[filePath] = fileAnalysis;
      analysis.totalLogs += fileAnalysis.totalLogs;
    }
  });
  
  // Categorize files
  categorizeFiles(analysis.files);
  
  // Display results
  displayResults();
  
  // Generate recommendations
  const recommendations = generateRecommendations();
  displayRecommendations(recommendations);
  
  // Save detailed report
  saveReport(recommendations);
}

/**
 * Display analysis results
 */
function displayResults() {
  logSection('ANALYSIS RESULTS');
  
  log(`Total Files Analyzed: ${analysis.totalFiles}`, 'blue');
  log(`Files with Console Logs: ${Object.keys(analysis.files).length}`, 'blue');
  log(`Total Console Logs: ${analysis.totalLogs}`, 'blue');
  
  log('\n📊 Logs by Type:', 'yellow');
  Object.entries(analysis.byType).forEach(([type, count]) => {
    const color = type === 'error' ? 'red' : type === 'warn' ? 'yellow' : 'blue';
    log(`  ${type}: ${count}`, color);
  });
  
  log('\n📊 Logs by Priority:', 'yellow');
  Object.entries(analysis.byPriority).forEach(([priority, count]) => {
    const color = priority === 'critical' ? 'red' : priority === 'high' ? 'yellow' : 'blue';
    log(`  ${priority}: ${count}`, color);
  });
  
  log('\n📊 Files by Priority:', 'yellow');
  Object.entries(analysis.byFilePriority).forEach(([priority, files]) => {
    const color = priority === 'high' ? 'red' : priority === 'medium' ? 'yellow' : 'blue';
    log(`  ${priority}: ${files.length} files`, color);
  });
}

/**
 * Display cleanup recommendations
 */
function displayRecommendations(recommendations) {
  logSection('CLEANUP RECOMMENDATIONS');
  
  log('🚨 IMMEDIATE CLEANUP (High Impact):', 'red');
  recommendations.immediate.forEach(rec => {
    log(`  📁 ${rec.file}`, 'red');
    log(`     Reason: ${rec.reason}`, 'yellow');
    log(`     Logs: ${rec.logs} (${JSON.stringify(rec.types)})`, 'blue');
  });
  
  log('\n⚠️  NEXT CLEANUP (Medium Impact):', 'yellow');
  recommendations.next.forEach(rec => {
    log(`  📁 ${rec.file}`, 'yellow');
    log(`     Reason: ${rec.reason}`, 'yellow');
    log(`     Logs: ${rec.logs} (${JSON.stringify(rec.types)})`, 'blue');
  });
  
  log('\n📋 LATER CLEANUP (Low Impact):', 'blue');
  recommendations.later.slice(0, 10).forEach(rec => {
    log(`  📁 ${rec.file}`, 'blue');
    log(`     Reason: ${rec.reason}`, 'yellow');
    log(`     Logs: ${rec.logs} (${JSON.stringify(rec.types)})`, 'blue');
  });
  
  if (recommendations.later.length > 10) {
    log(`  ... and ${recommendations.later.length - 10} more files`, 'blue');
  }
}

/**
 * Save detailed report
 */
function saveReport(recommendations) {
  const report = {
    timestamp: new Date().toISOString(),
    analysis,
    recommendations,
    summary: {
      totalFiles: analysis.totalFiles,
      filesWithLogs: Object.keys(analysis.files).length,
      totalLogs: analysis.totalLogs,
      immediateCleanup: recommendations.immediate.length,
      nextCleanup: recommendations.next.length,
      laterCleanup: recommendations.later.length,
    }
  };
  
  const reportPath = 'reports/console-cleanup/console-log-analysis-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`\n📄 Detailed report saved to: ${reportPath}`, 'green');
}

// Run analysis if this script is executed directly
if (require.main === module) {
  analyzeConsoleLogs();
}

module.exports = {
  analyzeConsoleLogs,
  analyzeFile,
  categorizeFiles,
  generateRecommendations,
};
