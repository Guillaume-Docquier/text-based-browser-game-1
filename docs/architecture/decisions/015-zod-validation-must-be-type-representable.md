# Zod Validation Must Be Type-Representable

## Status

Accepted

### Amendment history

- 2026-06-20: Clarified cases where `.refine()` can be used.
- 2026-09-15: Allowed runtime constraints when the schema produces a dedicated branded type that records the validated guarantee.

## Context

We use Zod schemas in routers to validate and parse user input.

If a Zod rule cannot be represented by the inferred TypeScript type, then that rule's guarantees are lost as soon as parsed data is typed and passed to the next layer.

This leads to "shotgun validation": repeated validation of the same data at multiple layers because code cannot trust that prior validation was enough.

Examples of non-representable constraints include `z.number().int()` and `z.string().email()`. Both return broad runtime types (`number`, `string`) that do not encode the narrower guarantees (integer, email format).

## Decision

Use Zod in routers for base shape/format parsing that remains representable in TypeScript types. A schema may also enforce a runtime constraint that is not represented by an ordinary TypeScript type when it produces a dedicated branded type that records the guarantee.

Allowed Zod constraints are those that narrow data in a way captured by the resulting type, for example:

- object/array/tuple structure
- required vs optional fields
- discriminated unions and literal values
- enums / finite string unions
- nullable / non-nullable values
- type conversions that are explicit in the output type

Zod transformations that are not type representable must end with a `.transform(branded<TYPE>)` to brand the validated value so it carries the proof of validation. A new branded schema must apply runtime constraints before branding, as described by [ADR-027](027-mechanic-schemas-validate-domain-data.md).

Example zod schemas that do not produce type representable validation:

- `z.number().int()`
- `z.string().email()`
- `z.refine()`
- `z.superRefine()`

Using `.refine()` without a brand is appropriate if the model being parsed already enforces the invariants. For example, the `RangeDto` schema is fine, because the `Range` factory method enforces the checks that the schema does. In fact, the schema uses the same checks as the `Range` factory method.

Business logic and remaining data integrity validation must happen in controllers/services, where it is explicit and close to domain behavior.

## Consequences

Router schemas stay focused on parsing and type-safe transport boundaries.

Controllers/services remain the owner of business behavior and persistence validation. Dedicated branded schemas may own reusable runtime constraints at a parsing boundary, preventing shotgun validation while keeping the guarantee visible in the resulting type.

The architecture becomes easier to reason about because type-level guarantees and runtime guarantees align more consistently at layer boundaries.
