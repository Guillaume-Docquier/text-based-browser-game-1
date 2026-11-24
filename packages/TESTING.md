# Package tests

Use each package's `src/testing/` directory for reusable test-only helpers and suite setup. Name each file for what it provides, such as `mapGeometry.ts` or `createIntegrationTestDb.ts`. A helper specific to one test file can stay in that file.

Keep package tests beside the code they exercise, including tests for a helper in `src/testing/`.

## Backend and shared package tests

- Prefer integration tests. Use unit tests sparingly for complex algorithms, race-condition validation, and regressions.
- Structure unit and integration tests using Arrange, Act, Assert, with explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. `// Act & Assert` is acceptable for synchronous calls that throw and for genuinely complex routines where splitting the phases would make the test harder to understand.
- Optimize assertions for useful failure output: compare semantic values instead of opaque IDs, sort unordered collections before comparison, and keep setup control flow straightforward.
- Create expected state explicitly. Do not reimplement production logic in tests to compute expected results.
- Do not use `try`/`finally` for test cleanup. Prefer Explicit Resource Management with `using` or `await using` and resources that implement `Symbol.dispose` or `Symbol.asyncDispose` or use `afterEach` when disposal is not available or adds too much complexity.
