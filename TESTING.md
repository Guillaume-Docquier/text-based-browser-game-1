# Testing

Choose tests according to the behavior they cover.

1. e2e for critical user flows
2. integration tests through real seams
3. focused/property tests for pure domain modules
4. unit tests when they test meaningful behavior, not implementation details

Use production code. Never use `vi.mock` or `jest.mock` for module mocking. Exercise dependencies through

- constructor-injected interfaces/classes
- local database substitutes such as PGLite
- in-memory adapters when behavior is simple
- fake external adapters when needed

Assert observable results such as

- returned value/error
- persisted state
- emitted event/message
- rendered response
- sent email record in a fake/local adapter

Avoid spy-driven tests like `expect(sendEmail).toHaveBeenCalledWith(...)` unless the interaction itself is the only observable behavior.

For persistence behavior, prefer PGLite/local DB-backed tests over hand-rolled in-memory fakes when SQL/schema/transaction behavior matters.

## Test data and assertions

- Use stub factories for test data. Use a mock implementation only when a test must control or observe a dependency that it cannot exercise reliably. Keep stubs and mocks beside the type in `.stub.ts` and `.mock.ts` files. See [ADR-017](docs/architecture/decisions/017-stubs-and-mocks.md).
- When verifying a `Result` in Vitest, compare the whole value, for example `expect(result).toEqual(Result.Success(expectedValue))`. For setup expected to succeed, use the `extractSuccess` test helper. See [ADR-018](docs/architecture/decisions/018-result-handling-in-tests.md).
- Declare Vitest tests with `it` or `test` imported from `vitest`. Do not use Vitest custom fixtures. See [ADR-035](docs/architecture/decisions/035-do-not-use-vitest-custom-fixtures.md).

## Package test files

Keep package tests beside the code they exercise. Put reusable test-only helpers and suite setup in the package's `src/testing/` directory, and keep tests for a helper beside it. Name helpers for what they provide, such as `mapGeometry.ts` or `createIntegrationTestDb.ts`. A helper used by one test file can stay in that file.
