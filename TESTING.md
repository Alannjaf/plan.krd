# Testing Quick Reference

## Quick Start

**Run all tests:**
```bash
npm test
```

**Watch mode (auto-rerun):**
```bash
npm test -- --watch
```

**Interactive UI:**
```bash
npm run test:ui
```

**Coverage report:**
```bash
npm run test:coverage
```

**E2E tests:**
```bash
npm run test:e2e
```

## Test Results

✅ **47 tests passing** across 5 test files:
- Error utilities (6 tests)
- Validation schemas (14 tests)
- Logger utilities (10 tests)
- Button component (9 tests)
- Environment validation (8 tests)

## Test Files Created

1. `src/__tests__/utils/errors.test.ts` - Error handling utilities
2. `src/__tests__/validations/tasks.test.ts` - Zod validation schemas
3. `src/__tests__/utils/logger.test.ts` - Structured logging
4. `src/__tests__/components/ui/button.test.tsx` - Button component
5. `src/__tests__/lib/env.test.ts` - Environment validation
6. `e2e/landing-page.spec.ts` - E2E landing page test

## Example Test Run Output

```
✓ src/__tests__/utils/errors.test.ts (6 tests)
✓ src/__tests__/validations/tasks.test.ts (14 tests)
✓ src/__tests__/utils/logger.test.ts (10 tests)
✓ src/__tests__/components/ui/button.test.tsx (9 tests)
✓ src/__tests__/lib/env.test.ts (8 tests)

Test Files  5 passed (5)
     Tests  47 passed (47)
```

## Next Steps

See `docs/testing-guide.md` for comprehensive testing documentation.
