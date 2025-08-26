#!/usr/bin/env tsx

/**
 * Test script for address creation API endpoint
 * This script tests the /api/addresses POST endpoint to ensure it's working correctly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAddressCreation() {
  console.log('🧪 Starting address creation test...\n');

  try {
    // Test 1: Authentication
    console.log('1️⃣ Testing authentication...');
    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword',
    });

    if (authError || !session) {
      console.error('❌ Authentication failed:', authError);
      return;
    }

    console.log('✅ Authentication successful');
    console.log(`   User ID: ${session.user.id}`);
    console.log(`   Access Token: ${session.access_token.substring(0, 20)}...\n`);

    // Test 2: Address creation
    console.log('2️⃣ Testing address creation...');
    
    const testAddress = {
      street1: '123 Test Street',
      street2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      county: 'San Francisco',
      locationNumber: '415-555-1234',
      parkingLoading: 'Street parking available',
      isRestaurant: false,
      isShared: false,
      name: 'Test Address',
    };

    console.log('   Sending address data:', testAddress);

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(testAddress),
    });

    console.log(`   Response status: ${response.status}`);
    console.log(`   Response OK: ${response.ok}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Address creation failed:', errorText);
      return;
    }

    const createdAddress = await response.json();
    console.log('✅ Address created successfully!');
    console.log(`   Address ID: ${createdAddress.id}`);
    console.log(`   Created at: ${createdAddress.createdAt}`);
    console.log(`   Created by: ${createdAddress.createdBy}\n`);

    // Test 3: Verify address retrieval
    console.log('3️⃣ Testing address retrieval...');
    
    const getResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/addresses?id=${createdAddress.id}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!getResponse.ok) {
      console.error('❌ Address retrieval failed:', getResponse.statusText);
      return;
    }

    const retrievedAddress = await getResponse.json();
    console.log('✅ Address retrieved successfully!');
    console.log(`   Street: ${retrievedAddress.street1}`);
    console.log(`   City: ${retrievedAddress.city}`);
    console.log(`   State: ${retrievedAddress.state}`);
    console.log(`   ZIP: ${retrievedAddress.zip}\n`);

    // Test 4: Cleanup (optional)
    console.log('4️⃣ Testing address deletion...');
    
    const deleteResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/addresses?id=${createdAddress.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!deleteResponse.ok) {
      console.warn('⚠️ Address deletion failed (this is okay for testing):', deleteResponse.statusText);
    } else {
      console.log('✅ Test address cleaned up successfully');
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Sign out
    await supabase.auth.signOut();
    console.log('\n👋 Signed out from test session');
  }
}

// Run the test
testAddressCreation().catch(console.error);
