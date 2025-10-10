// src/app/actions/getUserFiles.ts

'use server';

import { PrismaClient } from '@prisma/client';

import { prisma } from "@/utils/prismaDB";

export type UserFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  category: string;
};

export async function getUserFiles(entityId: string) {
  'use server'


  try {
    // Verify that entityId exists and is not empty
    if (!entityId) {
      console.error('EntityId is empty or undefined');
      return [];
    }

    // Log the query parameters

    // Try to find files with both entityId and entityType
    const userFiles = await prisma.fileUpload.findMany({
      where: {
        userId: entityId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileUrl: true,
        category: true,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });


    return userFiles;
  } catch (error) {
    console.error('Error fetching entity files:', error);
    throw new Error('Failed to fetch entity files');
  }
}