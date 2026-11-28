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

## 03 · Planet deposits

Keep the existing biome, size and area ranges since the local description supplies new ranges only for metal. Use independent uniform integer rolls for positive production and deposit, then persist those values. Identify home systems from the completed home assignment. Every planet in all of those systems and in Sol starts at zero, regardless of its biome. All gas planets start at zero as well. For other unprotected planets, the chance depends only on biome. This keeps both attributes useful when choosing a colony and avoids a distance bonus. Follow the existing backend migration workflow. A player reopening a generated galaxy must see its saved values.

## 02 · Ice biome terminology

Use the existing Frozen biome for the local description’s “icy” Uranus and Neptune. It preserves the game’s terminology and both planets can carry their own art. On the system map, retain the Sun’s existing navigation action while exposing its name and public address. The verifier will check these details in the running UI.

## 02 · Independent acceptance

Across 56 seeds, each candidate Sol matched an independent replay of the random index into the original central systems. Its star kept the original position. The 56 matches used 41 public Sun addresses. The greatest observed distance from the galaxy center was 4.903 LY. All 205,309 body positions, addresses and IDs were distinct within their galaxies, and the largest error in the eight circular orbit radii was below 0.000001 AU. Solo and 16-player generation assigned 952 homes outside Sol. Every assignment matched the nearest eligible system to its reconstructed target around the Sun. Using the galaxy center would have changed 920 assignments.

At 1280 × 720, Alice and Bob each used the map to find Sol, select all eight planets, read their sizes, biomes and public addresses, and return through the Sun. Both reopened Earth at 54:18:01 after reload. Jupiter and Saturn displayed Gas. Outside Sol, planet 501396 at 44:88:40 displayed Gas and used its own violet-and-cyan gas artwork. Inspection confirmed nine distinct Solar System images and an orange Sun core of radius 0.75 against 0.5 for ordinary stars, with a translucent halo of radius 3. Two early probe failures came from measuring the halo as the core and reading opacity instead of fill-opacity. Separate measurements confirmed the rendered values.

Initial screenshots showed small, dim names. The implementation enlarged the persistent Sol label and solar body labels. Both users could then read the names at default zoom and click each inner planet without zooming. An existing Galaxy navigation test selected a star by ordinal position. After Sol generation, that selected a different star 0.031 LY from the Sun. The verifier identified the system that actually contains the two original test planets for the fixture correction.

The final generator matrix and all seven Chromium checks passed on commit 4741395d. The browser suite covered both player accounts and the existing Galaxy and Planets flows. Using a named ordinary star to measure the radius ratio kept the probe valid after Sol moved to the start of the render order. The named fixture system also restored the existing inspector regression. The run exited 0. Forced reloads logged turn-state subscription disconnects while both users could reopen Earth with its original identity and address.

## 02 · Independent review evidence

Across seeds 0 through 127, the public galaxy generator produced one neutral Sun per match in 61 different public grid cells. The Sun lay 0.661–4.974 LY from the galaxy center. All 471,800 star and planet addresses were unique within their own matches. The largest difference between a measured Solar System orbital radius and its specified radius was 0.000000000313 AU. The candidate migration adds the GAS enum value and preserves existing stored biome values and coordinate strings.

## 02 · Reload scenario

At default zoom the verifier could open Sol and select Mercury, Venus and Earth. Reloading Earth’s inline inspector returned to Galaxy, since the system-map selection is local state. Verify 02 persistence by reopening Sol and comparing body identities and coordinates. Increment 03a explicitly owns reopening the selected planet directly on reload from either entry point. This finding supplies its regression scenario.

## 02 · Final diff review

Seed 48 placed Sol and an ordinary star 0.197 LY apart. The first, enlarged Sol hit target covered the ordinary star. The corrected map chooses the nearest star center under the pointer, retains a separate clickable Sol label, and has a browser regression for both overlapping centers. Review of commit `4741395d` confirmed all seven assigned texts and exact matching test names, all ten distinct images, and compatible storage for existing galaxies. All 43 galaxy tests passed independently. The focused mutation report leaves four equivalent or permitted changes: three redundant invariant checks and the choice between equidistant eligible home systems.

## 03 · Assigned behavior

- GC-PLNT-0012. When a galaxy is generated, each planet retains its biome, size and area and has separate integer values for metal production and remaining metal deposit.
- GC-PLNT-0013. When a planet is in Sol or any player’s starting home system, its metal production and remaining metal deposit both start at zero.
- GC-PLNT-0014. When a planet outside those systems is gas, its metal production and remaining metal deposit both start at zero.
- GC-PLNT-0015. When a metallic planet outside those systems is generated, it has a 75% chance of a deposit. On a successful roll its remaining deposit is a uniform integer from 10 to 20 and its production is an independently sampled uniform integer from 2 to 4. Otherwise both values are zero.
- GC-PLNT-0016. When a planet of any other non-gas biome outside those systems is generated, it has a 25% chance of a deposit. On a successful roll its remaining deposit is a uniform integer from 5 to 15 and its production is an independently sampled uniform integer from 1 to 3. Otherwise both values are zero.
- Planet read API. When a player reads a saved planet, the API returns its stored metal production and remaining deposit and omits the former metal, fertility, fuel, energy and maximum population fields.
- Planet list and inspector. When a player opens the planet list or inspects a planet, they can distinguish metal production per mine per turn from the remaining deposit. The removed attributes have no columns, sort choices or inspector entries.

## 02 · Implementation and mutation evidence

Commit `4741395d` adds Sol, Sun-centered homes, a Gas biome and ten transparent sprites. The PostgreSQL migration adds the Gas enum value. Seed 1234 keeps all 621 public star positions and replaces the five planets at 54:18 with eight. The API snapshot comparison found no changes to the other 620 stars. Other planets retained their names, IDs, sizes, areas, positions and addresses. The fifth biome changes biome rolls and their dependent attributes. Home selection moved one owner's ID between two planets.

The first snapshot update stopped at an obsolete metallic-planet fixture. Comparing its persisted values confirmed the new Frozen roll. After correcting the sample, all 36 API integration tests passed both with and without snapshot update. The final shared suite passed 43 tests and the frontend passed 77 render and interaction tests. Both package typechecks and scoped lint passed. An earlier frontend typecheck included a temporary browser probe with incompatible DOM types. The verifier removed it after acceptance.

The [committed public mutation report](../../../packages/shared/src/galaxy-creation/.stryker/reports/02-sol.html) lists 195 mutants. It recorded 146 kills, six timeouts, 43 survivors and zero uncovered mutants or errors. All coordinate formatters and the public entry point had zero survivors. Eleven survivors affect Sol or home assignment. The [focused boundary run](../../../packages/shared/src/galaxy-creation/.stryker/reports/sol-boundaries.json) included exactly-at-five LY, no-candidate, fully occupied, preowned and neutral-Sol fixtures. Of 67 mutants it killed 60 and timed out three. Its four survivors remove three assertions whose inputs are guaranteed earlier, or select the other system in an exact distance tie. The other 32 public survivors affect ordinary name or ID generation, attribute selection and topology details outside the seven assigned rules. The integration snapshot and focused generators also exercise those paths. Both mutation commands exited 0.

## 02 · Acceptance

Accepted 4741395d. Independent verification passed all six local criteria and the assigned map, address and artwork requirements on the reviewed commit. The team fixed labels and overlapping hit targets before the final seven Chromium checks passed. The final mutation run had zero uncovered mutants. The implementation report documents the survivor dispositions.
