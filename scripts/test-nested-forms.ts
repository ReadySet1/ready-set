#!/usr/bin/env tsx

/**
 * Test script to verify no nested form issues exist
 * This script checks for potential nested form problems in the codebase
 */

import fs from 'fs';
import path from 'path';

const COMPONENTS_DIR = path.join(process.cwd(), 'src/components');

interface FormCheckResult {
  file: string;
  line: number;
  content: string;
  issue: string;
}

function checkForNestedForms(filePath: string): FormCheckResult[] {
  const results: FormCheckResult[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let inForm = false;
    let formDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // Skip undefined lines
      const trimmedLine = line.trim();
      
      // Check for form opening tags
      if (trimmedLine.includes('<form') && !trimmedLine.includes('</form')) {
        formDepth++;
        if (formDepth > 1) {
          results.push({
            file: filePath,
            line: i + 1,
            content: trimmedLine,
            issue: `Nested form detected at depth ${formDepth}`
          });
        }
      }
      
      // Check for form closing tags
      if (trimmedLine.includes('</form>')) {
        formDepth--;
        if (formDepth < 0) {
          results.push({
            file: filePath,
            line: i + 1,
            content: trimmedLine,
            issue: 'Unmatched form closing tag'
          });
        }
      }
    }
    
    // Check for unclosed forms
    if (formDepth > 0) {
      results.push({
        file: filePath,
        line: lines.length,
        content: 'End of file',
        issue: `Unclosed form (depth: ${formDepth})`
      });
    }
    
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
  
  return results;
}

function scanDirectory(dir: string): FormCheckResult[] {
  const results: FormCheckResult[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        results.push(...scanDirectory(fullPath));
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        // Check TypeScript/TSX files for form issues
        const fileResults = checkForNestedForms(fullPath);
        results.push(...fileResults);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  
  return results;
}

function main() {
  console.log('🔍 Scanning for nested form issues...\n');
  
  const results = scanDirectory(COMPONENTS_DIR);
  
  if (results.length === 0) {
    console.log('✅ No nested form issues found!');
    console.log('   All forms are properly structured.');
  } else {
    console.log(`❌ Found ${results.length} potential form issues:\n`);
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.issue}`);
      console.log(`   File: ${result.file}`);
      console.log(`   Line: ${result.line}`);
      console.log(`   Content: ${result.content}`);
      console.log('');
    });
    
    console.log('⚠️  Please review these files for potential nested form issues.');
  }
  
  console.log('🎯 Form structure validation complete!');
}

// Run the check
main();
