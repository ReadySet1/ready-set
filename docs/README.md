# Multi-User Delivery Service Platform

A comprehensive web application for managing delivery services, built with Next.js, PostgreSQL, and Shadcn components.

## Overview

This platform allows users to register as drivers, vendors, and clients, facilitating a seamless delivery service experience. It's designed to handle user management using PostgreSQL, with a modern and responsive frontend powered by Next.js and Shadcn components.

## Features

### User Registration and Management

- Multiple user types: Drivers, Vendors, and Clients
- Secure authentication and authorization

### Fast and Reliable Delivery Solutions

- Same-day delivery
- On-demand services
- Emergency last-minute deliveries

### On-the-Go Courier Assistance

- Quick pickup and delivery
- Experienced and trained couriers

### Catering Delivery & Setup

- Event planning assistance
- Food transport and presentation services
- **CaterValley Discount System**: Automated tiered pricing based on head count and food cost

### Versatile Delivery Options

- Handling various items beyond food (documents, medical supplies, etc.)
- Ensuring safe and timely deliveries

### Priority Handling for Urgent Requests

- Rapid response to time-sensitive deliveries

### Professional Standards

- Comprehensive driver training programs
- HIPAA compliance
- Food Handlers Certification (California standards)
- Strict dress code and safety protocols

## Technical Stack

- **Frontend**: Next.js
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: Shadcn
- **Pricing Engine**: CaterValley Discount System with tiered pricing

## CaterValley Discount System

The platform includes an advanced discount system for catering orders with automated pricing calculation based on:

- **5-tier pricing structure** covering different head count and food cost ranges
- **Fixed pricing** for smaller orders (1-99 heads)
- **Percentage-based pricing** for large orders (100+ heads)
- **Tip-aware pricing** with different rates for orders with and without tips
- **Real-time calculation** with debounced API calls for optimal performance

See [`CATERVALLEY_DISCOUNT_SYSTEM.md`](CATERVALLEY_DISCOUNT_SYSTEM.md) for complete documentation.

## Getting Started

[Include installation and setup instructions here]

## Documentation

[Link to or include basic documentation about how to use the platform]

## Blog

Stay updated with our latest news and valuable information about our services through our blog section.

## Contributing

[Include information about how others can contribute to the project, if applicable]

## License

[Specify the license under which your project is released]

## Contact

[Provide contact information or links for support and inquiries]

## Build and Deployment Process

This project includes several safeguards to prevent build errors during deployment:

### Local Development Checks

Before pushing your changes to GitHub, you can run these commands to catch potential issues early:

```bash
# Run a full build check - simulates Vercel environment
pnpm check-build

# Run just the type checker
pnpm typecheck

# Run linting
pnpm lint
```

### Git Hooks

The project uses Husky to enforce pre-push checks:

- **Pre-push hook**: Automatically runs type checking, Prisma generation, and linting before allowing you to push to GitHub

### GitHub Actions

A GitHub Actions workflow runs on every push and pull request to ensure the build will succeed:

- Runs on Ubuntu with Node.js 20
- Uses PNPM with caching for faster builds
- Performs TypeScript type checking
- Runs a full build with the same environment variables as Vercel

### Best Practices to Avoid Build Errors

1. **Strict TypeScript checking**: The project is configured with strict TypeScript settings to catch type errors early

2. **Version pinning**: All dependencies, especially Prisma, have their versions pinned to avoid inconsistencies

3. **Import statements**: Always use explicit imports for types rather than namespace access:

   ```typescript
   // ❌ Avoid this:
   if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }

   // ✅ Use this instead:
   import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
   if (error instanceof PrismaClientKnownRequestError) { ... }
   ```

4. **Run checks locally**: Always run `pnpm check-build` before pushing to GitHub to verify your changes will build successfully on Vercel
