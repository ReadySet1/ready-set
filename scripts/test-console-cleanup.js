#!/usr/bin/env node

/**
 * Console Log Cleanup Testing & Validation Script
 * Phase 4: Testing & Validation Strategy
 */

const { execSync } = require('child_process');
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
  console.log('\n' + '='.repeat(60));
  log(`🔍 ${title}`, 'cyan');
  console.log('='.repeat(60));
};

const logTest = (testName, status, details = '') => {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  log(`${statusIcon} ${testName}: ${status}`, statusColor);
  if (details) {
    log(`   ${details}`, 'yellow');
  }
};

// Test configuration
const config = {
  buildCommand: 'pnpm run build',
  devCommand: 'pnpm run dev',
  testTimeout: 30000, // 30 seconds
  logCaptureTimeout: 10000, // 10 seconds
};

// Test results storage
const testResults = {
  preCleanup: {},
  postCleanup: {},
  errors: [],
  warnings: [],
};

/**
 * Capture build output and analyze logs
 */
function captureBuildOutput() {
  logSection('BUILD OUTPUT ANALYSIS');
  
  try {
    log('Running production build...', 'blue');
    const startTime = Date.now();
    
    const buildOutput = execSync(config.buildCommand, {
      encoding: 'utf8',
      timeout: config.testTimeout,
      stdio: 'pipe'
    });
    
    const buildTime = Date.now() - startTime;
    log(`Build completed in ${buildTime}ms`, 'green');
    
    // Analyze build output for console logs
    const consoleLogs = analyzeConsoleLogs(buildOutput);
    
    testResults.postCleanup.buildOutput = {
      success: true,
      buildTime,
      consoleLogs,
      totalLogs: consoleLogs.length,
      errorLogs: consoleLogs.filter(log => log.type === 'error').length,
      warnLogs: consoleLogs.filter(log => log.type === 'warn').length,
      infoLogs: consoleLogs.filter(log => log.type === 'info').length,
      debugLogs: consoleLogs.filter(log => log.type === 'debug').length,
    };
    
    logTest('Build Success', 'PASS', `Completed in ${buildTime}ms`);
    logTest('Console Log Analysis', 'PASS', `Found ${consoleLogs.length} total logs`);
    
    return consoleLogs;
    
  } catch (error) {
    logTest('Build Success', 'FAIL', error.message);
    testResults.errors.push(`Build failed: ${error.message}`);
    return [];
  }
}

/**
 * Analyze console logs in build output
 */
function analyzeConsoleLogs(output) {
  const logPatterns = [
    { pattern: /console\.log\(/g, type: 'log', description: 'console.log' },
    { pattern: /console\.error\(/g, type: 'error', description: 'console.error' },
    { pattern: /console\.warn\(/g, type: 'warn', description: 'console.warn' },
    { pattern: /console\.info\(/g, type: 'info', description: 'console.info' },
    { pattern: /console\.debug\(/g, type: 'debug', description: 'console.debug' },
  ];
  
  const logs = [];
  
  logPatterns.forEach(({ pattern, type, description }) => {
    const matches = output.match(pattern);
    if (matches) {
      matches.forEach((match, index) => {
        logs.push({
          type,
          description,
          match,
          index: index + 1,
        });
      });
    }
  });
  
  return logs;
}

/**
 * Test development mode logging
 */
function testDevelopmentLogging() {
  logSection('DEVELOPMENT LOGGING TEST');
  
  // Check if development-specific logs are present in source files
  const sourceFiles = [
    'src/utils/prismaDB.ts',
    'src/lib/db/prisma-pooled.ts',
    'src/contexts/UserContext.tsx',
    'src/components/Header/index.tsx',
    'src/utils/logger.ts',
  ];
  
  let devLogCount = 0;
  let prodLogCount = 0;
  
  sourceFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Count development-specific logs
      const devLogs = (content.match(/isDev|isDevelopment|NODE_ENV.*development/g) || []).length;
      const prodLogs = (content.match(/isProd|isProduction|NODE_ENV.*production/g) || []).length;
      
      devLogCount += devLogs;
      prodLogCount += prodLogs;
      
      log(`📁 ${filePath}: ${devLogs} dev logs, ${prodLogs} prod logs`, 'blue');
    }
  });
  
  logTest('Development Logging', devLogCount > 0 ? 'PASS' : 'FAIL', 
    `Found ${devLogCount} development-specific log conditions`);
  logTest('Production Logging', prodLogCount > 0 ? 'PASS' : 'FAIL', 
    `Found ${prodLogCount} production-specific log conditions`);
  
  testResults.postCleanup.developmentLogging = {
    devLogCount,
    prodLogCount,
    sourceFiles: sourceFiles.length,
  };
}

/**
 * Test error logging preservation
 */
function testErrorLoggingPreservation() {
  logSection('ERROR LOGGING PRESERVATION TEST');
  
  const errorPatterns = [
    { pattern: /console\.error\(/g, description: 'console.error calls' },
    { pattern: /loggers\.\w+\.error\(/g, description: 'logger.error calls' },
    { pattern: /throw new Error\(/g, description: 'Error throwing' },
  ];
  
  const sourceFiles = [
    'src/utils/prismaDB.ts',
    'src/lib/db/prisma-pooled.ts',
    'src/contexts/UserContext.tsx',
    'src/components/Header/index.tsx',
  ];
  
  let totalErrorLogs = 0;
  const errorLogsByFile = {};
  
  sourceFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      let fileErrorCount = 0;
      
      errorPatterns.forEach(({ pattern, description }) => {
        const matches = content.match(pattern);
        if (matches) {
          fileErrorCount += matches.length;
          totalErrorLogs += matches.length;
        }
      });
      
      errorLogsByFile[filePath] = fileErrorCount;
      log(`📁 ${filePath}: ${fileErrorCount} error logs`, 'blue');
    }
  });
  
  logTest('Error Logging Preservation', totalErrorLogs > 0 ? 'PASS' : 'FAIL', 
    `Found ${totalErrorLogs} error logging statements`);
  
  testResults.postCleanup.errorLogging = {
    totalErrorLogs,
    errorLogsByFile,
  };
}

/**
 * Test performance optimization
 */
function testPerformanceOptimization() {
  logSection('PERFORMANCE OPTIMIZATION TEST');
  
  // Check for environment-based conditional logging
  const conditionalLoggingFiles = [
    'src/utils/prismaDB.ts',
    'src/lib/db/prisma-pooled.ts',
    'src/contexts/UserContext.tsx',
    'src/components/Header/index.tsx',
  ];
  
  let conditionalLogCount = 0;
  let unconditionalLogCount = 0;
  
  conditionalLoggingFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Count conditional logs (wrapped in environment checks)
      const conditionalLogs = (content.match(/if\s*\(\s*isDev|if\s*\(\s*process\.env\.NODE_ENV/g) || []).length;
      const unconditionalLogs = (content.match(/console\.(log|info|debug)\(/g) || []).length;
      
      conditionalLogCount += conditionalLogs;
      unconditionalLogCount += unconditionalLogs;
    }
  });
  
  logTest('Conditional Logging', conditionalLogCount > 0 ? 'PASS' : 'FAIL', 
    `Found ${conditionalLogCount} conditional log statements`);
  logTest('Unconditional Logs Removed', unconditionalLogCount === 0 ? 'PASS' : 'WARN', 
    `Found ${unconditionalLogCount} unconditional log statements`);
  
  testResults.postCleanup.performanceOptimization = {
    conditionalLogCount,
    unconditionalLogCount,
    optimizationRatio: conditionalLogCount / (conditionalLogCount + unconditionalLogCount) || 0,
  };
}

/**
 * Test centralized logging system
 */
function testCentralizedLogging() {
  logSection('CENTRALIZED LOGGING SYSTEM TEST');
  
  // Check if logger utility exists and is properly configured
  const loggerFile = 'src/utils/logger.ts';
  const envConfigFile = 'src/utils/env-config.ts';
  
  let loggerExists = false;
  let envConfigExists = false;
  let loggerCategories = 0;
  let environmentChecks = 0;
  
  if (fs.existsSync(loggerFile)) {
    loggerExists = true;
    const content = fs.readFileSync(loggerFile, 'utf8');
    
    // Count logger categories (look for logger property definitions)
    loggerCategories = (content.match(/\w+:\s*createLogger\(/g) || []).length;
    
    logTest('Logger Utility Exists', 'PASS', 'Centralized logger found');
    logTest('Logger Categories', loggerCategories > 0 ? 'PASS' : 'FAIL', 
      `Found ${loggerCategories} logger categories`);
  } else {
    logTest('Logger Utility Exists', 'FAIL', 'Centralized logger not found');
  }
  
  if (fs.existsSync(envConfigFile)) {
    envConfigExists = true;
    const content = fs.readFileSync(envConfigFile, 'utf8');
    
    // Count environment checks
    environmentChecks = (content.match(/isDev|isProd|isTest/g) || []).length;
    
    logTest('Environment Config Exists', 'PASS', 'Environment configuration found');
    logTest('Environment Checks', environmentChecks > 0 ? 'PASS' : 'FAIL', 
      `Found ${environmentChecks} environment checks`);
  } else {
    logTest('Environment Config Exists', 'FAIL', 'Environment configuration not found');
  }
  
  testResults.postCleanup.centralizedLogging = {
    loggerExists,
    envConfigExists,
    loggerCategories,
    environmentChecks,
  };
}

/**
 * Generate test report
 */
function generateTestReport() {
  logSection('TEST REPORT GENERATION');
  
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 4: Testing & Validation',
    testResults,
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      warnings: 0,
    },
  };
  
  // Calculate summary
  Object.values(testResults.postCleanup).forEach(test => {
    if (test.success !== undefined) {
      report.summary.totalTests++;
      if (test.success) {
        report.summary.passedTests++;
      } else {
        report.summary.failedTests++;
      }
    }
  });
  
  // Save report
  const reportPath = 'reports/console-cleanup/console-cleanup-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  logTest('Test Report Generated', 'PASS', `Saved to ${reportPath}`);
  
  // Display summary
  logSection('TEST SUMMARY');
  log(`Total Tests: ${report.summary.totalTests}`, 'blue');
  log(`Passed: ${report.summary.passedTests}`, 'green');
  log(`Failed: ${report.summary.failedTests}`, 'red');
  log(`Warnings: ${report.summary.warnings}`, 'yellow');
  
  if (report.summary.failedTests === 0) {
    log('\n🎉 All tests passed! Console log cleanup is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the results above.', 'yellow');
  }
}

/**
 * Main test execution
 */
function runTests() {
  log('🚀 Starting Console Log Cleanup Testing & Validation', 'bright');
  log('Phase 4: Testing & Validation Strategy', 'cyan');
  
  try {
    // Run all tests
    captureBuildOutput();
    testDevelopmentLogging();
    testErrorLoggingPreservation();
    testPerformanceOptimization();
    testCentralizedLogging();
    
    // Generate report
    generateTestReport();
    
  } catch (error) {
    log(`\n❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  captureBuildOutput,
  testDevelopmentLogging,
  testErrorLoggingPreservation,
  testPerformanceOptimization,
  testCentralizedLogging,
  generateTestReport,
};
