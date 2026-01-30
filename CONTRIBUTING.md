# Contributing to Ready Set

Thank you for contributing to Ready Set! This guide outlines our development workflow, coding standards, and PR process.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Code Review Guidelines](#code-review-guidelines)
- [Critical Patterns to Know](#critical-patterns-to-know)

---

## Getting Started

1. Read the [Getting Started Guide](docs/GETTING_STARTED.md) to set up your environment
2. Read [CLAUDE.md](CLAUDE.md) for architecture overview
3. Read [SOFT_DELETE_PATTERN.md](docs/architecture/SOFT_DELETE_PATTERN.md) before touching user data

---

## Development Workflow

### Before Starting Work

1. Pull the latest `main` branch
2. Create a feature branch from `main`
3. Ensure tests pass: `pnpm pre-push-check`

### While Working

1. Make small, focused commits
2. Run tests frequently
3. Keep your branch up to date with `main`

### Before Creating a PR

```bash
# Run all quality checks
pnpm pre-push-check    # typecheck + lint + prisma validate
pnpm test:ci           # Run all unit tests
```

---

## Branch Naming

Use this format: `<type>/REA-<issue-number>-<short-description>`

### Types

| Type | Use for |
|------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, deps, config |
| `refactor/` | Code refactoring |
| `docs/` | Documentation only |
| `test/` | Test additions/changes |

### Examples

```
feature/REA-123-add-user-profile
fix/REA-456-login-redirect-bug
chore/REA-789-update-dependencies
refactor/REA-101-simplify-auth-flow
docs/REA-202-update-api-docs
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

### Examples

```
feat(auth): add cross-tab session synchronization

fix(soft-delete): filter deleted users from order queries

chore(deps): update prisma to 6.0
```

---

## Pull Request Process

### Golden Rule

**Never merge directly to `main`**. Always create a Pull Request.

### Creating a PR

1. **Push your branch**
   ```bash
   git push origin feature/REA-XXX-description
   ```

2. **Create PR on GitHub**
   - Use the PR template
   - Fill in the description
   - Link the Linear/Plane issue

3. **Ensure CI passes**
   - All checks must be green
   - Fix any failing tests

4. **Request review**
   - Tag appropriate reviewers
   - Be responsive to feedback

5. **Merge after approval**
   - Squash and merge preferred
   - Delete branch after merge

### PR Description Template

```markdown
## Summary
[1-3 bullet points describing the change]

## Test plan
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] E2E tests pass

## Screenshots (if UI change)
[Add screenshots here]

## Linear Issue
[Link to Linear/Plane issue]
```

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Documentation updated (if needed)
- [ ] No secrets or `.env` files committed
- [ ] Soft delete handled correctly (if touching user data)

---

## Testing Requirements

### Before Every PR

```bash
pnpm pre-push-check    # Required - must pass
```

This runs:
- TypeScript validation
- ESLint
- Prisma schema validation

### Test Commands

| Command | Purpose |
|---------|---------|
| `pnpm test` | Run unit tests |
| `pnpm test:unit:watch` | Run tests in watch mode |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:all` | Run all tests |

### Test Guidelines

1. **Write tests for new features**
   - At minimum: happy path test
   - Ideally: edge cases and error states

2. **Test locations**
   - Unit tests: `src/**/__tests__/` or `*.test.ts`
   - E2E tests: `e2e/`

3. **Coverage target**: 70%

---

## Code Review Guidelines

### For Authors

- Keep PRs small and focused (< 400 lines ideal)
- Provide context in the PR description
- Respond to feedback promptly
- Don't take feedback personally

### For Reviewers

Check for:

- [ ] PR description explains the change clearly
- [ ] Tests added/updated appropriately
- [ ] CI passes (all green checks)
- [ ] No `.env` files or secrets committed
- [ ] Follows branch naming: `feature/REA-XXX-*`
- [ ] Soft delete handled if touching user data

### What to Look For

1. **Correctness**: Does the code do what it's supposed to?
2. **Soft delete**: Are deleted users filtered? (See [SOFT_DELETE_PATTERN.md](docs/architecture/SOFT_DELETE_PATTERN.md))
3. **Security**: No hardcoded secrets, proper auth checks
4. **Performance**: No obvious N+1 queries or memory issues
5. **Readability**: Is the code understandable?

---

## Critical Patterns to Know

### Soft Delete Pattern (MUST READ)

Every query involving users or related data **must** filter deleted records:

```typescript
// CORRECT
const users = await prisma.profile.findMany({
  where: { deletedAt: null }
});

// WRONG - will include deleted users!
const users = await prisma.profile.findMany();
```

Read the full guide: [SOFT_DELETE_PATTERN.md](docs/architecture/SOFT_DELETE_PATTERN.md)

### Authentication

Use the `useUser()` hook in components:

```typescript
import { useUser } from '@/contexts/UserContext';

function MyComponent() {
  const { user, userRole, isLoading } = useUser();
  // ...
}
```

Read more: [AUTHENTICATION.md](docs/architecture/AUTHENTICATION.md)

### TypeScript Paths

```typescript
import { something } from '@/lib/something';     // src/lib/
import { Component } from '@/components/...';    // src/components/
```

---

## Getting Help

- **Questions**: Ask in the team Slack channel
- **Architecture questions**: Check [CLAUDE.md](CLAUDE.md)
- **Stuck on a bug**: Pair with a teammate
- **Documentation unclear**: File an issue or improve it!

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
