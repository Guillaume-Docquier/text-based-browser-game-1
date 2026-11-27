# Shared package tests

Use focused unit tests for shared domain behavior. Exercise each module through its public functions with explicit inputs and expected output. Supply a seeded generator or a controlled clock when the function needs them.

Test a lower-level algorithm directly when its important input combinations would be difficult to construct or diagnose through the public operation. For example, exercise a spiral generator's boundary cases without building an entire game. Keep private helpers private.

Use explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. Use `// Act & Assert` for a synchronous call that throws or when splitting a complex sequence would make it harder to follow. Keep setup straightforward, write expected values explicitly, compare semantic values where possible, and sort unordered collections before comparing them.

Each directory directly under `src/` is a Vitest project named after that directory. Run all module tests with `pnpm --filter shared test`, or select one with `pnpm --filter shared test --project galaxy-creation`.
