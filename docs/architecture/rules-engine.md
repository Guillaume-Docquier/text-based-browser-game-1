# Rules Engine

The Rules Engine is the persistence agnostic engine to resolve game turns.

The Rules Engine works by reducing Actions into a series of Effects that are resolved in Phases.

The Actions are a data driven composition of Mechanics, where each Mechanic maps to an Effect during resolution. This allows creating (almost) any kind of Action for free as long as they use existing Mechanics.

Because the Rules Engine is data driven and persistence agnostic, we can play games entirely offline in the terminal through the `pnpm playtest` command.

## Validation

All action submissions are validated before any resolution starts. Any invalid action aborts the turn. Every action is expected to have been validated already on submission using the same validators.

## Turn Context

The Turn Context is what every Effect will work on. It notably contains the Turn State to mutate and the Effect Pool to draw Effects from.

### Turn State

Every Effect mutates the Turn State, for simplicity and performance.

### Effect Pool

Effects are added and picked from the Effect Pool.

Effect resolution in the Effect Pool is handled by the Effect base class to ensure every call to `effect.resolve()` is recorded.

## Pipelines

The Rules Engine is structured as a series of generic pipelines:

- turn pipeline
- validation pipeline
- phases pipeline

### Turn Pipeline

The turn pipeline is the highest level. It orchestrates the high level concepts within a turn:

- Initialization
- Action Validation
- Effect Creation
- Effect Resolution Phases
- Invariant Checks
- Assembling the final state

### Validation Pipeline

The validation pipeline handles validating action submissions for any data that could be corrupted or inconsistent:

- Action Definition Mappings
- Action Target Mappings
- Action Costs Eligibility

### Phases Pipeline

The phases pipeline handles Effect resolution:

- Pay Costs
- Movement
- Combat
- Planet Activities
- Colonization
- Income
- Victory

Effects can be added to the Effect pool through other Effects during the Phases.

After all phases are done, we expect all effects to have been resolved.
