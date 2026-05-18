# Zod Validation Must Be Type-Representable

## Status

Accepted

## Context

We use Zod schemas in routers to validate and parse user input.

If a Zod rule cannot be represented by the inferred TypeScript type, then that rule's guarantees are lost as soon as parsed data is typed and passed to the next layer.

This leads to "shotgun validation": repeated validation of the same data at multiple layers because code cannot trust that prior validation was enough.

Examples of non-representable constraints include `z.number().int()` and `z.string().email()`. Both return broad runtime types (`number`, `string`) that do not encode the narrower guarantees (integer, email format).

## Decision

Use Zod in routers only for base shape/format parsing that remains representable in TypeScript types. We use it to parse inputs, not to validate it.

Allowed Zod constraints are those that narrow data in a way captured by the resulting type, for example:

- object/array/tuple structure
- required vs optional fields
- discriminated unions and literal values
- enums / finite string unions
- nullable / non-nullable values
- type conversions that are explicit in the output type

Disallowed Zod constraints are rules that express business or integrity constraints that cannot be represented in the inferred type, for example:

- `z.number().int()`
- `z.string().email()`
- most `.refine()` / `.superRefine()` checks for domain invariants

Business logic and data integrity validation must happen in controllers/services, where it is explicit and close to domain behavior.

## Consequences

Router schemas stay focused on parsing and type-safe transport boundaries.

Controllers/services become the single place for domain validation, reducing duplicate checks and making validation ownership clearer.

The architecture becomes easier to reason about because type-level guarantees and runtime guarantees align more consistently at layer boundaries.
