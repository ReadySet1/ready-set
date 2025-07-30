import dotenv from 'dotenv';
import { prisma } from '../src/utils/prismaDB';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('📊 Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET'
    });
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Check user counts
    const userCount = await prisma.profile.count();
    console.log(`👥 Total users in database: ${userCount}`);
    
    // Check catering orders count
    const cateringOrderCount = await prisma.cateringRequest.count();
    console.log(`🍽️ Total catering orders in database: ${cateringOrderCount}`);
    
    // Check on-demand orders count
    const onDemandOrderCount = await prisma.onDemand.count();
    console.log(`⚡ Total on-demand orders in database: ${onDemandOrderCount}`);
    
    // Get some sample users
    const sampleUsers = await prisma.profile.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('\n📋 Sample users:');
    sampleUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'N/A'} (${user.email}) - ${user.type} - ${user.status}`);
    });
    
    // Get some sample catering orders
    const sampleCateringOrders = await prisma.cateringRequest.findMany({
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderTotal: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('\n📋 Sample catering orders:');
    sampleCateringOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.orderNumber} - ${order.user?.name || 'N/A'} - $${order.orderTotal} - ${order.status}`);
    });
    
    // Check for any soft-deleted records
    const softDeletedCateringOrders = await prisma.cateringRequest.count({
      where: {
        deletedAt: { not: null }
      }
    });
    
    console.log(`\n🗑️ Soft-deleted catering orders: ${softDeletedCateringOrders}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection(); 