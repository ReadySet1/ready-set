## 📋 Description
<!-- Provide a clear and concise description of your changes -->


## 🔧 Type of Change
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style/UI update
- [ ] ♻️ Code refactor
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🗄️ Database migration

## 📝 Changes Made
<!-- List the main changes in bullet points -->
- 
- 
- 

## 🧪 Testing Checklist

### Pre-Merge Requirements
- [ ] `pnpm typecheck` passes (no TypeScript errors)
- [ ] `pnpm lint` passes (no ESLint errors)
- [ ] `pnpm prisma validate` passes (if schema changed)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:integration` passes (if applicable)
- [ ] `pnpm test:e2e` passes (for critical user flows)

### Code Quality
- [ ] Branch is up to date with `main`
- [ ] No merge conflicts
- [ ] Code follows project TypeScript/Next.js best practices
- [ ] Complex logic includes JSDoc comments
- [ ] Type safety maintained (no `any` types without justification)
- [ ] SOLID principles followed

### Database Changes (if applicable)
- [ ] Prisma migration created and tested
- [ ] Migration is reversible
- [ ] Seed data updated (if needed)
- [ ] RLS policies updated in Supabase (if needed)

### Security & Performance
- [ ] No secrets or sensitive data exposed
- [ ] Authentication/authorization properly implemented
- [ ] Input validation added for user-facing features
- [ ] Performance impact assessed (no N+1 queries, etc.)
- [ ] Error handling implemented

## 🧪 How to Test
<!-- Describe the testing steps performed -->

1. 
2. 
3. 

## 📸 Screenshots/Videos (if applicable)
<!-- Add screenshots or screen recordings for UI changes -->


## 🔗 Related Issues
<!-- Link related issues using keywords: Closes #123, Fixes #456, Related to #789 -->


## 📚 Documentation
- [ ] Code changes are self-documenting or include comments
- [ ] README updated (if needed)
- [ ] API documentation updated (if endpoints changed)
- [ ] Migration guide provided (for breaking changes)

## 🚀 Deployment Notes
<!-- Any special deployment considerations? -->


## 🤔 Questions/Concerns
<!-- Any uncertainties or items needing review? -->


---

**Reviewer Notes:**
- [ ] Code reviewed for logic errors
- [ ] TypeScript types are appropriate and safe
- [ ] Database queries are optimized
- [ ] Security considerations addressed
- [ ] Error handling is comprehensive
