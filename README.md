# Ready Set - Multi-User Delivery Service Platform

A comprehensive web application for managing delivery services, built with Next.js, PostgreSQL, and Shadcn components.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test
pnpm test:e2e

# Build for production
pnpm build
```

## 📚 Documentation

For comprehensive documentation, setup instructions, and development guides, see:

- **[📖 Full Documentation](docs/README.md)** - Complete project documentation
- **[📋 Documentation Index](docs/DOCUMENTATION_INDEX.md)** - Organized documentation structure
- **[🛠️ Scripts Guide](scripts/README.md)** - Available utility scripts
- **[📊 Project Cleanup Summary](docs/PROJECT_CLEANUP_SUMMARY.md)** - Project organization details

## 🎯 Key Features

- **Multi-user platform** for drivers, vendors, and clients
- **Supabase authentication** with Google OAuth integration
- **CaterValley integration** with automated pricing system
- **Real-time delivery tracking**
- **Professional standards** with HIPAA compliance
- **Modern tech stack** with Next.js, TypeScript, and PostgreSQL
- **Address management** with favorites and recent addresses tracking
- **Secure file uploads** with signed URLs and comprehensive metadata storage
- **Enhanced address selector** with search, filtering, and organization
- **Carrier integrations** with real-time connectivity monitoring and webhook management

## 🚚 Carrier Management

Ready Set includes a comprehensive carrier integration system for managing multiple delivery service providers:

### Features
- **Unified Carrier Service** - Generic carrier service supporting multiple providers (CaterValley, and extensible for future carriers)
- **Real-time Connectivity Monitoring** - Live status checks and latency monitoring for all connected carriers
- **Automated Status Updates** - Webhook-based driver status updates with retry logic and error handling
- **Carrier Dashboard** - Admin interface at `/admin/carriers` for monitoring and managing carrier integrations
- **Detailed Carrier Pages** - Individual carrier details with statistics, configuration, and webhook settings
- **Webhook Logs** - Placeholder interface for tracking webhook delivery and troubleshooting (backend implementation pending)

### Architecture
- **Carrier Service** (`src/lib/services/carrierService.ts`) - Core service for carrier operations
- **Admin API** - RESTful API endpoints for carrier statistics and management
- **Carrier Components** - React components for carrier overview, details, and summary widgets

### Supported Carriers
- **CaterValley** - Full integration with automated order status synchronization
- **Extensible Design** - Easy addition of new carriers through configuration

## 🔄 API Resilience & Monitoring

Ready Set implements comprehensive API resilience patterns to ensure reliable service delivery:

### Circuit Breakers
- **Automatic Failure Detection** - Circuit breakers monitor API health and prevent cascading failures
- **Smart Recovery** - Half-open state testing for gradual service recovery
- **Inactivity Auto-Reset** - Automatic reset after 5 minutes of inactivity
- **Real-time Monitoring** - Live visibility into circuit breaker states via `/api/monitoring/circuit-breakers`

### Monitoring Endpoint
**GET** `/api/monitoring/circuit-breakers`
- Returns comprehensive monitoring data for all circuit breakers
- Supports filtering by name: `/api/monitoring/circuit-breakers?name=CaterValley`
- Provides health status, metrics, and state information

**POST** `/api/monitoring/circuit-breakers`
- Manual circuit breaker reset (for emergency recovery)
- Requires body: `{ "name": "CaterValley" }`

### Features
- **Enhanced Error Messages** - Detailed error responses with retry-after timestamps
- **Comprehensive Metrics** - Track failure rates, state transitions, and request counts
- **Integrated Alerting** - Critical state changes trigger alerts via the alerting system
- **Edge Case Handling** - Robust handling of concurrent operations and race conditions

## 🔐 Security

This project implements comprehensive security measures:

### Authentication
- **Supabase Auth** for secure user authentication
- **Email/Password authentication** with secure password hashing
- **Google OAuth integration** for social login
- **Magic link authentication** for passwordless login
- **Session management** with secure JWT tokens
- **Role-based access control** (CLIENT, ADMIN, SUPER_ADMIN, DRIVER, VENDOR, HELPDESK)
- **Protected routes** with middleware-based authorization

### XSS Prevention
- **DOMPurify sanitization** for all user-generated HTML content
- **Input sanitization utilities** in `src/lib/security/sanitize.ts`
- **Comprehensive test coverage** for XSS attack vectors
- Protection against script injection, event handlers, and malicious URLs

## 🔍 Error Monitoring (Sentry)

Ready Set uses Sentry for comprehensive error tracking and monitoring across the entire application:

### Features
- **Real-time Error Tracking** - Automatic capture of client, server, and edge runtime errors
- **Source Maps** - Readable stack traces with full source code context
- **User Context** - User information attached to every error for easier debugging
- **Breadcrumbs** - Trail of user actions leading up to errors
- **Performance Monitoring** - Track slow API calls and database queries
- **Session Replay** - Visual playback of user sessions where errors occurred
- **Alert Integration** - Slack/email alerts for critical errors

### Setup & Configuration
- **Setup Guide:** [`docs/sentry-setup-guide.md`](docs/sentry-setup-guide.md) - Complete setup instructions
- **Utilities:** `src/lib/monitoring/sentry.ts` - Helper functions for error tracking
- **Test Endpoints:** `/test-sentry` (client) and `/api/test-sentry` (server) - Development testing only

### Environment Variables
```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn        # Public DSN for error reporting
SENTRY_AUTH_TOKEN=your_auth_token             # Build-time token for source maps
SENTRY_ORG=your-org-slug                       # Sentry organization
SENTRY_PROJECT=your-project-name               # Sentry project name
```

See [Sentry Setup Guide](docs/sentry-setup-guide.md) for detailed configuration instructions.

## 🕐 Automated Maintenance (Vercel Cron)

This project uses Vercel Cron Jobs for scheduled maintenance tasks:

### Quarantine Cleanup Cron Job

**Schedule:** Daily at 2 AM UTC (configured in `vercel.json`)
**Endpoint:** `/api/admin/quarantine-cleanup`
**Purpose:** Automatically clean up quarantined files and expired rate limit entries

#### Security Configuration

The cron endpoint is secured using the `CRON_SECRET` environment variable:

1. **Generate a secure secret:**
   ```bash
   # Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # Using OpenSSL
   openssl rand -base64 32
   ```

2. **Configure in Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add variable name: `CRON_SECRET`
   - Set the generated secret as the value
   - Select "Production" environment (and "Preview" if needed)
   - Save changes

3. **Vercel automatically passes this secret** in the `Authorization` header when invoking cron jobs

#### Manual Triggering

Admins can manually trigger cleanup by accessing the endpoint:
- The endpoint accepts both GET and POST requests
- Admin authentication is required when triggered manually
- Returns JSON with cleanup statistics (files cleaned, rate limits cleared, duration)

#### Monitoring

Check Vercel Dashboard → Your Project → Cron Jobs to view:
- Execution history
- Success/failure status
- Execution duration
- Error logs (if any)

For more details, see `src/app/api/admin/quarantine-cleanup/route.ts`

## 🔧 Development

This project follows Next.js and TypeScript best practices with:

- **Strict TypeScript** configuration
- **Supabase authentication** with secure session management
- **Automated testing** with Vitest and Playwright
- **Code quality** with ESLint and Prettier
- **Git hooks** for pre-push validation

## 🚫 CI/CD Status - Workflows Disabled

**As of August 18, 2025, all GitHub Actions workflows have been archived as part of our CI/CD optimization initiative.**

### 📁 Current State
- **GitHub Actions:** All workflows moved to archive
- **CI/CD Process:** Manual deployment process
- **Testing:** Local testing with `pnpm test` and `pnpm test:e2e`
- **Build Process:** Manual build with `pnpm build`

### 🔄 How to Re-enable Workflows
If you need to restore CI/CD functionality:

1. **Quick Re-enable (Individual Workflow):**
   ```bash
   # Copy workflow from archive to active directory
   cp .github/workflows-archive/ci.yml .github/workflows/
   
   # Remove any "if: false" conditions from the workflow file
   # Commit and push changes
   ```

2. **Full Restore (All Workflows):**
   ```bash
   # Restore all workflows at once
   cp -r .github/workflows-archive/*.yml .github/workflows/
   
   # Commit and push changes
   ```

3. **Selective Restore:**
   - Copy specific workflows as needed
   - Configure required secrets and environment variables
   - Each workflow can be re-enabled independently

### 📚 Archive Documentation
- **Archive Location:** `.github/workflows-archive/`
- **Master Plan:** `GITHUB_WORKFLOWS_ARCHIVE_PLAN.md`
- **Detailed Specifications:** `.github/workflows-archive/MANIFEST.md`
- **Re-enabling Guide:** `.github/workflows-archive/README.md`

### 🎯 Why Workflows Were Disabled
- **Resource Optimization:** Reduce GitHub Actions minutes consumption
- **Development Focus:** Prioritize feature development over automated workflows
- **Maintenance Simplification:** Streamline deployment processes
- **Project Transition:** Moving to new CI/CD strategy

### 🚨 Important Notes
- **All workflows are safely preserved** with complete functionality
- **No data or configuration has been lost**
- **Recovery is always possible** using the archive system
- **Secrets and environment variables** are documented for easy reconfiguration

## 📞 Support

For questions or issues:

1. Check the [documentation](docs/README.md)
2. Review [troubleshooting guides](docs/)
3. Check GitHub issues
4. Contact the development team

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**
