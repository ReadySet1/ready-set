# Fix for ESLint warning in CreateCateringOrderForm.tsx

The ESLint warning at line 915:6 is about missing dependencies in a useEffect hook. 

The useEffect in question is designed to only run on mount, which is why it has an empty dependency array. The code comment explicitly states this intention.

To fix this, we have two options:

1. Add the missing dependencies (`form` and `generalError`), which would change the behavior of the effect
2. Add an eslint-disable comment to preserve the intended behavior

Since the comment explicitly states "only run on mount", the intended behavior is to keep the empty dependency array. Therefore, the fix would be to add an eslint-disable comment:

```typescript
// Clear form state only on mount, not on every form change
useEffect(() => {
  // Only clear errors on mount, not on every form change
  if (generalError === null) {
    form.clearErrors();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Empty dependency array - only run on mount
```

This preserves the intended behavior while addressing the linting warning.
