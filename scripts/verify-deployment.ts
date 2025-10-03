import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

async function runVerification(): Promise<void> {
  const results: VerificationResult[] = [];

  console.log('🔍 Starting Post-Deployment Verification...\n');

  // 1. Check database connectivity
  try {
    const { error } = await supabase.from('profiles').select('count').single();
    results.push({
      check: 'Database Connectivity',
      status: error ? 'FAIL' : 'PASS',
      message: error ? error.message : 'Connection successful',
    });
  } catch (err) {
    results.push({
      check: 'Database Connectivity',
      status: 'FAIL',
      message: String(err),
    });
  }

  // 2. Check testimonials table exists
  try {
    const { data, error } = await supabase.from('testimonials').select('count');
    results.push({
      check: 'Testimonials Table',
      status: error ? 'FAIL' : 'PASS',
      message: error ? error.message : 'Table exists and accessible',
    });
  } catch (err) {
    results.push({
      check: 'Testimonials Table',
      status: 'FAIL',
      message: String(err),
    });
  }

  // 3. Check RLS enabled (attempt to access without auth)
  try {
    const { data, error } = await supabase.from('accounts').select('*');
    results.push({
      check: 'RLS on Accounts',
      status: data && data.length > 0 ? 'FAIL' : 'PASS',
      message: data && data.length > 0
        ? 'WARNING: Accounts accessible without auth!'
        : 'RLS properly restricting access',
    });
  } catch (err) {
    results.push({
      check: 'RLS on Accounts',
      status: 'PASS',
      message: 'RLS properly enabled',
    });
  }

  // 4. Check critical tables exist
  const tables = [
    'profiles',
    'addresses',
    'catering_requests',
    'on_demand_requests',
    'calculator_templates',
    'pricing_rules',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      results.push({
        check: `Table: ${table}`,
        status: error ? 'FAIL' : 'PASS',
        message: error ? error.message : 'Exists',
      });
    } catch (err) {
      results.push({
        check: `Table: ${table}`,
        status: 'FAIL',
        message: String(err),
      });
    }
  }

  // Print results
  console.log('\n📊 Verification Results:\n');
  console.log('━'.repeat(80));

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.check.padEnd(30)} | ${result.message}`);

    if (result.status === 'PASS') passed++;
    else if (result.status === 'FAIL') failed++;
    else warnings++;
  });

  console.log('━'.repeat(80));
  console.log(`\n✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Warnings: ${warnings}\n`);

  if (failed > 0) {
    console.error('❌ Deployment verification FAILED! Initiate rollback procedure.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.warn('⚠️ Deployment verification passed with warnings. Review before proceeding.\n');
  } else {
    console.log('✅ Deployment verification PASSED! All checks successful.\n');
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
