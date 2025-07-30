import { prisma } from '../src/utils/prismaDB';

async function fixUserTypes() {
  try {
    console.log('🔧 Fixing user types in database...');
    
    // Get all users with their types
    const users = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        type: true,
        name: true
      }
    });

    console.log('\n📋 Current users in database:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type}`);
    });

    // Check for users with lowercase types that need to be fixed
    const usersToFix = users.filter(user => {
      const type = user.type as string;
      return type === 'admin' || type === 'super_admin' || type === 'helpdesk' || 
             type === 'vendor' || type === 'client' || type === 'driver';
    });

    if (usersToFix.length === 0) {
      console.log('\n✅ No users with lowercase types found. All user types are correct.');
      return;
    }

    console.log(`\n🔧 Found ${usersToFix.length} users with lowercase types that need to be fixed:`);
    usersToFix.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - Current type: ${user.type}`);
    });

    // Fix each user's type
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

    console.log('\n🎉 User type fix completed!');

    // Show final state
    const finalUsers = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        type: true,
        name: true
      }
    });

    console.log('\n📋 Final user types:');
    finalUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type}`);
    });

  } catch (error) {
    console.error('❌ Error fixing user types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserTypes(); 