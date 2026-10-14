## Issue

N/A

## Description

Players can split a stationary Fleet into orders within its available Strength and the Ruleset's range, speed, and Resource limits. Journeys advance across Turns without resubmission and keep their initiating Action occupied until the arrival effects finish.

Attack Move applies normal Assault after movement and Fleet Build. Colonize Planet and Colonize Here claim an Unclaimed Planet after Combat, cost 25 Influence once, and consume 20 current Strength: 35 leaves 15, while 20 disappears. Combat losses, destruction, or an earlier claim prevent Colonization and release the Action after resolution. Shared eligibility handles the same selections and cumulative reservations at frontend, API, and resolution boundaries.

AI authored the implementation, tests, and associated documentation. Quality control uses separately commissioned planners, implementers, independent test reviewers, and independent code reviewers, followed by the orchestrator's acceptance before each increment commit.

## Screenshots

Authenticated public gameplay captures from the completed full browser run. Fixed-seed home ownership binds player roles dynamically; in the prevention capture Bob colonizes and Alice attacks.

A Fleet of Strength 35 in transit, with Strength 15 remaining at its source:

![Colonization journey and remainder](https://raw.githubusercontent.com/Guillaume-Docquier/text-based-browser-game-1/9fb5a3946bfa5ba9e9d033a88c7f4c633d84a564/.agents/experiments/fleet-operations/evidence/increment-03-implementer-r1/screenshots/c3-23-colonization-pending-35-remainder-15.png)

Alice owns the claimed Planet and retains 15 Strength there:

![Colonized Planet](https://raw.githubusercontent.com/Guillaume-Docquier/text-based-browser-game-1/9fb5a3946bfa5ba9e9d033a88c7f4c633d84a564/.agents/experiments/fleet-operations/evidence/increment-03-implementer-r1/screenshots/c3-23-colonization-owner-alice.png)

After Assault, Bob retains 19 at the target and 15 at home; Alice retains 84 at home:

![Surviving Fleets after Assault](https://raw.githubusercontent.com/Guillaume-Docquier/text-based-browser-game-1/9fb5a3946bfa5ba9e9d033a88c7f4c633d84a564/.agents/experiments/fleet-operations/evidence/increment-03-implementer-r1/screenshots/c3-04-colonization-prevented-fleets-bob19.png)

The target stays Unclaimed:

![Prevented Colonization](https://raw.githubusercontent.com/Guillaume-Docquier/text-based-browser-game-1/9fb5a3946bfa5ba9e9d033a88c7f4c633d84a564/.agents/experiments/fleet-operations/evidence/increment-03-implementer-r1/screenshots/c3-04-colonization-prevented-unclaimed-target.png)

## Deployment

This branch adds nullable JSONB columns `actions.selected_inputs` and `fleets.movement` through the Drizzle migration. The existing API startup applies migrations before seeding content. Existing disposable prototype games created with older Action payloads may need resetting before continuing them; no backfill is included. No environment or infrastructure changes are required.
