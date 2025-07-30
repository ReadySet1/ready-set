import { prisma } from '../src/utils/prismaDB';
import { createClient } from '../src/utils/supabase/server';
import { UserType, UserStatus } from '../src/types/prisma';

async function createAdminUser() {
  try {
    console.log('🔧 Creating test admin user...');
    
    const testEmail = 'admin@test.com';
    const testPassword = 'admin123456';
    const testName = 'Test Admin User';

    // Check if user already exists
    const existingUser = await prisma.profile.findUnique({
      where: { email: testEmail },
    });

    if (existingUser) {
      console.log(`✅ User ${testEmail} already exists with type: ${existingUser.type}`);
      
      // Check if the type is correct
      if (existingUser.type === 'ADMIN' || existingUser.type === 'SUPER_ADMIN' || existingUser.type === 'HELPDESK') {
        console.log('✅ User type is correct (uppercase)');
      } else {
        console.log(`⚠️ User type is incorrect: ${existingUser.type}. Fixing...`);
        
        // Fix the user type
        await prisma.profile.update({
          where: { id: existingUser.id },
          data: { type: 'ADMIN' as any }
        });
        console.log('✅ Fixed user type to ADMIN');
      }
      
      return;
    }

    // Create Supabase client
    const supabase = await createClient();
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: testName,
        user_type: 'ADMIN'
      }
    });

    if (authError) {
      console.error('❌ Error creating user in Supabase:', authError);
      return;
    }

    if (!authData.user) {
      console.error('❌ No user data returned from Supabase');
      return;
    }

    // Create user in Prisma database
    const newUser = await prisma.profile.create({
      data: {
        id: authData.user.id,
        email: testEmail,
        name: testName,
        type: UserType.ADMIN,
        status: UserStatus.ACTIVE,
        isTemporaryPassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Test admin user created successfully!');
    console.log(`📧 Email: ${testEmail}`);
    console.log(`🔑 Password: ${testPassword}`);
    console.log(`👤 Type: ${newUser.type}`);
    console.log(`🆔 ID: ${newUser.id}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser(); 