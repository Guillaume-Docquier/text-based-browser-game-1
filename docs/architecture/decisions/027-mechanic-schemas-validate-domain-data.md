# Mechanic Schemas Validate Domain Data

## Status

Accepted

## Context

[ADR-015](015-zod-validation-must-be-type-representable.md) limits Zod schemas to parsing constraints that are represented by their inferred TypeScript types. That rule is appropriate for schemas whose only responsibility is parsing transport data.

Other schemas, like Ruleset schemas, have a broader responsibility. They describe persisted Ruleset data and validate Rulesets, including Rulesets authored by players, before the Rules Engine uses them. Mechanic values often have domain constraints such as being integers or positive and non-zero. A plain TypeScript `number` cannot represent those constraints, and we need a strong validation engine.

Applying ADR-015 literally to Ruleset schemas would move these checks into separate, hand rolled validation code, duplicate domain rules, and make it harder to report useful errors at the Ruleset boundary.

## Decision

Ruleset schemas are allowed to validate runtime domain and integrity constraints in addition to parsing data. They may use Zod methods such as `.int()` and `.positive()` when those constraints are required by the game rules.

Whenever a schema uses a constraint that is not representable by its ordinary inferred TypeScript type, define a dedicated branded schema and named branded type for that domain value. Apply the runtime constraints before branding; the brand alone is not validation. For example, following the repository's existing branded-type pattern:

```ts
type PositiveInteger = Branded<number, "PositiveInteger">

const PositiveIntegerSchema = z
  .number()
  .int()
  .positive()
  .transform(branded<PositiveInteger>)
```

Use `PositiveIntegerSchema` rather than repeating `z.number().int().positive()` inline in each Mechanic schema.

Use these dedicated schemas at every field that requires the invariant. Parse Rulesets at authoring, load, or game-start boundaries and report the schema errors there. Once a Ruleset has passed validation, Rules Engine code may rely on the branded domain values. Internal states that should be impossible after validation remain explicit assertions as described by [ADR-019](019-use-assert-for-runtime-invariants.md).

This decision is scoped to Rules Engine domain schemas, including `Mechanic`, `ActionDefinition`, `Ruleset`, and their nested value schemas. Schemas whose sole responsibility is transport parsing remain governed by ADR-015.

## Consequences

Ruleset validation is centralized at the domain boundary, producing useful field-level errors for invalid or player-authored Rulesets. The TypeScript model also records which values have passed stronger runtime constraints, reducing repeated checks in Mechanics and resolvers.

Dedicated branded schemas add named domain types and require values to be created through the corresponding schema or another trusted domain constructor. This makes the contract more explicit but can require small type adjustments at call sites. Not every numeric field needs a brand: use one when the runtime invariant is meaningful to the domain and is not represented by the ordinary TypeScript type.
