# Deployment Configuration - Ready Set

This guide sets up comprehensive pre-commit hooks and PR templates tailored to your Next.js + Prisma + Supabase stack.

## Current Setup Analysis

✅ **Already Configured:**
- Husky installed and initialized
- Jest for unit/integration testing
- Playwright for e2e testing
- TypeScript with custom type-check script
- ESLint (Next.js config)
- Prisma schema validation
- Comprehensive deployment validation scripts

## Step 1: Enable Pre-Commit Checks

Your pre-commit hook is currently disabled. Here's an enhanced version that matches your stack:

Edit `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit validation..."

# 1. TypeScript Type Checking
echo "📝 Type checking..."
pnpm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Fix them before committing."
  exit 1
fi

# 2. Linting
echo "🧹 Linting..."
pnpm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting errors found. Fix them before committing."
  exit 1
fi

# 3. Prisma Schema Validation
echo "🗄️  Validating Prisma schema..."
pnpm prisma validate
if [ $? -ne 0 ]; then
  echo "❌ Prisma schema validation failed."
  exit 1
fi

# 4. Unit Tests (fast feedback)
echo "🧪 Running unit tests..."
pnpm run test:unit --passWithNoTests --silent
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Fix them before committing."
  exit 1
fi

# 5. Build Check (optional - comment out if too slow)
# echo "🏗️  Testing build..."
# pnpm run build:no-typecheck
# if [ $? -ne 0 ]; then
#   echo "❌ Build failed. Fix errors before committing."
#   exit 1
# fi

echo "✅ All pre-commit checks passed! Proceeding with commit..."
```

**Performance Note:** If builds are slow, keep the build check commented out and rely on pre-push instead.

## Step 2: Enhanced Pre-Push Checks

Update `.husky/pre-push` for more thorough validation:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 Running pre-push validation..."

# 1. Type checking (already done in pre-commit, but double-check)
echo "📝 Type checking..."
pnpm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found."
  exit 1
fi

# 2. Lint
echo "🧹 Linting..."
pnpm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting errors found."
  exit 1
fi

# 3. Prisma Generate & Validate
echo "🗄️  Generating Prisma client and validating..."
pnpm prisma generate
pnpm prisma validate
if [ $? -ne 0 ]; then
  echo "❌ Prisma validation failed."
  exit 1
fi

# 4. Run all unit and integration tests
echo "🧪 Running comprehensive test suite..."
pnpm run test:unit --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed."
  exit 1
fi

pnpm run test:integration --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Integration tests failed."
  exit 1
fi

# 5. Build validation
echo "🏗️  Testing production build..."
pnpm run build:no-typecheck
if [ $? -ne 0 ]; then
  echo "❌ Production build failed."
  exit 1
fi

# 6. Optional: Run e2e tests (comment out if too slow for regular pushes)
# echo "🎭 Running e2e tests..."
# pnpm run test:e2e
# if [ $? -ne 0 ]; then
#   echo "❌ E2E tests failed."
#   exit 1
# fi

echo "✅ All pre-push checks passed! Safe to push."
```

## Step 3: Create GitHub PR Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## 📋 Description
<!-- Provide a clear and concise description of your changes -->


## 🔧 Type of Change
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style/UI update
- [ ] ♻️ Code refactor
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🗄️ Database migration

## 📝 Changes Made
<!-- List the main changes in bullet points -->
- 
- 
- 

## 🧪 Testing Checklist

### Pre-Merge Requirements
- [ ] `pnpm typecheck` passes (no TypeScript errors)
- [ ] `pnpm lint` passes (no ESLint errors)
- [ ] `pnpm prisma validate` passes (if schema changed)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:integration` passes (if applicable)
- [ ] `pnpm test:e2e` passes (for critical user flows)

### Code Quality
- [ ] Branch is up to date with `main`
- [ ] No merge conflicts
- [ ] Code follows project TypeScript/Next.js best practices
- [ ] Complex logic includes JSDoc comments
- [ ] Type safety maintained (no `any` types without justification)
- [ ] SOLID principles followed

### Database Changes (if applicable)
- [ ] Prisma migration created and tested
- [ ] Migration is reversible
- [ ] Seed data updated (if needed)
- [ ] RLS policies updated in Supabase (if needed)

### Security & Performance
- [ ] No secrets or sensitive data exposed
- [ ] Authentication/authorization properly implemented
- [ ] Input validation added for user-facing features
- [ ] Performance impact assessed (no N+1 queries, etc.)
- [ ] Error handling implemented

## 🧪 How to Test
<!-- Describe the testing steps performed -->

1. 
2. 
3. 

## 📸 Screenshots/Videos (if applicable)
<!-- Add screenshots or screen recordings for UI changes -->


## 🔗 Related Issues
<!-- Link related issues using keywords: Closes #123, Fixes #456, Related to #789 -->


## 📚 Documentation
- [ ] Code changes are self-documenting or include comments
- [ ] README updated (if needed)
- [ ] API documentation updated (if endpoints changed)
- [ ] Migration guide provided (for breaking changes)

## 🚀 Deployment Notes
<!-- Any special deployment considerations? -->


## 🤔 Questions/Concerns
<!-- Any uncertainties or items needing review? -->


---

**Reviewer Notes:**
- [ ] Code reviewed for logic errors
- [ ] TypeScript types are appropriate and safe
- [ ] Database queries are optimized
- [ ] Security considerations addressed
- [ ] Error handling is comprehensive
```

## Step 4: Apply the Configuration

```bash
# Navigate to your project
cd /Users/ealanis/Development/current-projects/ready-set

# Make hooks executable (if not already)
chmod +x .husky/pre-commit .husky/pre-push

# Create the PR template directory if it doesn't exist
mkdir -p .github

# Test the hooks work
git add .husky .github
git commit -m "chore: update pre-commit hooks and add PR template"
```

## Step 5: Quick Reference Commands

### Before Committing
```bash
# Run checks manually if you want to verify before committing
pnpm run typecheck          # Type check
pnpm run lint              # Lint
pnpm prisma validate       # Validate schema
pnpm run test:unit         # Unit tests
```

### Before Pushing
```bash
# Run comprehensive checks
pnpm run pre-push-check    # Your existing combined check
pnpm run test:integration  # Integration tests
pnpm run build:no-typecheck # Production build test
```

### Before PR/Deployment
```bash
# Run full deployment validation
pnpm run deploy:pre-checks  # Your comprehensive deployment validation script
pnpm run test:all          # All tests (unit + integration + e2e)
pnpm run test:coverage     # Coverage report
```

### Quick Bypass (Emergency Only)
```bash
# Skip pre-commit checks (use sparingly!)
git commit --no-verify -m "emergency fix"

# Skip pre-push checks (use sparingly!)
git push --no-verify
```

## Step 6: Team Best Practices

### Daily Development Workflow
1. **Pull latest changes**: `git pull origin main`
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Make changes with frequent commits** (hooks will validate each commit)
4. **Before pushing**: Ensure all checks pass
5. **Create PR** using the template
6. **Address review feedback**
7. **Before merging**: Re-run `pnpm run deploy:pre-checks`

### When to Run Different Test Suites

**Every Commit** (via pre-commit):
- TypeScript checks
- Linting
- Prisma validation
- Unit tests

**Every Push** (via pre-push):
- All of the above
- Integration tests
- Build validation

**Before PR** (manual):
- E2E tests: `pnpm run test:e2e`
- Coverage: `pnpm run test:coverage`

**Before Production Deploy** (CI/CD):
- Full test suite: `pnpm run test:all`
- Deployment checks: `pnpm run deploy:pre-checks`

## Step 7: CI/CD Integration (Optional)

Add to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.14.0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm run typecheck
      
      - name: Lint
        run: pnpm run lint
      
      - name: Generate Prisma Client
        run: pnpm prisma generate
      
      - name: Validate Prisma Schema
        run: pnpm prisma validate
      
      - name: Run tests
        run: pnpm run test:ci
      
      - name: Build
        run: pnpm run build
      
      - name: Run E2E tests
        run: pnpm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
        with:
          files: ./coverage/lcov.info
```

## Customization Options

### Adjust Hook Speed
If hooks are too slow:
1. Comment out build checks in pre-commit
2. Move integration tests to manual pre-PR step
3. Run e2e tests only in CI/CD

### Adjust Test Coverage Requirements
Edit `jest.config.js` `coverageThreshold` to match your team's standards.

### Add Custom Validations
You can add project-specific checks like:
- API contract validation
- Accessibility checks
- Bundle size limits
- Security scans

## Troubleshooting

### Hooks not running?
```bash
# Reinstall Husky
pnpm prepare
chmod +x .husky/pre-commit .husky/pre-push
```

### Tests failing in hooks but passing manually?
- Check environment variables are loaded
- Ensure Prisma client is generated
- Run `pnpm install` to sync dependencies

### Need to temporarily disable checks?
```bash
# Disable for one commit
git commit --no-verify -m "message"

# Disable temporarily
mv .husky/pre-commit .husky/pre-commit.bak
# ... do your work ...
mv .husky/pre-commit.bak .husky/pre-commit
```

## Summary

✅ **What This Setup Gives You:**
- Automated TypeScript validation
- Linting enforcement
- Prisma schema validation
- Test suite integration
- Build verification
- Standardized PR process
- Early error detection
- Team consistency

🎯 **Next Steps:**
1. Review and update the hook scripts
2. Create the PR template
3. Test with a sample commit
4. Share with your team
5. Iterate based on feedback

---

**Questions or issues?** Check the scripts at:
- Pre-commit: `.husky/pre-commit`
- Pre-push: `.husky/pre-push`
- Deployment checks: `scripts/deployment/pre-deployment-checks.sh`
