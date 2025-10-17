# CI/CD Pipeline Setup Guide

## Overview

This document describes the automated CI/CD pipeline implementation for Ready Set. The pipeline ensures code quality, prevents bugs, and automates deployment.

## Architecture

```
┌─────────────────┐
│  Pull Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│        CI Workflow (ci.yml)         │
├─────────────────────────────────────┤
│  1. Lint & Type Check               │
│  2. Unit Tests (Jest)               │
│  3. E2E Tests (Playwright)          │
│  4. Build Check                     │
│  5. All Checks Pass ✓               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  PR Approved    │
│  & Merged       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     Deploy Workflow (deploy.yml)    │
├─────────────────────────────────────┤
│  1. Re-run CI Checks                │
│  2. Deploy to Environment           │
│     - main → Production             │
│     - development → Development     │
│  3. Post-deployment verification    │
└─────────────────────────────────────┘
```

## Workflows

### 1. CI Workflow (`ci.yml`)

**Purpose:** Ensure code quality and prevent bugs before merging

**Triggers:**
- Pull requests to `main` or `development`
- Pushes to `main` or `development`

**Jobs:**

#### Lint & Type Check
- Runs ESLint for code quality
- Runs TypeScript compiler for type safety
- Fast feedback on code style issues

#### Unit Tests
- Runs all Jest unit tests
- Generates coverage reports
- Enforces 70% coverage threshold
- Uploads coverage artifacts

#### E2E Tests
- Runs Playwright end-to-end tests
- Tests in Chromium browser
- Uploads test reports and screenshots
- 20-minute timeout for comprehensive testing

#### Build Check
- Verifies Next.js builds successfully
- Catches build-time errors early
- Ensures deployment readiness

#### All Checks Pass
- Consolidates all job results
- Required for branch protection
- Single status check for PRs

### 2. Deploy Workflow (`deploy.yml`)

**Purpose:** Automate deployment with quality gates

**Triggers:**
- Pushes to `main` (production deployment)
- Pushes to `development` (development deployment)
- Manual trigger via GitHub UI

**Safety Features:**
- Re-runs all CI checks before deployment
- Only deploys if all tests pass
- Environment-specific deployment
- Post-deployment verification hooks

### 3. Security Workflow (`security.yml`)

**Purpose:** Continuous security monitoring

**Features:**
- CodeQL security analysis
- Dependency review on PRs
- NPM security audit
- Weekly scheduled scans

**Protections:**
- Blocks high/critical vulnerabilities
- Reviews dependency licenses
- Catches security issues early

## Setup Instructions

### 1. Enable GitHub Actions

GitHub Actions should be enabled by default. Verify at:
`Settings → Actions → General → Allow all actions`

### 2. Configure Branch Protection

#### For `main` branch:

1. Go to `Settings → Branches → Add branch protection rule`
2. Branch name pattern: `main`
3. Enable these protections:

   **Required Status Checks:**
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select these checks:
     - `Lint & Type Check`
     - `Unit Tests`
     - `E2E Tests`
     - `Build Check`
     - `All Checks Pass`

   **Pull Request Requirements:**
   - ✅ Require pull request before merging
   - ✅ Require approvals: 1
   - ✅ Dismiss stale pull request approvals when new commits are pushed

   **Additional Protections:**
   - ✅ Require conversation resolution before merging
   - ✅ Require linear history (optional, recommended)
   - ✅ Do not allow bypassing the above settings

4. Click "Create" or "Save changes"

#### For `development` branch:

Follow the same steps as `main` branch.

### 3. Configure Code Owners

Code owners are already configured in `.github/CODEOWNERS`.

**Automatic Reviews:**
- Workflow changes → DevOps team
- Database migrations → Lead developers
- Critical API routes → Security reviewers

**Update CODEOWNERS:**
Replace `@ready-set-llc` with actual GitHub usernames or team names.

### 4. Set Up Environments

#### Production Environment:

1. Go to `Settings → Environments → New environment`
2. Name: `production`
3. Configure:
   - ✅ Required reviewers: Add production approvers
   - ✅ Wait timer: 0 minutes (or add delay if needed)
   - ✅ Deployment branches: Only `main`

#### Development Environment:

1. Create another environment named `development`
2. Configure:
   - ✅ Deployment branches: Only `development`
   - No required reviewers needed for dev

### 5. Configure Secrets (Optional)

If using Vercel CLI for deployment:

1. Go to `Settings → Secrets and variables → Actions`
2. Add these secrets:
   - `VERCEL_TOKEN` - Your Vercel API token
   - `VERCEL_ORG_ID` - Your Vercel organization ID
   - `VERCEL_PROJECT_ID` - Your Vercel project ID

**Note:** If using Vercel's Git integration, these secrets are not needed.

## Usage

### Creating a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/REA-XXX-description
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push to GitHub:
   ```bash
   git push origin feature/REA-XXX-description
   ```

4. Create PR via GitHub UI

5. **Automatic CI checks will run:**
   - Wait for all checks to complete (10-15 minutes)
   - Fix any failures
   - Request review when all checks pass

6. **After approval and passing checks:**
   - Merge the PR
   - Automatic deployment will begin

### Viewing Test Results

**In GitHub UI:**
- Go to PR → "Checks" tab
- Click on any job to see detailed logs
- Download artifacts for coverage/test reports

**Coverage Reports:**
1. Go to failed/completed workflow
2. Scroll to "Artifacts" section
3. Download `coverage-report`
4. Open `index.html` in browser

**Playwright Reports:**
1. Download `playwright-report` artifact
2. Extract and open `index.html`
3. View test traces and screenshots

### Running Checks Locally

Before pushing, run the same checks locally:

```bash
# Run all checks
pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build

# Or individually:
pnpm lint              # ESLint
pnpm typecheck         # TypeScript
pnpm test:ci           # Unit tests with coverage
pnpm test:e2e          # E2E tests
pnpm build             # Build check
```

### Debugging Failed Checks

#### Lint Failures
```bash
# Auto-fix most issues
pnpm lint --fix

# Check specific files
pnpm eslint src/path/to/file.ts
```

#### Type Check Failures
```bash
# Get detailed errors
pnpm typecheck

# Check specific file
pnpm tsc --noEmit src/path/to/file.ts
```

#### Test Failures
```bash
# Run specific test
pnpm test src/__tests__/specific.test.ts

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:unit:watch
```

#### E2E Test Failures
```bash
# Run with UI
pnpm test:e2e:ui

# Run in headed mode
pnpm test:e2e:headed

# Run specific test
pnpm exec playwright test e2e/specific.spec.ts
```

#### Build Failures
```bash
# Check build
pnpm build

# Build without type checking
pnpm build:no-typecheck
```

## Maintenance

### Updating Workflows

1. Edit workflow files in `.github/workflows/`
2. Test changes in a PR first
3. Never edit directly on `main` branch

### Monitoring

**GitHub Actions Dashboard:**
- Go to "Actions" tab in repository
- View all workflow runs
- Download logs and artifacts

**Success Metrics:**
- CI pass rate: Target >95%
- Average CI duration: 10-15 minutes
- Deployment success rate: Target 100%

**Alerts:**
- Failed deployments
- Security vulnerabilities
- Coverage drops

### Troubleshooting

**Workflow not running:**
1. Check workflow triggers in YAML
2. Verify Actions are enabled
3. Check branch protection rules

**Deployment not working:**
1. Verify all CI checks passed
2. Check environment configuration
3. Review Vercel integration settings

**Tests timing out:**
1. Increase timeout in workflow
2. Optimize slow tests
3. Check for network issues

## Security Considerations

1. **Secrets Management:**
   - Never commit secrets to repository
   - Use GitHub Secrets for sensitive data
   - Rotate secrets regularly

2. **Branch Protection:**
   - Enforce required status checks
   - Require code reviews
   - No force pushes to protected branches

3. **Dependency Security:**
   - Dependabot auto-updates enabled
   - Weekly security scans
   - Audit on every PR

4. **Code Owners:**
   - Critical files require specific approvals
   - Security-sensitive changes reviewed carefully

## Performance Optimization

**Caching:**
- pnpm dependencies cached automatically
- Playwright browsers cached
- Prisma client cached

**Parallelization:**
- Jobs run in parallel when possible
- Matrix builds for multiple configs

**Optimization Tips:**
- Keep workflows focused and fast
- Use fail-fast where appropriate
- Cache aggressively

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**
   - Add Percy or Chromatic integration
   - Catch UI bugs automatically

2. **Performance Testing**
   - Add Lighthouse CI
   - Track Core Web Vitals
   - Performance budgets

3. **Semantic Versioning**
   - Automated changelog generation
   - Semantic release automation
   - Version bumping

4. **Preview Deployments**
   - Deploy PR previews automatically
   - Share preview URLs in comments

5. **Advanced Security**
   - SAST scanning (Snyk)
   - Container scanning
   - License compliance checks

6. **Monitoring Integration**
   - Sentry error tracking
   - DataDog APM
   - Real user monitoring

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Contact DevOps team
4. Create issue in Plane (REA-XXX)

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright Documentation](https://playwright.dev)
- [Jest Documentation](https://jestjs.io)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Last Updated:** October 16, 2025
**Version:** 1.0.0
**Maintained by:** Ready Set DevOps Team
