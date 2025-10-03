# Pre-Production Deployment Checklist

**Project:** Ready Set - Preview Development → Main Merge
**Date:** 2025-10-03
**Environment:** Dev (`khvteminrbghoeuqajzm`) → Prod (`jiasmmmmhtreoacdpiby`)

---

## ⚠️ CRITICAL PRE-FLIGHT CHECKS

### Database State Assessment
- [ ] **REVIEWED** SCHEMA_COMPARISON.md - Understand all differences
- [ ] **CONFIRMED** Divergent migration histories are acknowledged
- [ ] **STAKEHOLDER APPROVAL** obtained for deployment strategy
- [ ] **MAINTENANCE WINDOW** scheduled with affected users notified
- [ ] **ROLLBACK TEAM** identified and on standby

---

## 📊 Code Review

### TypeScript Compilation
- [ ] Run `npm run build` or `pnpm build` - **NO ERRORS**
- [ ] Check `tsconfig.json` - strict mode enabled
- [ ] Review any `@ts-ignore` or `@ts-expect-error` comments
- [ ] Verify no `any` types in critical paths
- [ ] Check for unused imports/variables

### Testing
- [ ] **Unit tests** passing: `npm test` ✅
- [ ] **Integration tests** passing ✅
- [ ] **E2E tests** passing (Playwright/Cypress) ✅
- [ ] **Visual regression** tests reviewed ✅
- [ ] **Load testing** completed (if applicable)
- [ ] Test coverage > 70% on critical paths

### Code Quality
- [ ] No `console.log()` or debug statements in production code
- [ ] No commented-out code blocks
- [ ] ESLint/Prettier checks passing
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Environment variables properly documented

### API & Error Handling
- [ ] All API routes have try-catch blocks
- [ ] Error responses follow consistent structure
- [ ] Sensitive data not exposed in error messages
- [ ] Logging configured for production (no PII logged)
- [ ] Rate limiting enabled on auth/sensitive endpoints

---

## 🔒 Security Checklist

### Row Level Security (RLS)
- [ ] **RLS ENABLED** on `accounts` table
- [ ] **RLS ENABLED** on `sessions` table
- [ ] **RLS ENABLED** on `addresses` table
- [ ] **RLS ENABLED** on `catering_requests` table
- [ ] **RLS ENABLED** on `dispatches` table
- [ ] **RLS ENABLED** on `file_uploads` table
- [ ] **RLS ENABLED** on `on_demand_requests` table
- [ ] **RLS ENABLED** on `user_addresses` table
- [ ] **RLS ENABLED** on `verification_tokens` table
- [ ] **RLS ENABLED** on `form_submissions` table
- [ ] **RLS ENABLED** on `lead_captures` table
- [ ] **RLS ENABLED** on `job_applications` table
- [ ] **RLS ENABLED** on `pricing_tiers` table
- [ ] **RLS ENABLED** on `calculator_templates` table
- [ ] **RLS ENABLED** on `pricing_rules` table
- [ ] **RLS ENABLED** on `client_configurations` table
- [ ] **RLS ENABLED** on `calculation_history` table
- [ ] **RLS ENABLED** on `testimonials` table (if deployed)
- [ ] **RLS ENABLED** on `drivers` table (prod)
- [ ] **RLS ENABLED** on `driver_locations` table (prod)
- [ ] **RLS ENABLED** on `driver_shifts` table (prod)
- [ ] **RLS ENABLED** on `shift_breaks` table (prod)
- [ ] **RLS ENABLED** on `deliveries` table (prod)

### RLS Policy Review
- [ ] All policies tested with actual user accounts
- [ ] Admin policies don't bypass security
- [ ] Service role policies documented and minimal
- [ ] No infinite recursion in policy checks
- [ ] Optimized with `(SELECT auth.uid())` pattern

### Authentication
- [ ] **Password strength requirements** enforced
- [ ] **Leaked password protection ENABLED** in Supabase Auth
- [ ] **MFA/2FA** configured (if required)
- [ ] **Email OTP expiry** set to < 1 hour
- [ ] **Session timeout** configured appropriately
- [ ] **Password reset flow** tested
- [ ] **Email verification** required for sensitive actions

### Authorization
- [ ] User roles properly defined (VENDOR, CLIENT, DRIVER, ADMIN, etc.)
- [ ] Role-based access control (RBAC) implemented
- [ ] API endpoints check user permissions
- [ ] Frontend routes protected by auth guards
- [ ] No privilege escalation vulnerabilities

### Data Protection
- [ ] **NO hardcoded credentials** in code or config files
- [ ] **Secrets in environment variables** only
- [ ] **API keys rotated** (if needed for this deployment)
- [ ] **Database encryption at rest** verified
- [ ] **TLS/SSL enforced** for all connections
- [ ] **SQL injection** vulnerabilities checked
- [ ] **XSS protection** implemented
- [ ] **CSRF tokens** on state-changing requests

### CORS & Headers
- [ ] **CORS settings** configured correctly for production domain
- [ ] **Content-Security-Policy** header set
- [ ] **X-Frame-Options** header set
- [ ] **X-Content-Type-Options** header set
- [ ] **Referrer-Policy** configured

---

## 🗄️ Database Checklist

### Schema Validation
- [ ] All migrations tested in **staging environment first**
- [ ] **Backup created** before any schema changes
- [ ] **Rollback migration** scripts prepared
- [ ] No data loss in migration preview
- [ ] Foreign key constraints validated

### RLS Policies (Detailed)
- [ ] Each table has minimum 3 policies (SELECT, INSERT, UPDATE)
- [ ] DELETE policies reviewed for data retention requirements
- [ ] Policies don't allow unauthorized data access
- [ ] Performance tested with RLS enabled
- [ ] No `auth.uid()` re-evaluation issues (use `SELECT` wrapper)

### Indexes & Performance
- [ ] **Foreign key indexes added** for:
  - `catering_requests.pickupAddressId`
  - `dispatches.userId`
  - `calculation_history.client_config_id` (prod)
  - `job_applications.profileId` (prod)
  - `on_demand_requests.deliveryAddressId` (prod)
  - `on_demand_requests.pickupAddressId` (prod)
- [ ] **Unused indexes removed** (30+ candidates identified)
- [ ] Query performance tested on production-size data
- [ ] No N+1 query issues
- [ ] Database connection pool limits set

### Functions & Triggers
- [ ] `update_updated_at_column()` function deployed (if missing)
- [ ] Triggers added for timestamp management (if needed)
- [ ] Function `search_path` security issue fixed
- [ ] All custom functions have error handling

### Extensions
- [ ] **PostGIS decision made**: add to dev OR keep prod-only
- [ ] **PostGIS moved out of public schema** (if keeping)
- [ ] All required extensions enabled
- [ ] Extension versions compatible

### Data Migration
- [ ] **No data migration needed** ✓ (or)
- [ ] Data migration script tested in staging
- [ ] Data transformation validated
- [ ] No data duplication or loss
- [ ] Referential integrity maintained

---

## ⚡ Performance Checklist

### Build Optimization
- [ ] **Next.js production build** completes successfully
- [ ] **Bundle size** analyzed and optimized
- [ ] **Code splitting** implemented
- [ ] **Lazy loading** for heavy components
- [ ] **Tree shaking** verified
- [ ] **Source maps** disabled or external for production
- [ ] Build artifacts under version control exclusion

### Asset Optimization
- [ ] **Images optimized** (WebP, compression, responsive)
- [ ] **Fonts optimized** (subset, woff2 format)
- [ ] **SVGs minified**
- [ ] **Static assets** use CDN (if applicable)
- [ ] **Cache headers** configured correctly

### Database Performance
- [ ] **Connection pooling** configured (Supabase handles this)
- [ ] **Query timeouts** set appropriately
- [ ] **Slow query logging** enabled
- [ ] **Database vacuum** scheduled (if needed)
- [ ] No missing indexes on filtered/joined columns

### Application Performance
- [ ] **API response times** < 500ms (p95)
- [ ] **Page load times** < 3s (FCP)
- [ ] **LCP** < 2.5s
- [ ] **CLS** < 0.1
- [ ] **FID/INP** < 100ms

### Caching
- [ ] **React Query / SWR** caching configured
- [ ] **API responses** have appropriate cache headers
- [ ] **Static assets** cached with long TTL
- [ ] **Service workers** configured (if using PWA)
- [ ] **CDN caching** rules set

---

## 🔍 Monitoring & Observability

### Error Tracking
- [ ] **Sentry** (or similar) configured and tested
- [ ] **Source maps uploaded** for better error traces
- [ ] **User context** attached to errors
- [ ] **Alert rules** configured for critical errors
- [ ] **Error budget** defined

### Analytics
- [ ] **Google Analytics** or alternative configured
- [ ] **Custom events** tracked for key user actions
- [ ] **Funnel tracking** implemented
- [ ] **Privacy compliance** (GDPR, CCPA) verified
- [ ] **Cookie consent** implemented (if required)

### Performance Monitoring
- [ ] **Core Web Vitals** tracking enabled
- [ ] **Real User Monitoring (RUM)** configured
- [ ] **Synthetic monitoring** set up for critical paths
- [ ] **Uptime monitoring** (Pingdom, UptimeRobot, etc.)
- [ ] **SSL certificate expiry** monitoring

### Database Monitoring
- [ ] **Supabase Dashboard** alerts configured
- [ ] **Connection pool** monitoring
- [ ] **Slow query** alerts set
- [ ] **Disk space** alerts configured
- [ ] **Backup success/failure** notifications

---

## 🌍 Environment & Configuration

### Environment Variables
- [ ] **All required env vars** documented in `.env.example`
- [ ] **Production env vars** set in Vercel/hosting platform
- [ ] **Database URLs** correct for production
- [ ] **API keys** for production services set
- [ ] **Feature flags** configured
- [ ] **No `.env.local`** committed to repo

### Vercel/Hosting Configuration
- [ ] **Production domain** configured
- [ ] **SSL certificate** valid
- [ ] **Environment variables** set correctly
- [ ] **Build settings** optimized
- [ ] **Deployment regions** configured
- [ ] **Preview deployments** working

### Third-Party Services
- [ ] **Supabase project** verified (prod vs dev)
- [ ] **Email service** configured (SendGrid, AWS SES, etc.)
- [ ] **File storage** configured (Supabase Storage, S3, etc.)
- [ ] **Payment gateway** in production mode (if applicable)
- [ ] **SMS/notification service** configured
- [ ] **API rate limits** reviewed

---

## 📱 Frontend Checklist

### Compatibility
- [ ] **Cross-browser tested** (Chrome, Firefox, Safari, Edge)
- [ ] **Mobile responsive** (iOS Safari, Chrome Mobile)
- [ ] **Accessibility (a11y)** tested (WCAG 2.1 AA minimum)
- [ ] **Keyboard navigation** works
- [ ] **Screen reader** compatible

### User Experience
- [ ] **Loading states** for all async operations
- [ ] **Error boundaries** implemented
- [ ] **Offline handling** (if PWA)
- [ ] **Form validation** with clear error messages
- [ ] **Empty states** designed
- [ ] **Success/error toast messages** implemented

### SEO (if applicable)
- [ ] **Meta tags** configured
- [ ] **Open Graph** tags set
- [ ] **Twitter Card** tags set
- [ ] **Sitemap** generated
- [ ] **robots.txt** configured
- [ ] **Canonical URLs** set

---

## 🔄 Deployment Process

### Pre-Deployment
- [ ] **Code freeze** announced to team
- [ ] **Staging environment** matches production state
- [ ] **All PRs merged** to `preview-development` branch
- [ ] **Final smoke test** in staging passed
- [ ] **Database backup** created (documented in BACKUP_PROCEDURES.md)
- [ ] **Rollback plan** reviewed and ready

### Deployment Steps
- [ ] **Create PR**: `preview-development` → `main`
- [ ] **Code review** completed and approved
- [ ] **CI/CD pipeline** passing (tests, lint, build)
- [ ] **Merge to main** (triggers production deployment)
- [ ] **Monitor deployment** logs for errors
- [ ] **Verify deployment** completes successfully

### Post-Deployment Verification
- [ ] **Application loads** without errors
- [ ] **Authentication works** (login/signup/logout)
- [ ] **Critical user flows** tested:
  - [ ] User registration (CLIENT, VENDOR, DRIVER)
  - [ ] Catering request creation
  - [ ] On-demand request creation
  - [ ] File upload functionality
  - [ ] Calculator functionality
  - [ ] Form submissions
  - [ ] Job applications
- [ ] **Database queries** responding normally
- [ ] **API endpoints** returning expected responses
- [ ] **No console errors** in browser
- [ ] **No error spikes** in monitoring

### Communication
- [ ] **Deployment completed** announced to team
- [ ] **Users notified** (if downtime occurred)
- [ ] **Documentation updated** with any changes
- [ ] **Changelog** updated

---

## 🚨 Rollback Criteria

Initiate rollback immediately if:
- [ ] **Critical errors** spike > 5% error rate
- [ ] **Database corruption** or data loss detected
- [ ] **Authentication broken** - users can't log in
- [ ] **Payment processing fails** (if applicable)
- [ ] **Performance degradation** > 50% increase in response times
- [ ] **Security vulnerability** discovered

---

## ✅ Final Approval

### Sign-Offs Required
- [ ] **Engineering Lead** - Code quality approved
- [ ] **DevOps/Platform** - Infrastructure ready
- [ ] **Security** - Security review complete
- [ ] **Product Owner** - Feature completeness verified
- [ ] **QA** - Testing complete, no blockers

### Deployment Authorization
- [ ] **Maintenance window** confirmed
- [ ] **Rollback plan** tested and ready
- [ ] **Team on standby** for monitoring
- [ ] **Stakeholders notified** of deployment time

---

## 📋 Post-Deployment Tasks (After Success)

- [ ] Monitor for 1 hour post-deployment
- [ ] Update internal documentation
- [ ] Create post-mortem if issues occurred
- [ ] Schedule review of deployment process
- [ ] Archive deployment logs and metrics
- [ ] Clean up feature flags (if any)
- [ ] Update team on lessons learned

---

**Last Updated:** 2025-10-03
**Checklist Version:** 1.0
