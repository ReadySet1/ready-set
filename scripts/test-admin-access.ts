import dotenv from 'dotenv';
import { createClient } from '../src/utils/supabase/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAdminAccess() {
  try {
    console.log('🔍 Testing admin access to production data...');
    
    // Create Supabase client
    const supabase = createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ No authenticated user found');
      console.log('💡 To see production data, you need to:');
      console.log('   1. Go to http://localhost:3000/sign-in');
      console.log('   2. Log in with an admin account');
      console.log('   3. Navigate to http://localhost:3000/admin');
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('type, name, email')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.log('❌ Could not fetch user profile');
      return;
    }
    
    console.log('👤 User profile:', {
      name: profile.name,
      email: profile.email,
      type: profile.type
    });
    
    // Check if user has admin privileges
    const hasAdminPrivileges = ['admin', 'super_admin', 'helpdesk'].includes(
      (profile.type || '').toLowerCase()
    );
    
    if (!hasAdminPrivileges) {
      console.log('❌ User does not have admin privileges');
      console.log('💡 Only admin, super_admin, or helpdesk users can access admin data');
      return;
    }
    
    console.log('✅ User has admin privileges');
    
    // Test API endpoints with authentication
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    
    if (!accessToken) {
      console.log('❌ No access token available');
      return;
    }
    
    console.log('\n📊 Testing API endpoints...');
    
    // Test users API
    try {
      const usersResponse = await fetch('http://localhost:3000/api/users?limit=5', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        console.log(`✅ Users API: Found ${usersData.totalCount} total users`);
        console.log('📋 Sample users:');
        usersData.users.slice(0, 3).forEach((user: any, index: number) => {
          console.log(`   ${index + 1}. ${user.name || 'N/A'} (${user.email}) - ${user.type} - ${user.status}`);
        });
      } else {
        console.log(`❌ Users API failed: ${usersResponse.status} - ${await usersResponse.text()}`);
      }
    } catch (error) {
      console.log('❌ Users API error:', error);
    }
    
    // Test catering orders API
    try {
      const ordersResponse = await fetch('http://localhost:3000/api/orders/catering-orders?limit=5', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        console.log(`\n✅ Catering Orders API: Found ${ordersData.totalCount} total orders`);
        console.log('📋 Sample orders:');
        ordersData.orders.slice(0, 3).forEach((order: any, index: number) => {
          console.log(`   ${index + 1}. ${order.orderNumber} - ${order.user?.name || 'N/A'} - $${order.orderTotal} - ${order.status}`);
        });
      } else {
        console.log(`❌ Catering Orders API failed: ${ordersResponse.status} - ${await ordersResponse.text()}`);
      }
    } catch (error) {
      console.log('❌ Catering Orders API error:', error);
    }
    
    console.log('\n🎉 If you see data above, your local environment is correctly connected to production data!');
    console.log('💡 The data you see in the admin panel should match what you see in production.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminAccess(); 