# TypeScript Coding Standards

These standards describe how to design and write TypeScript code in this codebase. They are especially intended for agents: before adding patterns, libraries or abstractions, read the existing code and prefer the local convention unless it conflicts with the safety/correctness principles below.

## Decision priority

When rules pull in different directions, use this order:

1. Preserve correctness, safety, and debuggability.
2. Follow established project architecture and conventions.
3. Improve the local design toward these standards.
4. Avoid broad migrations unless explicitly requested.
5. Document meaningful trade-offs with comments or ADRs.

New code paths, modules and services should generally follow these standards, but do not force a whole-project migration for an unrelated change.

## Core principles

- Write ESM code.
- Prefer **errors as values** over `throw` / rejected promises for expected failures.
- Parse early. Do not merely validate and throw away the information learned.
- Make illegal states unrepresentable where practical.
- Prefer correct-by-construction APIs over convention-based invariants.
- Use branded types liberally for meaningful primitives.
- Prefer composition over inheritance.
- Prefer imperative shell / functional core.
- Design deep, cohesive modules with low caller burden.
- Test behavior through real seams; avoid module mocks and spy-driven tests.
- Keep code discoverable for humans and agents.

## Errors and failures

### Expected failures are values

Use `Result` from `@guillaume-docquier/tools-ts`.

Prefer:

```ts
Promise<Result<User, UserLookupError>>
```

not:

```ts
Promise<User> // rejects for ordinary lookup/storage failures
```

Promise rejection is equivalent to throwing.

3rd parties that throw errors should be wrapped into a `Result.tryCatch`.

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

Use `Assert.isExhausted` for exhaustive union handling when TypeScript is not already validating exhaustiveness through a function return type that doesn't allow undefined.

## Parsing and Validation

Boundary code should always parse incoming data, and optionally validate it. Use Zod schemas for parsing and validation.

Schemas that validate should return a branded type and an immutable data structure to capture the data validity. Parsing only schema don't have to return a branded type of immutable data structures.

## Branded types and correct construction

Use branded types for meaningful primitives and validated data, avoid passing raw strings/numbers where a domain type exists:

- IDs: `UserId`, `OrgId`, `WorkflowId`
- parsed strings: `EmailAddress`, `NonEmptyString`, `Url`
- constrained numbers: `PositiveInt`, `Cents`, `Percentage`
- units: `Milliseconds`, `Bytes`, `UsdCents`

Use `Branded<TBrand, TType>` and `branded()` from `@guillaume-docquier/tools-ts` for this. Parse untrusted input with the relevant Zod schema. When constructing a constrained branded value from already typed input, use `typedParse` or `safeTypedParse` from `@guillaume-docquier/tools-ts/schemas` so TypeScript checks the input while Zod enforces runtime constraints. Use `branded<T>(value)` only for brands whose underlying type already carries all required runtime guarantees.

## Modules and abstractions

### Deep modules

A deep module hides substantial behavior/invariants behind a cohesive, low-burden interface. Low-burden does not necessarily mean few functions. A domain module may expose many cohesive combinators around one concept and still be deep.

Avoid shallow abstractions that merely forward calls, mirror tables, or expose implementation steps.

Use the deletion test:

- if deleting the module makes complexity disappear, it was probably pass-through waste
- if deleting it spreads complexity across callers, it was probably earning its keep

### Domain modules

Prefer OCaml-style domain modules for stateless core concepts. A domain module centers on one primary type or tightly related type family and exposes parsers, smart constructors, combinators, predicates, interpreters, arbitraries, and formatting helpers for that concept.

Example:

```ts
// email-address.ts

import type { Branded } from "@guillaume-docquier/tools-ts"

/**
 * A parsed, normalized email address.
 */
export type EmailAddress = Branded<"EmailAddress", string>

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

For stateful modules, use classes that own real capabilities or operations:

- `PasswordReset`
- `Billing`
- `Invitations`
- `SubscriptionLifecycle`

They coordinate domain modules, persistence, external calls, authorization, workflows, and telemetry.

Prefer classes with constructor injection when the module has dependencies, stateful resources, configuration, or multiple cohesive operations.

Avoid dependency bags like `deps` objects passed into every function.

No arbitrary method limit. Split when methods are unrelated, change for different reasons, require unrelated dependencies, or create an accidental grab bag.

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

## Imports, exports, and files

Prefer direct imports from the file that owns the abstraction. Do not use barrel files or re-exports.

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
import { PasswordReset } from "./password-reset"
import { casesHandled } from "./prelude"
```

Export only what callers should use. Keep internal helpers unexported unless intentionally shared. Do not export internals just for tests.

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

## Configuration and resources

Parse environment/config at startup or the earliest boundary into typed config with branded/redacted values where appropriate.

Do not read `process.env` throughout the app. Missing/invalid config is a startup failure with useful context.

Avoid top-level side effects except in true entrypoint/bootstrap files. Modules should not start servers, open connections, read env, register handlers, or perform I/O at import time.

Resource creation and cleanup should be explicit and owned by bootstrap/imperative shell code.

Avoid mutable singletons/global state. Constants and pure lookup tables are fine. If a singleton is required by a framework/runtime, isolate it at the boundary.

Inject `Clock` / `Random` services into dependency-bearing modules. Pure domain functions may accept explicit `now` / random values.
