#!/usr/bin/env tsx
/**
 * AST-based Console.log Remover (Character-Range Removal)
 *
 * Uses TypeScript Compiler API to identify console.log statements,
 * then removes them by character position to handle multi-line statements correctly.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface RemovalStats {
  filesProcessed: number;
  filesModified: number;
  statementsRemoved: number;
  errors: Array<{ file: string; error: string }>;
}

interface RemovalRange {
  start: number;
  end: number;
}

class ConsoleLogRemover {
  private stats: RemovalStats = {
    filesProcessed: 0,
    filesModified: 0,
    statementsRemoved: 0,
    errors: []
  };

  /**
   * Check if a node is a console.log call expression
   */
  private isConsoleLog(node: ts.Node): boolean {
    if (!ts.isCallExpression(node)) {
      return false;
    }

    const expression = node.expression;

    // Check for console.log
    if (ts.isPropertyAccessExpression(expression)) {
      return (
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'console' &&
        ts.isIdentifier(expression.name) &&
        expression.name.text === 'log'
      );
    }

    return false;
  }

  /**
   * Check if we should remove this statement
   * Only remove if it's a standalone console.log statement, not part of a larger expression
   */
  private shouldRemoveStatement(node: ts.Node): boolean {
    // If it's an expression statement containing console.log
    if (ts.isExpressionStatement(node)) {
      return this.isConsoleLog(node.expression);
    }

    return false;
  }

  /**
   * Find character ranges of console.log statements to remove
   * Returns ranges including the entire statement with semicolon and trailing newline
   */
  private findConsoleLogRanges(sourceFile: ts.SourceFile, sourceCode: string): RemovalRange[] {
    const rangesToRemove: RemovalRange[] = [];

    const visit = (node: ts.Node) => {
      if (this.shouldRemoveStatement(node)) {
        // Get the start position of the statement
        const start = node.getStart(sourceFile);

        // Get the end position (including semicolon)
        let end = node.getEnd();

        // Try to include the newline after the statement
        // Look for newline character after the statement
        if (end < sourceCode.length) {
          // Check if there's a newline immediately after
          if (sourceCode[end] === '\r' && sourceCode[end + 1] === '\n') {
            end += 2; // Include CRLF
          } else if (sourceCode[end] === '\n') {
            end += 1; // Include LF
          } else if (sourceCode[end] === '\r') {
            end += 1; // Include CR
          }
        }

        rangesToRemove.push({ start, end });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return rangesToRemove;
  }

  /**
   * Remove console.log statements by character ranges
   * Handles multi-line statements correctly
   */
  private removeRanges(sourceCode: string, ranges: RemovalRange[]): string {
    if (ranges.length === 0) {
      return sourceCode;
    }

    // Sort ranges in reverse order (from end to start) so we can remove from back to front
    // This way, earlier removals don't affect the positions of later removals
    const sortedRanges = [...ranges].sort((a, b) => b.start - a.start);

    let result = sourceCode;
    for (const range of sortedRanges) {
      result = result.substring(0, range.start) + result.substring(range.end);
    }

    return result;
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // Create source file for AST analysis
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      // Find character ranges of console.log statements
      const rangesToRemove = this.findConsoleLogRanges(sourceFile, sourceCode);

      // Only process if we actually found something to remove
      if (rangesToRemove.length > 0) {
        console.log(`  ✓ ${path.relative(process.cwd(), filePath)}: ${rangesToRemove.length} console.log(s) removed`);

        this.stats.statementsRemoved += rangesToRemove.length;
        this.stats.filesModified++;

        if (!dryRun) {
          // Remove the ranges
          const modifiedCode = this.removeRanges(sourceCode, rangesToRemove);
          fs.writeFileSync(filePath, modifiedCode, 'utf-8');
        }

        return true;
      }

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errors.push({ file: filePath, error: errorMessage });
      console.error(`  ✗ Error processing ${filePath}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Find all TypeScript and JavaScript files in the project
   */
  private async findSourceFiles(patterns: string[]): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/scripts/**',
          '**/__tests__/**'
        ],
        absolute: true
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Run the console.log removal process
   */
  async run(options: {
    patterns: string[];
    dryRun?: boolean;
    verbose?: boolean;
  }): Promise<RemovalStats> {
    const { patterns, dryRun = false, verbose = false } = options;

    console.log('🔍 Finding source files...');
    const files = await this.findSourceFiles(patterns);
    console.log(`📁 Found ${files.length} files to process\n`);

    if (dryRun) {
      console.log('🔬 DRY RUN MODE - No files will be modified\n');
    }

    console.log('🧹 Removing console.log statements...\n');

    for (const file of files) {
      this.stats.filesProcessed++;
      await this.processFile(file, dryRun);
    }

    return this.stats;
  }

  /**
   * Print statistics
   */
  printStats(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REMOVAL STATISTICS');
    console.log('='.repeat(60));
    console.log(`Files processed:       ${this.stats.filesProcessed}`);
    console.log(`Files modified:        ${this.stats.filesModified}`);
    console.log(`Statements removed:    ${this.stats.statementsRemoved}`);
    console.log(`Errors encountered:    ${this.stats.errors.length}`);
    console.log('='.repeat(60) + '\n');

    if (this.stats.errors.length > 0) {
      console.log('❌ Errors:');
      this.stats.errors.forEach(({ file, error }) => {
        console.log(`  - ${path.relative(process.cwd(), file)}: ${error}`);
      });
      console.log();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.js',
    'src/**/*.jsx'
  ];

  console.log('🚀 AST-based Console.log Remover (Character-Range Removal)');
  console.log('='.repeat(60) + '\n');

  const remover = new ConsoleLogRemover();

  try {
    await remover.run({ patterns, dryRun, verbose });
    remover.printStats();

    if (dryRun) {
      console.log('💡 Run without --dry-run flag to apply changes\n');
    } else {
      console.log('✅ Console.log statements have been removed successfully!\n');
      console.log('📝 Next steps:');
      console.log('  1. Run: pnpm typecheck');
      console.log('  2. Test your application');
      console.log('  3. Commit changes if everything works\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

export { ConsoleLogRemover };
