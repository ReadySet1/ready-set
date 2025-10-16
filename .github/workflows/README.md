# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Pull requests to `main` or `development` branches
- Pushes to `main` or `development` branches

**Jobs:**

1. **Lint & Type Check**
   - Runs ESLint to check code quality
   - Runs TypeScript type checking
   - Ensures code meets style guidelines

2. **Unit Tests**
   - Runs Jest unit tests with coverage
   - Uploads coverage reports
   - Checks coverage thresholds (70%)
   - Generates Prisma Client for database types

3. **E2E Tests**
   - Runs Playwright end-to-end tests
   - Tests in Chromium browser
   - Uploads test reports and screenshots
   - Timeout: 20 minutes

4. **Build Check**
   - Verifies Next.js application builds successfully
   - Ensures no build-time errors
   - Checks build artifacts

5. **All Checks Pass**
   - Consolidates all job results
   - Fails if any job fails
   - Used for branch protection rules

### 2. Deploy Workflow (`deploy.yml`)

**Triggers:**
- Pushes to `main` branch (production)
- Pushes to `development` branch (development)
- Manual trigger via workflow_dispatch

**Jobs:**

1. **CI Checks**
   - Re-runs all CI checks before deployment
   - Ensures code quality before deployment

2. **Deploy to Production**
   - Only runs for `main` branch
   - Requires all CI checks to pass
   - Deploys via Vercel Git integration
   - Includes post-deployment verification

3. **Deploy to Development**
   - Only runs for `development` branch
   - Requires all CI checks to pass
   - Deploys to development environment

## Branch Protection Rules

To fully implement the CI/CD pipeline, configure the following branch protection rules:

### Main Branch

1. **Require pull request before merging**
   - Require approvals: 1
   - Dismiss stale reviews when new commits are pushed

2. **Require status checks to pass**
   - Require branches to be up to date
   - Required checks:
     - `Lint & Type Check`
     - `Unit Tests`
     - `E2E Tests`
     - `Build Check`
     - `All Checks Pass`

3. **Require conversation resolution before merging**

4. **Require linear history** (optional)

5. **Do not allow bypassing the above settings**

### Development Branch

Apply similar rules but with slightly relaxed requirements:
- Required approvals: 1 (can be same as main)
- Same status checks as main

## Environment Variables

### Required for CI

All test environment variables are configured in `jest.setup.ts`. No additional secrets needed for CI.

### Required for Deployment

Configure these as GitHub Secrets:
- `VERCEL_TOKEN` - Vercel deployment token (if using Vercel CLI)
- Production environment variables (handled by Vercel)

## Local Testing

Run the same checks locally before pushing:

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Unit tests
pnpm test:ci

# E2E tests
pnpm test:e2e

# Build check
pnpm build
```

## Troubleshooting

### E2E Tests Failing

1. Check Playwright browser installation:
   ```bash
   pnpm exec playwright install chromium
   ```

2. Run tests locally with UI mode:
   ```bash
   pnpm test:e2e:ui
   ```

### Coverage Below Threshold

1. Check coverage report:
   ```bash
   pnpm test:coverage
   ```

2. View detailed HTML report:
   ```bash
   open coverage/lcov-report/index.html
   ```

### Build Failures

1. Check build locally:
   ```bash
   pnpm build
   ```

2. Check for TypeScript errors:
   ```bash
   pnpm typecheck
   ```

## Monitoring

- **Test Results:** View in GitHub Actions logs
- **Coverage Reports:** Download from workflow artifacts
- **Playwright Reports:** Download from workflow artifacts
- **Deployment Status:** Check Vercel dashboard

## Performance

- **Average CI Time:** ~10-15 minutes
- **Caching:** pnpm dependencies cached
- **Parallelization:** Jobs run in parallel when possible

## Future Enhancements

- [ ] Add security scanning (Snyk, GitHub CodeQL)
- [ ] Add performance testing
- [ ] Add visual regression testing
- [ ] Add deployment previews for PRs
- [ ] Add automated changelog generation
- [ ] Add semantic release automation
