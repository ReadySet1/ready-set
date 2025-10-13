#!/bin/bash

# Enhanced Git Hooks Setup Script
# This script applies the enhanced pre-commit and pre-push hooks

set -e

echo "🚀 Setting up enhanced Git hooks for Ready Set..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo -e "${BLUE}Step 1: Backing up existing hooks...${NC}"
if [ -f ".husky/pre-commit" ]; then
    cp .husky/pre-commit .husky/pre-commit.backup
    echo -e "${GREEN}✅ Backed up pre-commit to pre-commit.backup${NC}"
fi

if [ -f ".husky/pre-push" ]; then
    cp .husky/pre-push .husky/pre-push.backup
    echo -e "${GREEN}✅ Backed up pre-push to pre-push.backup${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Installing enhanced hooks...${NC}"

# Copy enhanced hooks to actual hook files
if [ -f ".husky/pre-commit.enhanced" ]; then
    cp .husky/pre-commit.enhanced .husky/pre-commit
    chmod +x .husky/pre-commit
    echo -e "${GREEN}✅ Installed enhanced pre-commit hook${NC}"
else
    echo -e "${YELLOW}⚠️  Enhanced pre-commit hook not found${NC}"
fi

if [ -f ".husky/pre-push.enhanced" ]; then
    cp .husky/pre-push.enhanced .husky/pre-push
    chmod +x .husky/pre-push
    echo -e "${GREEN}✅ Installed enhanced pre-push hook${NC}"
else
    echo -e "${YELLOW}⚠️  Enhanced pre-push hook not found${NC}"
fi

echo ""
echo -e "${BLUE}Step 3: Verifying PR template...${NC}"
if [ -f ".github/PULL_REQUEST_TEMPLATE.md" ]; then
    echo -e "${GREEN}✅ PR template exists${NC}"
else
    echo -e "${YELLOW}⚠️  PR template not found at .github/PULL_REQUEST_TEMPLATE.md${NC}"
fi

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "📋 What was configured:"
echo "  ✅ Pre-commit hook: TypeScript check, Lint, Prisma validation, Unit tests"
echo "  ✅ Pre-push hook: All of above + Integration tests + Build"
echo "  ✅ PR template: Comprehensive checklist for code reviews"
echo ""
echo "🧪 Test your setup:"
echo "  1. Make a small change"
echo "  2. git add ."
echo "  3. git commit -m 'test: verify hooks'"
echo "     (This will run: typecheck, lint, prisma validate, unit tests)"
echo ""
echo "💡 To temporarily bypass hooks (emergency only):"
echo "  git commit --no-verify -m 'emergency fix'"
echo ""
echo "🔧 To revert to old hooks:"
echo "  cp .husky/pre-commit.backup .husky/pre-commit"
echo "  cp .husky/pre-push.backup .husky/pre-push"
echo ""
echo "📖 For full documentation, see: deployment_plan_updated.md"
