# Shared Package Instructions

These instructions apply to the `shared` package.

## Architecture

The package contains domain definitions and gameplay behavior shared by the frontend and backend, including galaxy creation, action submission, rulesets, and turn resolution. It uses Vitest for tests.

There is no package build. Code must support isolated modules and erasable TypeScript syntax so it can run natively in Node and be bundled for the browser. Do not use features such as enums or decorators.

## Commands

- `pnpm --filter shared test`: run all shared package tests.
- `pnpm --filter shared checks`: run all shared package quality checks.

## Testing

- Test production code. Do not use `vitest.mock()`.
- Prefer integration tests. Use unit tests sparingly for complex algorithms, race-condition validation, and regressions.
- Structure unit and integration tests using Arrange, Act, Assert, with explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. `// Act & Assert` is acceptable for synchronous calls that throw and for genuinely complex routines where splitting the phases would make the test harder to understand.
- Optimize assertions for useful failure output: compare semantic values instead of opaque IDs, sort unordered collections before comparison, and keep setup control flow straightforward.
- Create expected state explicitly. Do not reimplement production logic in tests to compute expected results.
- Do not use `try`/`finally` for test cleanup. Prefer Explicit Resource Management with `using` or `await using` and resources that implement `Symbol.dispose` or `Symbol.asyncDispose` or use `afterEach` when disposal is not available or adds too much complexity.
