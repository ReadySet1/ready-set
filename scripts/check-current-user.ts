import { prisma } from '../src/utils/prismaDB';

async function checkCurrentUser() {
  try {
    console.log('🔍 Checking current user profile...');
    
    // Search for user by name "Fernando Cardenas" or similar
    const users = await prisma.profile.findMany({
      where: {
        OR: [
          { name: { contains: 'Fernando', mode: 'insensitive' } },
          { name: { contains: 'Cardenas', mode: 'insensitive' } },
          { email: { contains: 'fernando', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        type: true,
        status: true,
        createdAt: true
      }
    });

    console.log('\n📋 Found users:');
    if (users.length === 0) {
      console.log('❌ No users found with name containing "Fernando" or "Cardenas"');
      
      // Show all users
      const allUsers = await prisma.profile.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          type: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      console.log('\n📋 All users in database:');
      allUsers.forEach((user: any, index: number) => {
        console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type} - Status: ${user.status}`);
      });
    } else {
      users.forEach((user: any, index: number) => {
        console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - Type: ${user.type} - Status: ${user.status}`);
        
        // Check if this user has admin privileges
        const normalizedType = user.type?.toUpperCase();
        const hasAdminPrivileges = normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
        console.log(`   Admin privileges: ${hasAdminPrivileges ? '✅ YES' : '❌ NO'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking current user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentUser(); 