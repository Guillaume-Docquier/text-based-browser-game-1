# Root testing

At the project root, we have 1 kind of tests:

- Linting unit tests

# Linting unit tests

Linting unit tests use Vitest to test that our lint configurations apply the way we intend it to. The tests test the full lint config, not the plugins or custom rules.

- Tests go in `linting/tests/`
- Structure tests using Arrange, Act, Assert, with explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. `// Act & Assert` is acceptable for synchronous calls that throw and for genuinely complex routines where splitting the phases would make the test harder to understand.
- Each test file validates a set of rules that apply to a certain scope. For example, any rule from the global config that applies to everything goes into `global.test.ts`. Any rule that applies to backend tests only would go into `backend-test.test.ts`.
- Each test is a specific scenario scoped to one rule, expecting the exact Oxlint diagnostic code.
- Write fixture code in multiline template literals. Use the same line breaks and indentation you would use in a TypeScript file.
- Each scenario that tests a rule being turned off should explain why we turn off that rule in the test name.

Run lint tests with `pnpm test:lint`.
