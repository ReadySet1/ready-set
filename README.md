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
