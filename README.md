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

## 🔐 Authentication

This project uses **Supabase Auth** for secure user authentication:

- **Email/Password authentication** with secure password hashing
- **Google OAuth integration** for social login
- **Magic link authentication** for passwordless login
- **Session management** with secure JWT tokens
- **Role-based access control** (CLIENT, ADMIN, SUPER_ADMIN, DRIVER, VENDOR, HELPDESK)
- **Protected routes** with middleware-based authorization

## 🔧 Development

This project follows Next.js and TypeScript best practices with:

- **Strict TypeScript** configuration
- **Supabase authentication** with secure session management
- **Automated testing** with Vitest and Playwright
- **Code quality** with ESLint and Prettier
- **Git hooks** for pre-push validation
- **CI/CD** with GitHub Actions

## 📞 Support

For questions or issues:

1. Check the [documentation](docs/README.md)
2. Review [troubleshooting guides](docs/)
3. Check GitHub issues
4. Contact the development team

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**
