# Prototype 1 experiment log

For each decision, ambiguity, finding, or problem, add an entry under the affected increment. Include the evidence, the action taken, the reason for it, and the observed result. Use local file links. Preserve failed attempts and record what allowed work to continue.

## Setup

The epic lists 28 increments. Steps 03a and 12a extend the original sequence of 26. The [checklist](PROGRESS.md) preserves the epic's order.

Turn resolution currently has an empty function body. Both empty-turn properties passed, and Stryker produced HTML and JSON reports with zero production mutants. A temporary arithmetic function and its test confirmed that the same configuration detected and killed both generated mutants. The probe was removed and the baseline reports were regenerated.

## 01 · Assign home worlds

The existing generator selects the nearest system to a random target. The local description changes its Gaussian noise. Keep that distinction. Sample the target radius uniformly from 10 to 13 LY and its offset uniformly from −5° to +5° about each equally spaced bearing, then select the nearest unused system with an eligible planet. An actual star may lie outside the target band. Keep the procedural scale and seeded assignment. The source provides the galaxy center for this increment. Sol supplies the center in 02.

The existing ownership rule assumes enough planets. Revise its precondition to enough distinct systems with eligible planets. Retain the empty-player, grid-cell, and galaxy-boundary rules. Area counts usable spaces, including the center. The assignment adds these observable rules beside createGalaxy.

- GC-PLNT-0003. When each supplied player can start in a separate system with a planet of area at least three, each player owns exactly one planet and all other planets are unowned.
- GC-SYS-0005. When a match starts with 1–16 players, each player’s home planet belongs to a different system from every other player’s home planet.
- GC-PLNT-0006. When a player receives a home planet, its area provides at least three usable spaces including the center.
- GC-SYS-0007. When home systems are assigned, each home occupies the nearest still-eligible system to its placement target, sampled at a uniform radius of 10–13 LY from the galaxy center and a uniform offset of −5° to +5° from its evenly spaced bearing.

Git status in the sandbox failed to access the linked worktree. A scoped elevated status read confirmed a clean experiment branch tracking its remote. Use scoped elevated shell operations for writes in this worktree.

Independent acceptance on the candidate exercised all 16 player counts with eight seeds. All 1,088 players received one planet of area 3–11 in a distinct system. Every other planet was unowned. Replaying the underlying random draws gave the expected uniform offsets and radii for every assignment. The chosen star was always the nearest unused eligible system, including 249 stars outside the target radius band. The eight empty-player galaxies matched the complete baseline galaxies byte for byte when serialized (587–634 stars and 2,954–3,204 planets).

In Chromium, the solo creator and both multiplayer participants each found one home through Galaxy and Planets. They followed its coordinates, read its area and owner, and reloaded the same planet profile. Each participant saw the other player's home as an opponent system. The existing Planets navigation test timed out looking for its previous seeded coordinate, 43:67:20. The independent check found the new multiplayer homes at 54:00:45 and 46:90:05. The implementer received both coordinates to update the fixture.

At final implementation commit `637336de`, the independent 128-game generation check passed again. GC-0008 matched the pre-change map digest across all eight seeds. Chromium passed all eight checks on `a0f6e159`, including the corrected Planets fixture. The only file changed in `637336de` was the scale test. In the browser, solo Alice reopened planet 686188 at 46:90:35 with four slots. In multiplayer, Alice reopened planet 654173 at 54:00:45 and Bob reopened planet 915398 at 46:90:05, each with three slots. The Planets table exposes aliases and coordinate links more clearly than the small markers at default map zoom. Forced reloads logged turn-state subscription errors during navigation. All profiles and ownership labels restored, and the browser runner exited 0.

## 02 · Sol and public coordinates

The existing coordinate formatter rounds orbital radii to whole AU. Venus and Earth would share an address. Preserve existing public addresses where possible and give the Solar System planets distinct addresses that can round-trip through body selection. Keep physical orbital radii independent of address formatting. Use circular orbits of 0.387, 0.723, 1.000, 1.524, 5.203, 9.537, 19.191 and 30.069 AU from Mercury through Neptune. These rounded mean distances suffice for the prototype. Draw the Sol replacement from generated systems within 5 LY inclusive. Home placement now measures from the Sun and excludes Sol so the delivery site remains neutral. Preserve the scale and the existing public coordinate rules. Outcome awaits implementation and independent verification.

## 05–09, 12–15, 17, 20–21 · Prototype tuning

The epic leaves prices, income, thrust, mass and target open. Use provisional shared tuning values so a solo player can fund an opening colony and a haul within the 100-turn limit. Give each player 100 starting credits and each operating trade center 10 credits per turn. Construction costs are 30 for a trade center, 40 for a shipyard, 15 for a mine and 25 for a refinery. A shipyard charges 25 for a transport, 15 for a scout and 35 for a colony ship. The home grants are free. Reserve a paid order’s full price during planning and charge it once on resolution. Cancellation releases the reservation.

Use a shared speed scale of 1 with thrust and empty mass of 64 and 4 for transports, 16 and 0.25 for scouts, and 64 and 4 for colony ships. Metal and alloy each have mass 1. Empty speeds are 4, 8 and 4 LY per turn. The first item reduces scout speed by about 55% and transport speed by about 11%. All four transport slots filled give about 2.83 LY per turn.

Set the swarm target to 12 times the actual player count at match start. A solo player can finish with two alloys, twelve metals, or a combination. Extra deliveries on the same turn count. Verify these values in the integrated supply chain and record any adjustments before accepting the run.

## 01 · Procedural scale coverage

The verifier found identical empty-player galaxies before and after home assignment for eight seeds. The implementation team identified topology mutations that would change public galaxy scale. Add GC-0008 with this wording: “With the default match settings, the returned procedural galaxy contains approximately 700 star systems and 3,000 planets.” Check representative default seeds through createGalaxy and use the existing seed 1234 snapshot as a regression anchor. Counts may vary between seeds. The observed 621 systems and 3,155 planets for that seed satisfy the local acceptance criterion.

## 02 · Assigned behavior

Revise GC-SYS-0007: When home systems are assigned, each home occupies the nearest still-eligible non-Sol system to its placement target, sampled at a uniform radius of 10–13 LY from the Sun and a uniform offset of −5° to +5° from its evenly spaced bearing.
GC-SYS-0009: When a prototype galaxy is generated, it contains exactly one Sol system, selected with seeded randomness from systems within 5 LY of the galaxy center and replacing the selected system at its original position.
GC-PLNT-0010: In order of increasing distance from the Sun, Sol contains Mercury (small metallic, 0.387 AU), Venus (small volcanic, 0.723 AU), Earth (small oceanic, 1.000 AU), Mars (small volcanic, 1.524 AU), Jupiter (large gas, 5.203 AU), Saturn (large gas, 9.537 AU), Uranus (medium icy, 19.191 AU) and Neptune (medium icy, 30.069 AU) on circular orbits.
GC-0011: When a galaxy is generated, every star and planet has a distinct public coordinate that identifies that body throughout the match.
Galaxy map: When a player opens the galaxy map, Sol is identifiable by name and the Sun appears orange with a small halo and a radius 1.5 times the ordinary star radius at the same zoom.
System map: When a player opens Sol, they can identify the Sun and all eight planets by their real names, distinct artwork and public coordinates.
Planet art: When a gas planet outside Sol is shown, it uses dedicated gas-biome artwork.

Use the next stable IDs for the map and art entry points. The epic requires unique public addresses for ordinary systems as well as Sol. Distinct art for the nine named bodies and a generic gas-biome image let the player distinguish a familiar body from any other gas planet.

## 01 · Implementation and acceptance evidence

Implementation commits `a0f6e159` and `637336de` apply the home rules and update the deterministic fixtures. The API snapshot changed only the two ownership fields for the old and new solo homes. Its 36 integration tests passed after regenerating the snapshot and again without update mode. The 37 galaxy tests and shared typecheck passed. Oxlint initially rejected two test names, two equality assertions, a generic exception assertion and a mutating reversal. The corrected tests passed lint and the commit hooks.

The first scale check used a per-galaxy lower limit of 525 stars. The unchanged generator gave 522 stars and 2,585 planets for seed 123. The reviewer observed 513–697 systems and 2,561–3,514 planets over 12,000 seeds. The corrected property checks the mean for seeds 123, 1234 and a fast-check seed against a 25% tolerance around 700 systems and 3,000 planets. The existing API snapshot continues to anchor seed 1234.

The first mutation run missed a target whose nearest system has no eligible planet, a collision with an assigned system, and removal of the player-ID sort. The revised placement property replays examples with seeds 5 and 49 and supplies players in reverse order. The final [public mutation report](../../../packages/shared/src/galaxy-creation/.stryker/reports/mutation.html) records 102 kills, three timeouts, 53 survivors and zero uncovered mutants or errors. All three timeouts changed loop progress or workload in spiral generation. The scale property also caught the mutant that enlarges the galaxy radius.

Six public survivors affect home assignment. A [focused mutation run](../../../packages/shared/src/galaxy-creation/.stryker/reports/home-eligibility.json) ran the public properties and the existing home-assignment tests together. It killed 39 of 42 home mutants, including changes to the capacity precondition and handling of preowned planets. Two surviving mutations remove assertions whose inputs are guaranteed by the capacity and eligibility checks. The third changes which of two equally near stars wins, and either satisfies the placement rule. The other 47 public survivors affect the existing names, IDs, attributes and coordinate formats (23), or topology and unused topology-generator arguments (24). Their detailed behavior remains covered to varying degrees by existing focused tests and snapshots. The increment retains their baseline output.
The reviewer cleared 637336de. The verifier repeated generation checks on that commit and covered the identical application code in Chromium. All four local acceptance criteria passed. Increment 01 is accepted.
