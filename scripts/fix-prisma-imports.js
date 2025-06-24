#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to update with their patterns
const filesToUpdate = [
  'src/app/api/orders/route.ts',
  'src/app/api/orders/on-demand-orders/route.ts',
  'src/app/api/orders/delete/route.ts',
  'src/app/api/user-orders/[order_number]/route.ts',
  'src/app/api/leads/route.ts',
  'src/app/api/file-uploads/fix-user-files/route.ts',
  'src/app/api/file-uploads/route.ts',
  'src/server/upload.ts',
  'src/app/actions/getUserFiles.ts',
  'src/utils/delete.ts',
  'src/middleware/authMiddleware.ts'
];

function updateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Replace PrismaClient import and instantiation
  const patterns = [
    {
      // Pattern 1: import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();
      search: /import\s*{\s*([^}]*?)PrismaClient([^}]*?)}\s*from\s*["']@\/prisma\/client["'];\s*const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\);/g,
      replace: (match, before, after) => {
        const otherImports = (before + after).replace(/,\s*$/, '').replace(/^\s*,/, '').trim();
        if (otherImports) {
          return `import { ${otherImports} } from "@prisma/client";\nimport { prisma } from "@/utils/prismaDB";`;
        } else {
          return `import { prisma } from "@/utils/prismaDB";`;
        }
      }
    },
    {
      // Pattern 2: const prisma = new PrismaClient();
      search: /const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\);/g,
      replace: 'import { prisma } from "@/utils/prismaDB";'
    },
    {
      // Pattern 3: const prismaClient = new PrismaClient();
      search: /const\s+prismaClient\s*=\s*new\s+PrismaClient\([^)]*\);/g,
      replace: 'import { prisma as prismaClient } from "@/utils/prismaDB";'
    }
  ];

  patterns.forEach(pattern => {
    if (typeof pattern.replace === 'function') {
      content = content.replace(pattern.search, pattern.replace);
    } else {
      const newContent = content.replace(pattern.search, pattern.replace);
      if (newContent !== content) {
        updated = true;
        content = newContent;
      }
    }
  });

  // Simple replacements
  const simpleReplacements = [
    {
      search: /import\s*{\s*PrismaClient\s*}\s*from\s*["']@\/prisma\/client["'];\s*const\s+prisma\s*=\s*new\s+PrismaClient\(\);/g,
      replace: 'import { prisma } from "@/utils/prismaDB";'
    },
    {
      search: /const\s+prisma\s*=\s*new\s+PrismaClient\(\);/g,
      replace: ''
    }
  ];

  simpleReplacements.forEach(({ search, replace }) => {
    const newContent = content.replace(search, replace);
    if (newContent !== content) {
      updated = true;
      content = newContent;
    }
  });

  // Add import if prisma is used but not imported
  if (content.includes('prisma.') && !content.includes('import { prisma }') && !content.includes('from "@/utils/prismaDB"')) {
    const lines = content.split('\n');
    const lastImportIndex = lines.findLastIndex(line => line.trim().startsWith('import '));
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, 'import { prisma } from "@/utils/prismaDB";');
      content = lines.join('\n');
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  } else {
    console.log(`No changes needed: ${filePath}`);
  }
}

console.log('Fixing Prisma imports...');

filesToUpdate.forEach(updateFile);

console.log('Prisma imports fixed!'); 