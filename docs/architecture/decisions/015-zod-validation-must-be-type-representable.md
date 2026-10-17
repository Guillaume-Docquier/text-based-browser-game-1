# Zod Validation Must Be Type-Representable

## Status

Accepted

### Amendment history

- 2026-06-20: Clarified cases where `.refine()` can be used.
- 2026-09-15: Allowed runtime constraints when the schema produces a dedicated branded type that records the validated guarantee.

## Context

We use Zod schemas in to validate and parse user input.

If a Zod rule cannot be represented by the inferred TypeScript type, then that rule's guarantees are lost as soon as parsed data is typed and passed to the next layer.

This leads to "shotgun validation": repeated validation of the same data at multiple layers because code cannot trust that prior validation was enough.

Examples of non-representable constraints include `z.number().int()` and `z.string().email()`. Both return broad runtime types (`number`, `string`) that do not encode the narrower guarantees (integer, email format).

## Decision

Use Zod without branding when parsing data that remains representable in TypeScript types. A schema that does validation that is not type representable must output a branded readonly type to capture the performed validation.

Allowed Zod constraints are those that narrow data in a way captured by the resulting type, for example:

- object/array/tuple structure
- required vs optional fields
- discriminated unions and literal values
- enums / finite string unions
- nullable / non-nullable values
- type conversions that are explicit in the output type

Zod transformations that are not type representable must end with a `.transform(branded<TYPE>)` to brand the validated value so it carries the proof of validation. A new branded schema must apply runtime constraints before branding, as described by [ADR-027](027-effect-definition-schemas-validate-domain-data.md).

Example zod schemas that do not produce type representable validation:

- `z.number().int()`
- `z.string().email()`
- `z.refine()`
- `z.superRefine()`

## Consequences

We can use zod for all validation and branded types give us a mean to know that the data has been validated.
