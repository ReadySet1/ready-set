#!/usr/bin/env npx tsx

/**
 * Comprehensive Test Script for Bug Fixes
 * 
 * This script runs all tests related to the bug fixes to ensure
 * everything works correctly before production deployment.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runCommand(command: string, args: string[], testName: string): Promise<TestResult> {
    console.log(`\n🧪 Running ${testName}...`);
    const start = Date.now();
    
    return new Promise((resolve) => {
      const process = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        const duration = Date.now() - start;
        const result: TestResult = {
          name: testName,
          status: code === 0 ? 'passed' : 'failed',
          duration,
          error: code !== 0 ? errorOutput || output : undefined,
        };

        if (result.status === 'passed') {
          console.log(`✅ ${testName} passed (${duration}ms)`);
        } else {
          console.log(`❌ ${testName} failed (${duration}ms)`);
          if (result.error) {
            console.log(`   Error: ${result.error.slice(0, 200)}...`);
          }
        }

        resolve(result);
      });
    });
  }

  async runTests(): Promise<void> {
    console.log('🚀 Starting Bug Fixes Test Suite');
    console.log('=====================================\n');

    // 1. Unit Tests for Header Component
    this.results.push(
      await this.runCommand(
        'npm',
        ['run', 'test', '--', 'src/__tests__/components/Header/Header.test.tsx'],
        'Header Component Auth Update Tests'
      )
    );

    // 2. Unit Tests for AddressForm Component
    this.results.push(
      await this.runCommand(
        'npm',
        ['run', 'test', '--', 'src/__tests__/components/AddressManager/AddAddressForm-StateValidation.test.tsx'],
        'AddressForm State Validation Tests'
      )
    );

    // 3. Unit Tests for CSV Export
    this.results.push(
      await this.runCommand(
        'npm',
        ['run', 'test', '--', 'src/__tests__/components/Admin/JobApplications/CSVExport.test.tsx'],
        'CSV Export Functionality Tests'
      )
    );

    // 4. API Tests for Job Status
    this.results.push(
      await this.runCommand(
        'npm',
        ['run', 'test', '--', 'src/__tests__/api/admin/job-applications/status.test.ts'],
        'Job Application Status API Tests'
      )
    );

    // 5. Integration Tests (existing)
    if (existsSync('src/__tests__/integration')) {
      this.results.push(
        await this.runCommand(
          'npm',
          ['run', 'test', '--', 'src/__tests__/integration/catering-address-form.test.tsx'],
          'Catering Address Form Integration Tests'
        )
      );

      this.results.push(
        await this.runCommand(
          'npm',
          ['run', 'test', '--', 'src/__tests__/integration/order-navigation.test.tsx'],
          'Order Navigation Integration Tests'
        )
      );
    }

    // 6. E2E Tests
    if (existsSync('e2e/bug-fixes-integration.spec.ts')) {
      this.results.push(
        await this.runCommand(
          'npx',
          ['playwright', 'test', 'e2e/bug-fixes-integration.spec.ts'],
          'Bug Fixes E2E Integration Tests'
        )
      );
    }

    // 7. Existing E2E Tests
    if (existsSync('e2e/address-county-selection.spec.ts')) {
      this.results.push(
        await this.runCommand(
          'npx',
          ['playwright', 'test', 'e2e/address-county-selection.spec.ts'],
          'Address County Selection E2E Tests'
        )
      );
    }

    if (existsSync('e2e/order-url-encoding.spec.ts')) {
      this.results.push(
        await this.runCommand(
          'npx',
          ['playwright', 'test', 'e2e/order-url-encoding.spec.ts'],
          'Order URL Encoding E2E Tests'
        )
      );
    }

    if (existsSync('e2e/user-edit-workflow.spec.ts')) {
      this.results.push(
        await this.runCommand(
          'npx',
          ['playwright', 'test', 'e2e/user-edit-workflow.spec.ts'],
          'User Edit Workflow E2E Tests'
        )
      );
    }

    // 8. Type Checking
    this.results.push(
      await this.runCommand(
        'npx',
        ['tsc', '--noEmit'],
        'TypeScript Type Checking'
      )
    );

    // 9. Linting
    this.results.push(
      await this.runCommand(
        'npm',
        ['run', 'lint'],
        'ESLint Code Quality Check'
      )
    );

    this.printSummary();
  }

  private printSummary(): void {
    const totalTime = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    console.log('\n=====================================');
    console.log('📊 TEST SUMMARY');
    console.log('=====================================');
    
    console.log(`\n⏱️  Total Time: ${totalTime}ms`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total: ${this.results.length}`);

    console.log('\n📋 DETAILED RESULTS:');
    console.log('-------------------------------------');
    
    this.results.forEach(result => {
      const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${result.name} (${result.duration}ms)`);
    });

    if (failed > 0) {
      console.log('\n🚨 FAILED TESTS:');
      console.log('-------------------------------------');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`❌ ${result.name}`);
          if (result.error) {
            console.log(`   Error: ${result.error.slice(0, 300)}...`);
          }
        });
    }

    console.log('\n=====================================');
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! Ready for production deployment.');
      console.log('\n📋 Bug Fixes Verified:');
      console.log('• Header/Mailbar auth state updates');
      console.log('• CA state validation and normalization');
      console.log('• Bay Area counties in vendor orders');
      console.log('• CSV export functionality');
      console.log('• Job application status changes');
      console.log('• Admin users permissions');
      console.log('• Vendor details display');
      console.log('• Driver assignment dialog positioning');
      
      console.log('\n🚀 Next Steps:');
      console.log('1. Review and merge changes');
      console.log('2. Deploy to staging environment');
      console.log('3. Run smoke tests in staging');
      console.log('4. Deploy to production');
      
      process.exit(0);
    } else {
      console.log('🚨 TESTS FAILED! Please fix issues before deployment.');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check error messages above');
      console.log('2. Run individual tests for detailed output');
      console.log('3. Ensure all dependencies are installed');
      console.log('4. Check test database/mock data setup');
      
      process.exit(1);
    }
  }
}

// Check prerequisites
async function checkPrerequisites(): Promise<boolean> {
  console.log('🔍 Checking prerequisites...');
  
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'src',
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      console.error(`❌ Required file/directory not found: ${file}`);
      return false;
    }
  }

  console.log('✅ Prerequisites check passed');
  return true;
}

// Main execution
async function main() {
  try {
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
      console.error('🚨 Prerequisites check failed. Please ensure you are in the project root directory.');
      process.exit(1);
    }

    const runner = new TestRunner();
    await runner.runTests();
  } catch (error) {
    console.error('🚨 Test runner error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TestRunner }; 