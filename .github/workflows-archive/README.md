# 📁 GitHub Workflows Archive

## 📋 Overview

This directory contains archived GitHub Actions workflows that were temporarily disabled as part of the project's CI/CD optimization initiative.

## 🎯 Why Workflows Were Disabled

- **Project Transition:** Moving to a new CI/CD strategy
- **Resource Optimization:** Reducing GitHub Actions minutes consumption
- **Maintenance Simplification:** Streamlining deployment processes
- **Development Focus:** Prioritizing feature development over automated workflows

## 📅 Archive Information

- **Archive Date:** August 18, 2025
- **Archive Time:** 14:50:58
- **Archive Reason:** Master Plan - Complete GitHub Workflows Disable & Archive
- **Backup Location:** `backups/github-workflows-20250818-145058/`

## 🔄 Re-enabling Workflows

To re-enable any workflow:

1. Copy the desired workflow file from this archive to `.github/workflows/`
2. Remove any `if: false` conditions from the workflow file
3. Ensure required secrets and environment variables are configured
4. Commit and push the changes

## 📁 Archived Workflows

### 1. `ci.yml` - Continuous Integration

- **Purpose:** Automated testing, linting, and security auditing
- **Triggers:** Push to main/master/feature/\*, PR to main/master
- **Jobs:** Test & Lint, Security Audit
- **Status:** Disabled with `if: false`
- **Re-enable:** Remove `if: false` from both jobs

### 2. `codeql.yml` - CodeQL Security Scanning

- **Purpose:** Automated security vulnerability scanning
- **Triggers:** Push to main/master, PR to main/master, weekly schedule
- **Jobs:** CodeQL Analysis
- **Status:** Disabled with `if: false`
- **Re-enable:** Remove `if: false` from analyze job

### 3. `deploy-production.yml` - Production Deployment

- **Purpose:** Automated production deployment pipeline
- **Triggers:** Push to main, workflow_dispatch
- **Jobs:** 6 deployment stages including validation, approval, and rollback
- **Status:** Disabled with `if: false`
- **Re-enable:** Remove `if: false` from all jobs

### 4. `test.yml` - Test Suite

- **Purpose:** Comprehensive testing including unit, E2E, and integration tests
- **Triggers:** Push to main/preview-development, PR to main/preview-development
- **Jobs:** Test Matrix, E2E Tests, Integration Tests
- **Status:** Disabled with `if: false`
- **Re-enable:** Remove `if: false` from all jobs

### 5. `deploy-staging.yml` - Staging Deployment

- **Purpose:** Automated staging environment deployment
- **Triggers:** Push to preview-development, workflow_dispatch
- **Jobs:** 5 deployment stages including health checks and notifications
- **Status:** Disabled with `if: false`
- **Re-enable:** Remove `if: false` from all jobs

## 🔐 Required Secrets & Environment Variables

### Production Deployment (`deploy-production.yml`)

- `PROD_DATABASE_URL`
- `PROD_DIRECT_URL`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`
- `PROD_NEXTAUTH_SECRET`
- `GITHUB_TOKEN`

### Staging Deployment (`deploy-staging.yml`)

- `STAGING_DATABASE_URL`
- `STAGING_DIRECT_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_NEXTAUTH_SECRET`
- `GITHUB_TOKEN`

### Testing & CI (`ci.yml`, `test.yml`)

- `DATABASE_URL` (test environment)
- `DIRECT_URL` (test environment)
- `NEXT_PUBLIC_SUPABASE_URL` (test)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (test)
- `NEXTAUTH_SECRET` (test)
- `CODECOV_TOKEN` (for test.yml coverage reporting)

## 🚨 Important Notes

- **All workflows are safely backed up** in the `backups/` directory
- **No data or configuration has been lost**
- **Workflows can be re-enabled individually** as needed
- **Original functionality is preserved** in the archived files
- **Secrets and environment variables** must be reconfigured when re-enabling

## 📚 Related Documentation

- **Master Plan:** `GITHUB_WORKFLOWS_ARCHIVE_PLAN.md`
- **Phase 1 Assessment:** `backups/github-workflows-20250818-145058/PHASE1_ASSESSMENT.md`
- **Backup Location:** `backups/github-workflows-20250818-145058/`

---

**Archive Created:** August 18, 2025  
**Archive Status:** ✅ COMPLETED  
**Next Phase:** Phase 3 - Documentation & Cleanup
