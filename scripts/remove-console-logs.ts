#!/usr/bin/env tsx
/**
 * AST-based Console.log Remover
 *
 * Uses TypeScript Compiler API to safely remove console.log statements
 * while preserving all other code structure.
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
   * Transform the source file by removing console.log statements
   */
  private transform(sourceFile: ts.SourceFile): { text: string; removedCount: number } {
    let removedCount = 0;

    const visit = (node: ts.Node): ts.VisitResult<ts.Node> => {
      // Check if this statement should be removed
      if (this.shouldRemoveStatement(node)) {
        removedCount++;
        return undefined; // Remove the node
      }

      // Recursively visit children
      return ts.visitEachChild(node, visit, undefined as any);
    };

    const transformedSourceFile = ts.visitNode(sourceFile, visit) as ts.SourceFile;

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false
    });

    const text = printer.printFile(transformedSourceFile);

    return { text, removedCount };
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // Create source file
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      // Transform the file
      const { text: transformedCode, removedCount } = this.transform(sourceFile);

      // Only process if we actually removed something
      if (removedCount > 0) {
        console.log(`  ✓ ${path.relative(process.cwd(), filePath)}: ${removedCount} console.log(s) removed`);

        this.stats.statementsRemoved += removedCount;
        this.stats.filesModified++;

        if (!dryRun) {
          fs.writeFileSync(filePath, transformedCode, 'utf-8');
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

  console.log('🚀 AST-based Console.log Remover');
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
