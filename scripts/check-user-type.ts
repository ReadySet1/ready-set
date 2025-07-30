import { prisma } from '../src/utils/prismaDB';

async function checkUserType() {
  try {
    console.log('🔍 Checking user types in database...');
    
    // Get all users with their types
    const users = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        type: true,
        name: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log('\n📋 Recent users in database:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type}`);
    });

    // Check for admin users specifically
    const adminUsers = await prisma.profile.findMany({
      where: {
        type: {
          in: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK']
        }
      },
      select: {
        id: true,
        email: true,
        type: true,
        name: true
      }
    });

    console.log('\n👑 Admin users found:');
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found in database');
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type}`);
      });
    }

    // Check enum values
    console.log('\n🔧 Expected enum values:');
    console.log('ADMIN:', 'ADMIN');
    console.log('SUPER_ADMIN:', 'SUPER_ADMIN');
    console.log('HELPDESK:', 'HELPDESK');

  } catch (error) {
    console.error('❌ Error checking user types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserType(); 