# Testing Guide

## Overview

Plan.krd uses **Vitest** for unit and integration tests, and **Playwright** for end-to-end (E2E) tests.

## Running Tests

### Unit Tests (Vitest)

**Run all tests once:**
```bash
npm test
```

**Run tests in watch mode (auto-rerun on file changes):**
```bash
npm test -- --watch
```

**Run tests with interactive UI:**
```bash
npm run test:ui
```

**Generate coverage report:**
```bash
npm run test:coverage
```

**Run specific test file:**
```bash
npm test -- src/__tests__/utils/errors.test.ts
```

**Run tests matching a pattern:**
```bash
npm test -- --grep "validation"
```

### E2E Tests (Playwright)

**Run all E2E tests:**
```bash
npm run test:e2e
```

**Run E2E tests with UI mode (interactive):**
```bash
npm run test:e2e:ui
```

**Run specific E2E test:**
```bash
npm run test:e2e -- e2e/landing-page.spec.ts
```

**Run E2E tests in headed mode (see browser):**
```bash
npm run test:e2e -- --headed
```

## Test Structure

### Unit Tests Location
- `src/__tests__/` - All unit and integration tests
- `src/__tests__/utils/` - Utility function tests
- `src/__tests__/validations/` - Validation schema tests
- `src/__tests__/components/` - Component tests
- `src/__tests__/lib/` - Library function tests

### E2E Tests Location
- `e2e/` - All end-to-end tests

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "@/lib/utils/my-function";

describe("myFunction", () => {
  it("should return expected result", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });
});
```

### Component Test Example

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyComponent } from "@/components/my-component";

describe("MyComponent", () => {
  it("should render correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from "@playwright/test";

test("should navigate to page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Plan.krd/i);
});
```

## Test Utilities

### Mocks

The test setup (`src/__tests__/setup.ts`) includes:
- Next.js router mocks
- Supabase client mocks
- Jest DOM matchers

### Available Matchers

From `@testing-library/jest-dom`:
- `toBeInTheDocument()`
- `toHaveClass()`
- `toHaveAttribute()`
- `toBeDisabled()`
- `toBeVisible()`
- And more...

## Current Test Coverage

### Tests Implemented

1. **Error Utilities** (`src/__tests__/utils/errors.test.ts`)
   - Error message extraction
   - Result type helpers

2. **Validation Schemas** (`src/__tests__/validations/tasks.test.ts`)
   - Task creation validation
   - Task update validation
   - Task movement validation

3. **Logger** (`src/__tests__/utils/logger.test.ts`)
   - Logger methods
   - Request ID tracking

4. **Button Component** (`src/__tests__/components/ui/button.test.tsx`)
   - Rendering
   - Variants and sizes
   - Click handling
   - Disabled state

5. **Environment Validation** (`src/__tests__/lib/env.test.ts`)
   - Valid environment variables
   - Missing required variables
   - Invalid formats

6. **E2E Landing Page** (`e2e/landing-page.spec.ts`)
   - Page loading
   - Navigation
   - Responsiveness

## Best Practices

1. **Test naming**: Use descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Isolation**: Each test should be independent
4. **Mock external dependencies**: Use mocks for Supabase, Next.js router, etc.
5. **Test edge cases**: Include tests for error conditions and boundary cases
6. **Keep tests fast**: Unit tests should run quickly
7. **Use appropriate test types**: Unit tests for functions, component tests for UI, E2E for user flows

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test -- --run

- name: Run E2E tests
  run: npm run test:e2e
```

## Debugging Tests

**Debug unit tests:**
```bash
npm test -- --inspect-brk
```

**Debug E2E tests:**
```bash
npm run test:e2e:ui
# Then use the Playwright Inspector
```

## Coverage Goals

- **Target**: 80%+ coverage for critical paths
- **Focus areas**: Server actions, utilities, validation schemas
- **Generate report**: `npm run test:coverage`

## Next Steps

Consider adding tests for:
- Server actions (tasks, boards, comments)
- Complex components (TaskDetailModal, KanbanBoard)
- Offline sync queue logic
- AI action execution
- Real-time hooks
