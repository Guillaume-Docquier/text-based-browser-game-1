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

Branding is required for schema constraints not represented by the TypeScript type. The data should be immutable to preserve its validity. Most, if not all, schemas that perform validation will need a branded type. Parsing-only schemas don't have to return a branded type or immutable data structures.

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

## Imports, exports, and files

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

## Code Comments

Keep code comments to a minimum. The linter requires a `//` line comment that starts with one of the following prefixes.

- `INTENT:`: Explain non-obvious choices where multiple avenues were possible and the reasons we went this way are not visible in the codebase.
- `CONSTRAINT:`: A non-obvious constraint forces a certain design choice. Name the constraint and provide sources where applicable.
- `oxlint-disable`: Used when we absolutely have to bypass the linter
- `@ts-expect-error`: Used when we absolutely have to bypass the type checker
- `Arrange`, `Act`, `Assert`: Used in unit tests only

An `INTENT` or `CONSTRAINT` comment is only needed when it's not clear why the code is the way it is, and changing that code would go unnoticed or fail in non-obvious ways. Always favor better names, type-level constraints, enforced lint rules, clear glossary and focused descriptive tests over a code comment when possible. Reserve the comments for those rare cases where we can't otherwise enforce the tacit knowledge and an understanding failure would lead to wasted debugging time or outages.

## Enum members

Always use enum members instead of their literal values, for example `PlayerColor.TURQUOISE` instead of `"TURQUOISE"`.

## @guillaume-docquier/tools-ts

Leverage the `@guillaume-docquier/tools-ts` npm package as much as possible. This is a TypeScript library of utilities made by us. Their README.md contains a high-level view of the available utilities, read it.

- When importing a value and a type of the same name from the same package (e.g `Range` or `Result`), just import the value. Do not import the type to rename it.
- Prefer the specialized `Range.float({ min, max })` and `Range.integer({ min, max })` constructors over `Range.create` whenever possible.
