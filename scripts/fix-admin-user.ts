import { prisma } from '../src/utils/prismaDB';

async function fixAdminUser() {
  try {
    console.log('🔧 Fixing admin user issue...');
    
    // First, let's see all users in the database
    const allUsers = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        type: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n📋 All users in database:');
    if (allUsers.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    allUsers.forEach((user: any, index: number) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type} - Status: ${user.status}`);
    });

    // Check for users with lowercase types that need to be fixed
    const usersToFix = allUsers.filter((user: any) => {
      const type = user.type as string;
      return type === 'admin' || type === 'super_admin' || type === 'helpdesk' || 
             type === 'vendor' || type === 'client' || type === 'driver';
    });

    if (usersToFix.length > 0) {
      console.log(`\n🔧 Found ${usersToFix.length} users with lowercase types that need to be fixed:`);
      
      for (const user of usersToFix) {
        const currentType = user.type as string;
        let newType: string;

        switch (currentType) {
          case 'admin':
            newType = 'ADMIN';
            break;
          case 'super_admin':
            newType = 'SUPER_ADMIN';
            break;
          case 'helpdesk':
            newType = 'HELPDESK';
            break;
          case 'vendor':
            newType = 'VENDOR';
            break;
          case 'client':
            newType = 'CLIENT';
            break;
          case 'driver':
            newType = 'DRIVER';
            break;
          default:
            console.log(`⚠️ Unknown type for user ${user.email}: ${currentType}`);
            continue;
        }

        try {
          await prisma.profile.update({
            where: { id: user.id },
            data: { type: newType as any }
          });
          console.log(`✅ Fixed user ${user.email}: ${currentType} → ${newType}`);
        } catch (error) {
          console.error(`❌ Failed to fix user ${user.email}:`, error);
        }
      }
    } else {
      console.log('\n✅ No users with lowercase types found. All user types are correct.');
    }

    // Check for admin users specifically
    const adminUsers = allUsers.filter((user: any) => {
      const normalizedType = user.type?.toUpperCase();
      return normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
    });

    console.log(`\n👑 Admin users found: ${adminUsers.length}`);
    adminUsers.forEach((user: any, index: number) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type}`);
    });

    // If no admin users exist, create a test admin user
    if (adminUsers.length === 0) {
      console.log('\n⚠️ No admin users found. Creating a test admin user...');
      
      // Check if there are any users at all
      if (allUsers.length === 0) {
        console.log('❌ No users in database. Cannot create admin user without existing users.');
        console.log('💡 Please create a user first through the registration process, then run this script again.');
        return;
      }

      // Use the first user and make them an admin
      const firstUser = allUsers[0];
      console.log(`🔧 Making user ${firstUser.email} an admin...`);
      
      try {
        await prisma.profile.update({
          where: { id: firstUser.id },
          data: { type: 'ADMIN' as any }
        });
        console.log(`✅ Successfully made ${firstUser.email} an admin!`);
      } catch (error) {
        console.error(`❌ Failed to make ${firstUser.email} an admin:`, error);
      }
    }

    console.log('\n🎉 Admin user fix completed!');
    console.log('\n📋 Final user types:');
    const finalUsers = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        type: true,
        status: true
      },
      orderBy: { createdAt: 'desc' }
    });

    finalUsers.forEach((user: any, index: number) => {
      const normalizedType = user.type?.toUpperCase();
      const hasAdminPrivileges = normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type} - Admin: ${hasAdminPrivileges ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Error fixing admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminUser(); 