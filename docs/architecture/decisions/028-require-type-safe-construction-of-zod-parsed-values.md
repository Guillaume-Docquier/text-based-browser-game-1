# Require Type-Safe Construction Of Zod-Parsed Values

## Status

Accepted

## Context

Branded and refined types let TypeScript distinguish values that share the same primitive representation and record runtime constraints that the primitive type cannot express. A constrained value must be created only after it has been validated.

We use Zod schemas to parse inputs and, for domain schemas, to enforce runtime constraints. Calling a schema's `parse` or `safeParse` method directly accepts an `unknown` input. When the caller already has a trusted, typed value, that API discards useful compile-time checking: a value with the wrong TypeScript type can reach the schema without a type error. Conversely, calling `branded()` directly is type-safe for the underlying primitive but performs no runtime validation, so it can bypass constraints such as integer or positive-number requirements.

The backend provides `trustedParse` and `trustedSafeParse` in `backend/src/lib/validation/trustedParse.ts`. They preserve the schema's input type at compile time while still running its runtime validation. This decision complements [ADR-013](013-use-results-and-never-throw.md), [ADR-015](015-zod-validation-must-be-type-representable.md), and [ADR-027](027-mechanic-schemas-validate-domain-data.md).

## Decision

Use `trustedParse(schema, value)` or `trustedSafeParse(schema, value)` when parsing a trusted value, including when constructing a branded or refined value, whose TypeScript type already matches the schema input.

- Use `trustedParse` only when schema failure is an internal invariant violation that should be fatal. Do not use it for invalid input that the caller is expected to handle.
- Use `trustedSafeParse` when schema failure is expected or must be reported. The caller must handle the unsuccessful result.
- Parse untrusted values at their input boundary with the appropriate schema API. `trustedParse` and `trustedSafeParse` do not make an input trusted.
- Do not call `branded()` to bypass a constrained schema. Its valid role is implementing the schema's branding transform, or constructing a brand that has no runtime constraint beyond its already trusted primitive type.

## Consequences

Trusted-value construction retains compile-time input checking while continuing to enforce runtime constraints. Call sites make failure semantics explicit, and constrained branded values cannot legitimately be created by assertion alone.

Callers must distinguish trusted values from untrusted inputs and choose between fatal and handled validation failures. Tests and fixtures may require `trustedParse` or `trustedSafeParse` when they construct constrained domain values, instead of using `branded()` as a shortcut.
