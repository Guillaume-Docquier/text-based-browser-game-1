# Zod Validation Must Be Type-Representable

## Status

Accepted

## Context

When Zod constraints are not representable in inferred TypeScript types, guarantees disappear after parsing and force duplicate validation across layers.

Examples: `z.number().int()` still infers `number`; `z.string().email()` still infers `string`.

## Decision

Use router Zod schemas for type-representable parsing constraints only.

Allowed examples:

- object/array/tuple structure
- required vs optional fields
- discriminated unions and literals
- enums / finite string unions
- nullable vs non-nullable
- explicit output-type conversions

Disallowed examples:

- `z.number().int()`
- `z.string().email()`
- domain/integrity checks in most `.refine()` / `.superRefine()`

Place business/integrity validation in controllers/services.

## Consequences

Routers stay focused on transport parsing.

Controllers/services become the clear owner of domain validation.

Validation guarantees align better with static types at boundaries.
