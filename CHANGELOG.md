# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Testing Infrastructure (REA-176, REA-177)**: Comprehensive testing improvements in Phase 5A
  - Enhanced Jest setup with complete Supabase client mocking
  - Browser API polyfills for File, Blob, FormData, ReadableStream
  - Next.js navigation hooks mocking
  - React-Hot-Toast mocking
  - Improved test coverage for modal components
  - New visual regression tests with Playwright (`e2e/visual-regression.spec.ts`)

- **Brand Color System (REA-137)**: New amber color palette
  - Created `src/styles/brand-colors.ts` with comprehensive color definitions
  - Updated Tailwind configuration with new color tokens

- **Database**: New `delivery_configurations` table migration
  - Supports client-specific pricing tiers and mileage rates
  - Includes daily drive discounts and bridge toll settings
  - JSONB fields for flexible pricing configurations

- **Testing Documentation**:
  - `TESTING_PROGRESS.md` - Detailed testing improvement tracking
  - `TEST_FAILURE_REPORT.md` - Categorized failure analysis
  - `PROGRESS_REVIEW.md` - Executive summary and metrics

### Changed
- **Apply Page (REA-190)**: Changed 'Amazing' text from orange gradient to black
- **Catering Services Modal**: Updated modal text and added comprehensive tests
- **Console Logging**: Replaced debug console statements with Sentry monitoring
  - `src/lib/calculator/delivery-cost-calculator.ts` - Uses `captureMessage` for manual review logging
  - `src/app/api/job-applications/route.ts` - Cleaned up debug prefixes from error logs

### Fixed
- **TypeScript**: Improved type safety in `src/lib/auth.ts`
  - Added `OAuthMetadata` interface for OAuth user metadata
  - Replaced `any` types with proper Supabase error types (`AuthError`, `PostgrestError`)

### Removed
- **Promotional Banners (REA-193)**: Permanently removed promotional banner components and tests from all pages

### Security
- No critical or high severity vulnerabilities (moderate vulnerabilities exist in dependencies)

## Test Status

**Current Pass Rate**: 80.8% (3372/4206 tests passing)
- Unit tests are informational in CI (not blocking)
- TypeScript and ESLint checks are blocking

**Note**: Test infrastructure improvements are ongoing. Many test failures are related to mock configuration issues being addressed in subsequent phases.
