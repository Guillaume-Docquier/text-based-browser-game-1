# Rules engine proof of concept

An isolated alternative to the current Effect Definition / Effect class approach.
The frontend, backend, persisted Ruleset model and current Test Ruleset do not use
this slice. This is an experiment, not an adopted architecture.

## Start here

- `test-ruleset/actions/move-fleet.ts`: data-only actions with mechanic-local slot bindings.
- `mechanics/moveFleet.ts`: engine-owned target contract, parameter schema, mandatory requirements and resolver.
- `definitions/defineMechanic.ts`: how compilation captures a typed resolver behind a uniform runtime interface.
- `tests/composition.test.ts`: two fleets sharing a destination, repeated mechanics, shared targets across different mechanics and player targets.
- `tests/ruleset-parity.test.ts`: direct comparison with the current engine and Test Ruleset.

## Author, compile, submit, execute

```ts
import { Result } from "@guillaume-docquier/tools-ts"
import { compileRuleset } from "shared/rules-engine-poc/compiler/compileRuleset.ts"
import { executeActions } from "shared/rules-engine-poc/runtime/executeActions.ts"

// rawRuleset may come from JSON; state and submissions use existing domain types.
// createRng must produce a fresh deterministic sequence for this game's turn.
const compilation = compileRuleset(rawRuleset)
if (Result.isFailure(compilation)) {
  // compilation.error contains paths into the original ruleset and explanations.
} else {
  const execution = executeActions(compilation.value, state, submissions, createRng)
  if (Result.isSuccess(execution)) {
    // execution.value.state is the updated copy; the input state is unchanged.
    // execution.value.outcomes groups resolved/prevented results by submission.
  }
}
```

Actions declare named targets, resource costs, additional constraints and mechanic
invocations. An invocation explicitly maps each mechanic slot to an action target
and supplies parameters:

```ts
{
  targets: { firstFleet: "fleet", destinationPlanet: "planet" },
  constraints: [{ kind: "strengthAtLeast", fleet: "firstFleet", value: 10 }],
  costs: [{ quantity: 1, resourceType: "FUEL" }],
  mechanics: [{
    use: "moveFleet",
    bind: { fleet: "firstFleet", destination: "destinationPlanet" },
    parameters: { speed: 1 }
  }]
}
```

A player's submission separately maps `firstFleet` and `destinationPlanet` to
actual entity IDs. All mandatory slots must be bound, including unused action
targets in the submission. Sharing a named target shares the entity; distinct
names do not imply distinct entities unless a `different` constraint requires it.

## Type safety and runtime compilation

`defineMechanic` infers resolver inputs from its target declarations and parameter
schema. Its requirements receive references tagged with their entity kinds.
`defineAction` derives compatible action target names and parameter input types
from the same registry. `NoInfer` prevents invalid references from widening the
target declarations. Type tests exercise valid inference and expected compilation
errors for wrong kinds, missing bindings, unknown targets and malformed parameters.

Untrusted JSON gets structural parsing, semantic checks for bindings and
constraint references, then per-mechanic parameter parsing. Errors carry original
field paths. A branded `CompiledRuleset` records success; runtime entrypoints accept
that compiled form.

Compilation creates a closure for each invocation. Its parameters and validated
references remain correlated with its resolver's generic types, even when the
runtime registry is heterogeneous. Two localized mapped-record assertions bridge
TypeScript's inability to prove dynamic record construction; both follow explicit
checks and have safety comments. Entity lookup itself needs no assertion.

Parameter schemas reuse `QuantityOfResource` and tools-ts positive/integer number
schemas. Fleet build strength must be a positive integer; movement speed and
resource quantities must be positive and may be fractional. Costs use the same
spending mechanic as authored spending invocations. Cumulative affordability
includes both, without allowing future Income to finance Pay Costs.

## Evaluation and execution

The predicate vocabulary is ownership, minimum fleet strength, distinct entities
and fleet-to-planet range. Partial selections yield satisfied, violated or
undetermined. Missing selections defer evaluation; selecting an unknown ID
violates it. The same evaluator validates complete submissions.

Execution uses `Fleet`, `Planet`, `ResolutionPlayer`, `Resources` and their domain
IDs. There is no standalone Player entity type in shared; `ResolutionPlayer` is
the existing player-and-stockpile domain projection.

Initial validation checks action pool membership, one use per player/opportunity,
target kinds, all compiled constraints and combined affordability. Execution
copies state and creates a fresh RNG from the supplied factory. All costs resolve
before movement, fleet build, Income and victory. Invocation order breaks ties
within a phase. Mechanic requirements are checked again against evolving state;
a failed requirement prevents that mechanic after costs have been paid.
Action-authored constraints currently apply to the initial submission snapshot.

Any execution Failure discards the copied state and outcomes. The caller retains
the original state and supplies a fresh deterministic RNG on retry.

## Comparison scope and limitations

The independent experimental Test Ruleset reproduces all eleven current actions,
their names, tiers, pool IDs, starting resources, costs and parameters. Parity
tests compare effective ownership constraints and resulting player/fleet/winner
state with the current engine, including new fleet identity/name, reinforcement,
arrival, merging and movement continuation.

It intentionally preserves current per-submission movement and does not make
stationed-only or range checks mandatory. Automatic continuation, action locking,
combat and colonization are not in the current Test Ruleset and are not added.
Range is available as an author-defined predicate in the composition examples.

The engine-owned phase order is preserved for implemented mechanics. Empty combat,
planet and colonization phases are omitted. The current engine's internal
`arrivedAtTick` field and exact outcome prose are not reproduced; domain fleet
state and outcome meaning are the comparison boundary. Like the current engine,
a merge leaves a zero-strength fleet in the working collection.

Compiled closures are not serializable. Persist authoring data and compile it
again when loading. Versioning, a general constraint solver, production visibility,
refund policies, action authorization beyond pool membership and a full turn
scheduler remain outside this spike. Treat compiled values as immutable through
their typed API; this is not a hardened JavaScript sandbox for untyped callers.

## Verification

From the worktree root:

```powershell
pnpm --filter shared test src/rules-engine-poc
pnpm --filter shared typecheck
```

The authoring tests require typechecking: Vitest alone does not verify
`@ts-expect-error` directives.
