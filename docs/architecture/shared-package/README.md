# Shared package implementation plan

## Status and scope

This is the handoff plan for a future implementation. The current package is still `packages/game-rules`; the target package is `packages/shared`, named `shared` in its package manifest.

The agreed change combines reusable domain definitions and existing game behavior in one package. It preserves gameplay, API payloads, persisted representations, deterministic resolution, and the existing testing boundaries. It does not include the broader backend/frontend directory reorganization discussed earlier, new gameplay systems, or a database redesign.

Read the repository and scoped `AGENTS.md` files, [TypeScript standards](../../typescript-coding-standards.md), [glossary](../../glossary.md), and relevant accepted [ADRs](../decisions/README.md) before implementing. Follow the ADR workflow when recording the package ownership change. This plan does not supersede an unrelated accepted decision or authorize commits, pushes, or a pull request.

## Target structure

The domain categories are siblings. `domain/game` owns Game definitions; it does not contain players, turns, world, resources, actions, or rulesets. Keep `src/` free of loose files and avoid barrel files.

The tree describes target ownership, not a requirement to invent missing models. Audit existing shapes before creating `Game`, `Player`, or `Turn`; flag an absent or ambiguous canonical model instead of copying an ORM row or merging unrelated projections. Stubs and tests not enumerated below are colocated according to the rules that follow.

```text
packages/shared/
├── README.md
├── AGENTS.md
├── package.json
├── tsconfig.json
├── tsconfig.package.json
├── tsconfig.node.json
├── vitest.config.ts
├── oxlint.config.ts
├── boundaries.ts
└── src/
    ├── domain/
    │   ├── identity/
    │   │   ├── Account.ts
    │   │   ├── Account.stub.ts
    │   │   ├── AccountId.ts
    │   │   └── Alias.ts
    │   ├── game/
    │   │   ├── Game.ts
    │   │   ├── Game.stub.ts
    │   │   ├── GameId.ts
    │   │   ├── GameStatus.ts
    │   │   └── GameConfiguration.ts
    │   ├── players/
    │   │   ├── Player.ts
    │   │   ├── Player.stub.ts
    │   │   ├── PlayerId.ts
    │   │   └── PlayerColor.ts
    │   ├── turns/
    │   │   ├── Turn.ts
    │   │   ├── Turn.stub.ts
    │   │   └── TurnStatus.ts
    │   ├── world/
    │   │   ├── Galaxy.ts
    │   │   ├── Galaxy.stub.ts
    │   │   ├── StarSystem.ts
    │   │   ├── stars/
    │   │   │   ├── Star.ts
    │   │   │   ├── Star.stub.ts
    │   │   │   ├── StarId.ts
    │   │   │   └── StarCoordinates.ts
    │   │   ├── planets/
    │   │   │   ├── Planet.ts
    │   │   │   ├── Planet.stub.ts
    │   │   │   ├── PlanetId.ts
    │   │   │   ├── PlanetName.ts
    │   │   │   ├── PlanetBiome.ts
    │   │   │   ├── PlanetSize.ts
    │   │   │   ├── PlanetCoordinates.ts
    │   │   │   └── OrbitCoordinates.ts
    │   │   └── fleets/
    │   │       ├── Fleet.ts
    │   │       ├── Fleet.stub.ts
    │   │       ├── FleetId.ts
    │   │       └── FleetName.ts
    │   ├── resources/
    │   │   ├── Resources.ts
    │   │   ├── Resources.stub.ts
    │   │   ├── ResourceType.ts
    │   │   └── QuantityOfResource.ts
    │   ├── actions/
    │   │   ├── Action.ts
    │   │   ├── Action.stub.ts
    │   │   ├── ActionId.ts
    │   │   ├── SelectedTargets.ts
    │   │   ├── ResolvedAction.ts
    │   │   └── EffectOutcome.ts
    │   └── ruleset/
    │       ├── Ruleset.ts
    │       ├── Ruleset.stub.ts
    │       ├── RulesetId.ts
    │       ├── PooledAction.ts
    │       ├── action-definitions/
    │       │   ├── ActionDefinition.ts
    │       │   ├── ActionDefinition.stub.ts
    │       │   ├── ActionDefinitionId.ts
    │       │   ├── ActionType.ts
    │       │   ├── ActionTier.ts
    │       │   └── TargetTag.ts
    │       ├── effect-definitions/
    │       │   ├── EffectDefinition.ts
    │       │   ├── AbstractEffectDefinition.ts
    │       │   ├── EffectDefinitionFactoryParameters.ts
    │       │   ├── EffectDefinitionTargetDefinition.ts
    │       │   ├── TargetRole.ts
    │       │   ├── ResourceGainEffectDefinition.ts
    │       │   ├── ResourceLossEffectDefinition.ts
    │       │   ├── FleetBuildEffectDefinition.ts
    │       │   ├── FleetMoveEffectDefinition.ts
    │       │   └── VictoryEffectDefinition.ts
    │       └── target-definitions/
    │           ├── TargetDefinition.ts
    │           ├── TargetId.ts
    │           ├── TargetType.ts
    │           ├── TargetConstraint.ts
    │           ├── AbstractTargetConstraint.ts
    │           └── OwnedBySubmittingPlayerTargetConstraint.ts
    ├── galaxy-creation/
    │   ├── createGalaxy.ts
    │   ├── assignHomePlanets.ts
    │   ├── GalaxyCreationSettings.ts
    │   ├── toStarCoordinates.ts
    │   ├── toPlanetCoordinates.ts
    │   ├── toOrbitCoordinates.ts
    │   └── generation/
    │       ├── galaxy.generator.ts
    │       ├── system.generator.ts
    │       ├── star.generator.ts
    │       ├── planet.generator.ts
    │       └── points/
    │           ├── spiral.generator.ts
    │           └── cluster.generator.ts
    ├── action-submission/
    │   ├── computeAvailableActions.ts
    │   ├── getUncommittedResources.ts
    │   └── validation/
    │       └── ...existing submission validators
    ├── turn-resolution/
    │   ├── resolveTurn.ts
    │   ├── ResolveTurnError.ts
    │   ├── TurnState.ts
    │   ├── TurnState.stub.ts
    │   ├── ResolvedTurnState.ts
    │   ├── TurnContext.ts
    │   ├── TargetableEntity.ts
    │   ├── MonotonicIdFactory.ts
    │   ├── state/
    │   │   ├── ResolutionPlayer.ts
    │   │   ├── ResolutionPlanet.ts
    │   │   └── ResolutionFleet.ts
    │   ├── phases/
    │   │   └── ...existing phase resolvers, including placeholders
    │   └── effects/
    │       ├── Effect.ts
    │       ├── EffectFactory.ts
    │       ├── EffectPool.ts
    │       ├── EffectError.ts
    │       ├── EffectJson.ts
    │       ├── resolveTargetId.ts
    │       └── implementations/
    │           └── ...existing effect implementations
    ├── test-ruleset/
    │   ├── TestRuleset.ts
    │   └── action-definitions/
    │       └── ...existing deterministic test content
    └── testing/
        └── createSeededRng.ts
```

## Model file contract

For each concrete domain model:

- `X.ts` owns the named `X` type and `XSchema` Zod schema. Keep the schema output and type aligned; preserve existing brands and runtime constraints. Reuse scalar schemas rather than repeating constraints.
- When companion methods exist, export a value object also named `X` from that file. Its methods construct, parse, or perform small intrinsic operations on `X`. Existing factories retain their companion-object shape. A model with no useful companion methods needs no empty object.
- `X.stub.ts` owns reusable test-data factories for that model. Add missing builders for concrete models as they are extracted; build scalar values through their existing parsers/constructors. Do not introduce fake runtime factories for abstract interfaces solely to satisfy the tree.
- Keep meaningful tests beside the definition or behavior they exercise. Production modules never import `.stub.ts`, `.mock.ts`, or test framework code.
- Use named, direct imports. If a type and companion object share a name, import `X` once; it can be used in both positions. Do not rename its type or introduce namespace imports.

Expected failures remain values. Use `typedParse` for trusted construction when failure is an internal invariant violation, and `safeTypedParse` for handled failures, from `@guillaume-docquier/tools-ts/schemas`. Parse unknown input at its boundary and do not bypass constrained schemas with branding assertions. Preserve narrow variant return types where constructors already expose them.

Read [ADR-017](../decisions/017-stubs-and-mocks.md), [ADR-027](../decisions/027-effect-definition-schemas-validate-domain-data.md), and [ADR-028](../decisions/028-require-type-safe-construction-of-zod-parsed-values.md). ADR-028 currently describes an obsolete package-local parser path and inconsistently spells the safe helper; the live utility exports are `typedParse` and `safeTypedParse` from tools-ts. Flag and reconcile this documentation mismatch when implementing.

### Companion method example

This illustrates the required public shape using existing Effect Outcome concepts. It is documentation, not an implemented schema change.

```ts
// domain/actions/EffectOutcome.ts
import { z } from "zod"

/**
 * A recorded, normal result of resolving an effect.
 */
export type EffectOutcome = Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>

export const EffectOutcomeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RESOLVED"), result: z.string() }),
  z.object({ type: z.literal("PREVENTED"), reason: z.string() }),
]) satisfies z.ZodType<EffectOutcome>

export const EffectOutcome = {
  /**
   * Construct an outcome for an applied effect.
   */
  Resolved({ result }: { result: string }): Extract<EffectOutcome, { type: "RESOLVED" }> {
    return { type: "RESOLVED", result }
  },

  /**
   * Construct an outcome for an effect prevented by normal game events.
   */
  Prevented({ reason }: { reason: string }): Extract<EffectOutcome, { type: "PREVENTED" }> {
    return { type: "PREVENTED", reason }
  },
} as const

// One named import supports both usages:
// import { EffectOutcome } from "shared/domain/actions/EffectOutcome.ts"
const outcome: EffectOutcome = EffectOutcome.Resolved({ result: "Fleet built" })
```

These factories return typed records directly because this example has no constraints beyond its literals and string fields. A constructor for a constrained/branded model must retain its runtime parsing.

A companion method is a member such as `EffectOutcome.Resolved` or `Ruleset.safeCreate`. An exported standalone `createEffectOutcome` or `resolveFleetMovement` is not that pattern.

Test-data builders are a deliberate exception in the separate stub file, following ADR-017:

```ts
// domain/actions/EffectOutcome.stub.ts
import { EffectOutcome } from "./EffectOutcome.ts"

/**
 * Build an applied outcome with test-specific text.
 */
export function createEffectOutcomeStub({ result = "Effect applied" }: { result?: string } = {}): EffectOutcome {
  return EffectOutcome.Resolved({ result })
}
```

## Domain admission rule and flags

**Raise a flag before moving an existing standalone production function alongside a domain model.** Record its source path, signature, dependencies, and purpose, then recommend its behavioral home or a justified intrinsic companion operation. Ask for a decision when ownership remains ambiguous. Do not silently move it or hide a gameplay algorithm inside a same-named object to satisfy the syntax.

The companion pattern is necessary for additional public model operations, but it does not make every operation suitable for the domain. A `Fleet.resolveMovement` method that runs turn simulation still belongs with resolution.

Private callbacks used exclusively to implement Zod refinements are schema implementation, not an additional model API. Inventory these explicitly and keep them private. Existing Ruleset reference checks and Action Definition target-slot compatibility checks may remain with their schemas. Standalone stub factories stay in `.stub.ts`; they do not justify standalone production helpers in model files.

| Existing code                                                              | Target ownership                    |
| -------------------------------------------------------------------------- | ----------------------------------- |
| `Ruleset.create` / `safeCreate` and schema integrity callbacks             | `domain/ruleset`                    |
| Effect Definition `.create` methods and schemas                            | `domain/ruleset/effect-definitions` |
| Ownership constraint definition, factory, and supported-target metadata    | `domain/ruleset/target-definitions` |
| `EffectOutcome.Resolved` / `.Prevented`                                    | `domain/actions`                    |
| `computeAvailableActions`, `getUncommittedResources`                       | `action-submission`                 |
| `validateActionDefinition` for a submission against its selected Ruleset   | `action-submission/validation`      |
| `evaluateOwnedBySubmittingPlayerConstraint`                                | `action-submission/validation`      |
| Galaxy generators and home-planet assignment                               | `galaxy-creation`                   |
| Movement, costs, fleet building, phase ordering, and engine lookup helpers | `turn-resolution`                   |
| Authentication, transactions, locks, persistence, and API DTO assembly     | Backend                             |
| Icons, display labels, action rules text, and rendering geometry           | Frontend                            |

### Coordinate split

The existing backend coordinate files mix types/schemas with standalone functions. Split them rather than moving whole files:

| Definition/schema                           | Calculation                              |
| ------------------------------------------- | ---------------------------------------- |
| `domain/world/stars/StarCoordinates.ts`     | `galaxy-creation/toStarCoordinates.ts`   |
| `domain/world/planets/PlanetCoordinates.ts` | `galaxy-creation/toPlanetCoordinates.ts` |
| `domain/world/planets/OrbitCoordinates.ts`  | `galaxy-creation/toOrbitCoordinates.ts`  |

`toStarCoordinates` uses generation settings; orbit conversion calculates distance and units. Those calculations remain behavioral functions. Remove database-table type dependencies from coordinate definitions, preserving their representations and existing parsing behavior. Creating or tightening schemas must not change the existing coordinate format or acceptance rules silently.

## Dependencies and model boundaries

- `domain` may depend on other domain definitions, Zod, and relevant tools-ts utilities. It must not depend on other shared behavioral folders, either app, databases, network clients, React, Express, tRPC, or ambient time/randomness.
- Galaxy creation, action submission, and turn resolution consume domain definitions. Enforce the one-way boundary in `boundaries.ts`, including type-only imports.
- Keep direct public subpath imports and an explicit package export surface. Do not add a root barrel that loads all definitions or resolvers.
- Keep source-only native Node/browser compatibility and erasable TypeScript syntax. Do not add a package build.
- Keep application inputs, response DTOs, repository Models, private Rows, and frontend interaction/rendering types with their consumers. Sharing a noun does not require identical shapes.
- Preserve the frontend's `@api-types` contract imports and backend worker isolation under [ADR-007](../decisions/007-code-sharing.md) and [ADR-022](../decisions/022-frontend-api-contract-types.md).
- The engine's slim Player/Planet shapes and mutable Fleet working state become explicitly owned resolution projections. Fields such as `arrivedAtTick`, plus `TurnState`, `TurnContext`, and diagnostic `EffectJson`, stay with resolution. Reuse domain fields where their meaning matches; preserve existing mutation behavior.
- Move domain vocabulary currently stored under backend `lib/db` (for example Alias, PlanetBiome, PlanetSize, PlayerColor, and statuses) into its owning domain module. Keep Drizzle column factories and enum/storage mappings in the backend.
- Keep the Standard Ruleset backend-owned. Keep the independent Test Ruleset usable by shared tests and backend seeding. Preserve their values and identities.

## Implementation sequence

1. Inventory source types, schemas, stubs, companion methods, schema-private callbacks, and standalone functions. Map each to its target. Raise the standalone-function flags and canonical-model ambiguities before moving those pieces.
2. Rename `packages/game-rules` to `packages/shared`; change the manifest name, workspace dependencies, public imports, and private `#game-rules` alias to `#shared`. Update the pnpm lockfile through pnpm. Carry over native-runtime configs and scoped instructions.
3. Extract leaf definitions first: IDs, names, enums, resources, and coordinate types. Keep backend database mappings consuming them. Extract the reviewed concrete world, identity, player, game, and turn models with schemas and colocated stubs.
4. Move the Ruleset definition hierarchy, action lifecycle data, and outcomes. Preserve companion factories and schema invariants. Update engine projections and consumers without merging API or repository shapes into the domain.
5. Move deterministic galaxy creation and generators into the behavioral folder; split coordinate calculations as above. Adapt imports and error handling to existing rules without changing outcomes or introducing hidden dependencies.
6. Update backend/frontend runtime imports, scripts, testing imports, TypeScript configuration, boundary lint rules, CI jobs/coverage paths, and Railway watch patterns. Both apps currently watch `packages/game-rules/**`; both must watch `packages/shared/**` after the rename.
7. Update affected package/root instructions, glossary routing links, architecture docs, and ADR references so the documented package ownership matches the code. Do not mark planned gameplay systems implemented through this refactor.
8. Run the required checks and inspect the final diff for behavior, API, schema, and deployment changes. Report deliberate changes explicitly; unexpected changes are a flag.

Use `rg` to find old package references across source, scripts, configs, CI, deployment, and docs. Review historical references rather than mechanically rewriting every occurrence. Do not leave runtime imports or live configuration referring to the old package.

## Completion and verification

- One package named `shared`, with the agreed sibling domain categories and no loose source-root files.
- Concrete extracted models have aligned types/schemas, colocated stubs, and only approved companion operations.
- Every standalone function encountered has been classified; flagged functions have not been silently absorbed into domain files.
- No domain-to-behavior/app dependency, no production-to-stub dependency, and no namespace/barrel API.
- Coordinate generation, submission validation, and resolution behavior remain in their behavioral folders.
- Application contract/projection boundaries, Standard/Test Ruleset content, and persisted/API representations are preserved.
- CI, coverage, Railway watches, imports, package tooling, and documentation use the correct package paths.

For implementation verification, follow the current scoped `AGENTS.md` instructions after updating their package names. On native Windows use the prescribed split root checks, `pnpm --filter shared checks`, backend checks with the required concurrency execution settings, and split frontend typecheck/build/Storybook/E2E checks. Do not start Vite or Storybook for the user.

Relevant manual checks are lobby creation/start, galaxy and planet coordinate display, action target selection/affordability, fleet views, readiness, and turn processing. Inspect both Railway watch patterns and CI/coverage configuration. Do not change environment-variable values.

For a documentation-only update to this plan, follow [docs/AGENTS.md](../../AGENTS.md): run oxfmt with write on changed Markdown and `git diff --check`; do not run application checks.
