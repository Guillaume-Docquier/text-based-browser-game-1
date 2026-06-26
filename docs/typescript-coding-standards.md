# TypeScript Coding Standards

These standards describe how to design and write TypeScript code in this codebase. They are especially intended for agents: before adding patterns, libraries, adapters, or abstractions, read the existing code and prefer the local convention unless it conflicts with the safety/correctness principles below.

## Decision priority

When rules pull in different directions, use this order:

1. Preserve correctness, safety, and debuggability.
2. Follow established project architecture and conventions.
3. Improve the local design toward these standards.
4. Avoid broad migrations unless explicitly requested.
5. Document meaningful trade-offs with comments or ADRs.

New code paths, modules, adapters, and services should generally follow these standards, but do not force a whole-project migration for an unrelated change.

## Core principles

- Write ESM code.
- Prefer **errors as values** over `throw` / rejected promises for expected failures.
- Parse early. Do not merely validate and throw away the information learned.
- Make illegal states unrepresentable where practical.
- Prefer correct-by-construction APIs over convention-based invariants.
- Use branded/refined/domain types liberally for meaningful primitives.
- Prefer composition over inheritance.
- Prefer imperative shell / functional core.
- Design deep, cohesive modules with low caller burden.
- Test behavior through real seams; avoid module mocks and spy-driven tests.
- Keep code discoverable for humans and agents.

## Adapting to existing codebases

Before adding a new pattern or library, inspect the repo for existing choices around:

- error handling
- schema parsing
- dependency injection
- testing
- observability
- adapters/services
- module layout

Prefer consistency inside the codebase. If existing code uses exception-style errors, do not rewrite the whole system. New code may still use typed results internally, but it must integrate with existing framework handlers, logging, tracing, metrics, and error reporting.

At boundaries, translate between local typed errors and whatever the framework or existing code expects.

## Errors and failures

### Expected failures are values

Expected failures include domain, parsing, authorization, integration, I/O, persistence, and workflow failures. They should appear in the return type.

Use `Result` from `@guillaume-docquier/tools-ts` for this.

Prefer:

```ts
Promise<Result<User, UserLookupError>>
```

not:

```ts
Promise<User> // rejects for ordinary lookup/storage failures
```

Promise rejection is equivalent to throwing. Treat it as acceptable only for unrecoverable defects or unclassified third-party behavior at a boundary.

### Unrecoverable defects may throw

Throwing is acceptable for panic-style failures:

- violated internal invariants
- impossible branches
- startup misconfiguration
- temporary `notYetImplemented` paths
- catastrophic runtime conditions

Use the Errors and the Assert module from `@guillaume-docquier/tools-ts`:

```ts
Assert.isDefined(value)
throw new FatalError("something went wrong", { data })
```

Use `Assert.isExhausted` for exhaustive union handling.

### Custom errors (aspirational)

Expected failures should use custom tagged errors extending `TaggedError` from `@guillaume-docquier/tools-ts`

Custom errors should include:

- stable tag for discriminated unions
- useful message
- structured contextual fields
- safe telemetry fields
- optional `cause: unknown`

Example:

```ts
export class UserStoreUnavailable extends TaggedError {
  public readonly _tag = "UserStoreUnavailable"
  public readonly operation: "findActiveByEmail"
  public readonly provider = "postgres"
  public readonly cause: unknown

  constructor({ operation = "findActiveByEmail", cause }: { operation: "findActiveByEmail"; cause?: unknown }) {
    super(`User store unavailable during ${operation}`)
    this.operation = operation
    this.cause = cause
  }
}
```

Keep error unions precise at module boundaries:

```ts
Result<User, UserNotFound | UserStoreUnavailable>
```

Avoid broad `AppError`-style types except near entrypoints, orchestration, logging, and rendering layers.

## Sensitive data, telemetry, and debugging (aspirational)

Prefer end-to-end structured tracing across requests, jobs, workflows, application modules, adapters, and external calls.

Tracing/logging should make failures diagnosable with safe fields:

- domain IDs
- operation names
- dependency/provider names
- state tags
- retry counts
- typed error tags
- safe summaries

Do not put secrets in errors, traces, logs, or snapshots.

Use a `Redacted<T>` wrapper for sensitive values such as tokens, API keys, passwords, raw credentials, and secrets.

Wrap sensitive values at the boundary and unwrap only where the raw value is needed, usually inside an adapter making an external call.

## Parse, don't validate

Boundary code should turn unknown or less-structured input into domain types as early as practical.

Prefer:

```ts
unknown -> HttpBodyDto -> CreateUserInput -> EmailAddress/UserId/etc.
```

not:

```ts
unknown -> z.infer<typeof CreateUserSchema>
```

passed throughout the app.

Use names that preserve meaning:

- `parseX(input): Result<X, ParseXError>` for untrusted or less-structured input
- `makeX(...)` / `createX(...)` for smart constructors from already-typed pieces
- `isX(value): boolean` for true predicates
- `assertX(...)` rarely, mostly at tests/framework boundaries

Avoid `validateX` when the function returns a refined value. It parsed something.

### Schemas

Use Zod as boundary parsers, not as ad-hoc validators sprinkled through core logic.

Schema parsing should produce refined/domain types and typed custom errors where practical.

## Branded types and correct construction (aspirational)

Use branded/refined types for meaningful primitives:

- IDs: `UserId`, `OrgId`, `WorkflowId`
- parsed strings: `EmailAddress`, `NonEmptyString`, `Url`
- constrained numbers: `PositiveInt`, `Cents`, `Percentage`
- units: `Milliseconds`, `Bytes`, `UsdCents`

Construct branded values through parsers or smart constructors. Avoid passing raw strings/numbers where a domain type exists.

Avoid optional/null/undefined values in functions that require a value. Push optionality outward. Branch or parse before calling.

Avoid `Partial<T>` as an application/domain input unless partiality is the real domain concept. Prefer explicit input types for each operation.

## State machines and boolean blindness

When an entity has meaningful lifecycle states, model them with tagged unions or equivalent value classes.

Prefer:

```ts
type Invoice =
  | { readonly _tag: "Draft"; readonly id: InvoiceId; readonly lines: NonEmptyArray<LineItem> }
  | { readonly _tag: "Sent"; readonly id: InvoiceId; readonly sentAt: Instant }
  | { readonly _tag: "Paid"; readonly id: InvoiceId; readonly paidAt: Instant }
```

Avoid:

```ts
type Invoice = {
  readonly isSent: boolean
  readonly isPaid: boolean
  readonly sentAt?: Date
  readonly paidAt?: Date
}
```

Avoid boolean parameters that control behavior:

```ts
createUser(input, true)
```

Prefer named options or domain types:

```ts
createUser(input, { emailVerification: "skip" })
```

Booleans are fine as clear predicate return values:

```ts
isExpired(token): boolean;
hasPermission(user, permission): boolean;
```

## Modules and abstractions

### Deep modules

A deep module hides substantial behavior/invariants behind a cohesive, low-burden interface. Low-burden does not necessarily mean few functions. A domain module may expose many cohesive combinators around one concept and still be deep.

Avoid shallow abstractions that merely forward calls, mirror tables, or expose implementation steps.

Use the deletion test:

- if deleting the module makes complexity disappear, it was probably pass-through waste
- if deleting it spreads complexity across callers, it was probably earning its keep

### Domain modules

Prefer OCaml-style domain modules for core concepts. A domain module centers on one primary type or tightly related type family and exposes parsers, smart constructors, combinators, predicates, interpreters, arbitraries, and formatting helpers for that concept.

Example:

```ts
// email-address.ts

/**
 * A parsed, normalized email address.
 */
export type EmailAddress = Brand<string, "EmailAddress">

export const EmailAddress = {
  /**
   * Parse an email address from untrusted input.
   */
  parse(input: string): Result<EmailAddress, InvalidEmailAddress> {},

  /**
   * Render an email address as a string.
   */
  toString(email: EmailAddress): string {},

  /**
   * Compare two email addresses for equality.
   */
  equals(left: EmailAddress, right: EmailAddress): boolean {},
}
```

Domain modules may be plain functions, classes, or static-style classes when cohesive.

If using classes for domain values:

- construct through `parse` / `make` / smart constructors
- make invalid instances unconstructable
- keep fields readonly/immutable from callers
- keep methods cohesive over that value
- do not hide dependencies or I/O inside domain value classes
- avoid inheritance for domain behavior

### Application/service modules

Application modules own real capabilities or operations:

- `PasswordReset`
- `Billing`
- `Invitations`
- `SubscriptionLifecycle`

They coordinate domain modules, persistence, external calls, authorization, workflows, and telemetry.

Prefer classes with constructor injection when the module has dependencies, stateful resources, configuration, or multiple cohesive operations.

Avoid dependency bags like `deps` objects passed into every function.

No arbitrary method limit. Split when methods are unrelated, change for different reasons, require unrelated dependencies, or create an accidental grab bag.

Avoid vague names like `Manager`, `Processor`, `Helper`, or generic `UserService` unless established by the framework/project.

## Dependency interfaces and adapters

Depend on the smallest meaningful shape a module actually uses. Let concrete adapters be wider.

Because TypeScript is structurally typed, this works well:

```ts
type UsersForPasswordReset = {
  findActiveByEmail(email: EmailAddress): Promise<Result<ActiveUser, UserLookupError>>
}

export class PasswordReset {
  constructor(private readonly users: UsersForPasswordReset) {}
}
```

A wider adapter can satisfy it:

```ts
export class PostgresUsers {
  findActiveByEmail(...) { ... }
  findById(...) { ... }
  updateProfile(...) { ... }
}
```

This avoids both mega-repositories and one-method adapter sprawl.

### Adapter reuse audit

Before creating a new adapter or service, agents must audit existing adapters/services.

Prefer, in order:

1. Reuse an existing adapter as-is through a narrow dependency type.
2. Extend an existing adapter if the new method fits its existing cohesive capability and changes for the same reason.
3. Create a new adapter only when reuse/extension would create bad coupling or an accidental interface.

When a meaningful new adapter/service is still created after the audit, create an ADR explaining:

- what existing adapters/services were checked
- why reuse did not fit
- why extension did not fit
- why the new adapter is a separate cohesive capability

Do not require an ADR for tiny local test adapters, obvious in-memory fakes, or trivial framework glue.

### Repositories and persistence

Avoid repository-per-table by default.

Repository-like adapters are acceptable when they represent a cohesive domain persistence capability. They should expose meaningful domain operations and return parsed domain types / typed errors, not raw rows and ORM errors.

Treat raw database rows and ORM models as infrastructure DTOs. Parse them before application/core logic. Keep SQL/ORM details inside infrastructure adapters or persistence modules.

## Functional core, imperative shell, and entrypoints

Keep domain/application behavior reusable across REST, CLI, GraphQL, workers, and other entrypoints.

The functional core contains:

- domain logic
- parsers
- state transitions
- combinators
- decision functions

It avoids:

- I/O
- hidden dependencies
- ambient time/randomness
- thrown expected failures
- framework-specific concerns

The imperative shell:

- parses untrusted input
- sequences effects
- calls the core with refined values
- classifies external failures into typed errors
- handles I/O, persistence, HTTP, queues, telemetry, time, randomness

Entrypoint adapters should be thin protocol translation layers. They parse protocol-specific input, invoke shared modules, and render protocol-specific output. Do not duplicate business rules in controllers/resolvers/CLI handlers.

Authorization belongs in shared application/domain policy, not duplicated in controllers. Entrypoints may authenticate and parse users/sessions/credentials, but shared modules should receive a domain-specific parsed authorization input such as `AdminUser`, `Session`, `Principal`, `DeployCredential`, or `CommandActor`.

## Workflows, transactions, and idempotency

Use ordinary function calls or database transactions for simple single-boundary operations.

Use a saga/durable workflow when the process needs:

- retries
- compensation
- idempotency
- resumability
- timers
- human approval
- cross-service coordination
- multiple transaction boundaries

Do not hold database transactions open across network calls or long-running operations.

Any command, job, or workflow step that may be retried needs an explicit idempotency strategy:

- idempotency key
- natural unique constraint
- deduplication record
- state-machine transition guard
- transactional outbox/inbox

Retrying should not rely on “probably safe” side effects.

## Testing

Prefer confidence-oriented tests:

1. e2e for critical user flows
2. integration tests through real seams
3. focused/property tests for pure domain modules
4. unit tests when they test meaningful behavior, not implementation details

Never use `vi.mock` or `jest.mock` for module mocking. Use real seams:

- constructor-injected interfaces/classes
- local database substitutes such as PGLite
- in-memory adapters when behavior is simple
- fake external adapters when needed

Prefer tests that assert observable input/output behavior:

- returned value/error
- persisted state
- emitted event/message
- rendered response
- sent email record in a fake/local adapter

Avoid spy-driven tests like `expect(sendEmail).toHaveBeenCalledWith(...)` unless the interaction itself is the only observable behavior.

For persistence behavior, prefer PGLite/local DB-backed tests over hand-rolled in-memory fakes when SQL/schema/transaction behavior matters.

### Property tests and arbitraries (aspirational)

Use `fast-check` where properties are clearer than examples, especially for:

- parsers/smart constructors
- branded/refined types
- state machines
- serialization roundtrips
- normalization/idempotence
- lawful combinators

Use arbitraries for mock/test data generation. Prefer exporting arbitraries near the domain module they support:

```txt
src/billing/
  invoice-number.ts
  invoice-number.test.ts
  invoice-number.arbitrary.ts
```

Tests should not bypass parsers, smart constructors, or invariants.

## TypeScript style and safety

Use strict TypeScript settings where practical:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`

Prefer immutable values:

```ts
type CreateUserInput = {
  readonly email: EmailAddress
  readonly roles: ReadonlyArray<Role>
}
```

Mutation is acceptable inside localized imperative shell code, performance-sensitive internals, builders, or adapters when hidden behind a precise interface.

### Casts, `any`, and non-null assertions

Avoid:

- `any`
- non-null assertions (`!`)
- casts with `as Type`

`as const` is fine.

Rare exceptions are allowed for highly generic helpers, branding internals, interop boundaries, or combinators where TypeScript cannot express the invariant.

Any non-`as const` cast requires a Rust-like safety comment:

```ts
// SAFETY: TypeScript cannot express the brand. parseEmailAddress checked the normalized string before branding. Callers cannot construct EmailAddress except through this parser.
return normalized as EmailAddress
```

Rare `any` also requires a targeted oxlint ignore and justification:

```ts
// oxlint-disable-next-line no-explicit-any -- SAFETY: This helper preserves arbitrary function parameters; TypeScript cannot express this variadic constraint without any.
type Fn = (...args: any[]) => unknown
```

Do not use `!`. Branch, parse, or refine instead.

## Imports, exports, and files

Prefer direct imports from the file that owns the abstraction. Avoid barrel files / `index.ts` re-export layers by default.

For domain modules, avoid namespace imports if you need to preserve the module shape. Export a const instead:

Avoid:

```ts
import * as EmailAddress from "./email-address"

EmailAddress.parse(input)
```

Prefer:

```ts
import { EmailAddress } from "./email-address"

EmailAddress.parse(input)
```

Always use named exports:

```ts
import { casesHandled } from "./prelude"
import { PasswordReset } from "./password-reset"
```

Export only what callers should use. Keep internal helpers unexported unless intentionally shared. Do not export internals just for tests.

Avoid TypeScript `namespace` unless there is a compelling interop reason.

Avoid vague files:

```txt
utils.ts
helpers.ts
common.ts
misc.ts
```

Use precise names:

```txt
email-address.ts
billing-period.ts
string-case.ts
array.ts
prelude.ts
```

No arbitrary file-size limits. Prefer cohesion and discoverability over small files for their own sake. Split when a file has multiple unrelated reasons to change or callers must understand unrelated concepts.

## Comments and JSDoc

Comments should explain invariants, trade-offs, non-obvious domain rules, and safety justifications. Avoid comments that narrate obvious code.

Every exported function, class, method, constant, and usually exported type should have JSDoc.

Use standard JSDoc syntax:

```ts
/**
 * Parse an email address from untrusted input.
 *
 * @param input - The untrusted string to parse.
 * @returns A parsed email address, or `InvalidEmailAddress` when the input is invalid.
 */
export function parse(input: string): Result<EmailAddress, InvalidEmailAddress>
```

For generics:

```ts
/**
 * Map the success value of a result.
 *
 * @template T - The original success type.
 * @template U - The mapped success type.
 * @template E - The error type.
 * @param result - The result to map.
 * @param fn - The function applied to the success value.
 * @returns A result with the mapped success value, or the original error.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
```

Use `@throws` only for unrecoverable defects, framework-required behavior, or temporary `notYetImplemented` paths. Do not document expected typed errors as throws.

For complex exported object types, document fields when helpful:

```ts
/**
 * Input required to create a user.
 */
export type CreateUserInput = {
  /**
   * The actor creating the user.
   */
  readonly actor: AdminUser

  /**
   * The parsed email address for the new user.
   */
  readonly email: EmailAddress
}
```

## Configuration and resources

Parse environment/config at startup or the earliest boundary into typed config with branded/redacted values where appropriate.

Do not read `process.env` throughout the app. Missing/invalid config is a startup failure with useful context.

Avoid top-level side effects except in true entrypoint/bootstrap files. Modules should not start servers, open connections, read env, register handlers, or perform I/O at import time.

Resource creation and cleanup should be explicit and owned by bootstrap/imperative shell code.

Avoid mutable singletons/global state. Constants and pure lookup tables are fine. If a singleton is required by a framework/runtime, isolate it at the boundary.

Inject `Clock` / `Random` services into dependency-bearing modules. Pure domain functions may accept explicit `now` / random values.

## Quick agent checklist

Before coding:

- Read existing conventions for errors, schemas, tests, adapters, telemetry, and module layout.
- Look for existing domain modules/types before creating new ones.
- Look for existing adapters/services before creating a new one.
- Parse inputs at the edge and use domain types internally.
- Avoid raw DTOs, raw IDs, nullable bags, and `Partial<T>` in core/application logic.
- Prefer typed errors as values for new expected failures.
- Preserve existing observability/error mechanics.
- Test through public interfaces and real seams.
- Use `fast-check` arbitraries for generated test data when practical.
- Add JSDoc for exported symbols.
- Add ADRs for meaningful new adapters/services created after an adapter reuse audit.
