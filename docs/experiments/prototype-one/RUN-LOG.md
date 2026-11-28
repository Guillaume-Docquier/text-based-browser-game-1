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

## 03 · Comparing planets in existing games and lists

The current Planets list only contains owned planets. At startup, all its rows would therefore show zero production and deposit. Keep the current owned-planets default and give the player an All planets choice in the existing list, using the current navigation, sorting and pagination patterns. Add this list requirement: “When the player opens Planets, their owned planets are shown first. Choosing All planets lets them compare the available metal production and remaining deposit of owned and unowned planets in the same list.” This makes the local comparison task possible and will also respect player-specific visibility in 10.

Preserve saved games while removing the five legacy columns. During migration, use the saved starting ownership and Sol where present to protect those systems, and use the same biome probabilities and ranges for existing unprotected planets. A match created before Sol existed keeps its existing geography. Compute migrated metal values once and preserve them on later reads.

## 04 · Surface order and placement

Use the center as the first usable site. Start each new hex ring at its easternmost site and traverse clockwise in the player’s view. Add a partial outer ring in the same order. The planet’s area gives the total count including the center. This makes partial surfaces reproducible and keeps future build selections stable across reloads. Store a building’s occupied site with the building and enforce one building per site, plus a single command center per planet. The full planet view should give each selectable site a distinguishable accessible name and show the selected site and building together.

## 03 · Independent generator and migration review

Across seeds 0 through 63 and player counts 1 through 16, 3,229 planets in Sol or home systems and 38,855 other gas planets all had zero production and deposit. Of the eligible metallic planets, 29,378 of 39,164 had a deposit. The other eligible biomes had 29,151 deposits among 116,158 planets. All 33 possible deposit/production pairs occurred in each range. The generator had no distance input to the rolls. The migration selects protected systems by both match and star, draws presence once per planet and stores two separately sampled integers on success. The packaged backfill and its maintained SQL source matched byte for byte.

## 03 · Independent acceptance

In 192 games covering solo and 16-player starts across 96 seeds, the verifier checked 588,616 planets. All 8,137 planets in home systems, 1,536 Sol planets and 114,962 other gas planets had zero production and deposit. Among eligible planets, 74.83% of metallic planets and 24.89–24.95% of each other non-gas biome had deposits. Replaying the underlying random sequence reproduced each planet’s chance roll and separate uniform production and deposit draws across all distances. Every allowed production/deposit pair occurred in each eligible biome, including the endpoints.

The verifier upgraded a disposable PGlite database from the three previous migrations. It held 30,000 planets in two games with overlapping star IDs and different home systems. All retained attributes and owners were preserved, the obsolete physical columns disappeared, and both new columns were non-null integers. All 18,000 protected planets and 2,400 additional gas worlds stayed at zero. The 12,000 outside-home rows included every allowed production/deposit combination. Running the migrator again and reopening the database preserved all values.

Two players inspected both their own and their opponent’s home and a neighboring unclaimed planet in each system, plus Mercury in Sol. All showed zero production and deposit. In All planets they compared a metallic planet at 75:97:10 (4 per mine per turn, 10 remaining) with an oceanic planet at 55:14:15 (1 per turn, 15 remaining). With one mine and no further changes, the first would empty on turn three of production and the second on turn fifteen. Both inspectors agreed with the list before and after reload. A separate PostgreSQL read matched the two players’ complete 3,158-planet API values and confirmed removal of the old columns.

The implementation commit bcbce642 passed the 192-game generation matrix and the populated legacy migration again. The final revision 14dc5d9f changed only the cutoff test. A fresh 192-game run on that revision passed, and the tested browser code and migrations were identical. All seven Chromium checks passed in 42.8 seconds with exit 0. For each account the default list showed exactly the two owned planets, sorted by owner; All planets showed 3,158. Sorting remaining deposit ascending and descending placed 0 and 20 first, respectively. The two saved API responses and four reloads matched all 3,158 rows from PostgreSQL. The temporary test and migration database were removed.

## 03 · Default list membership

The verifier found that the existing default lists every player’s owned planets in the current sort order. Preserve that behavior. Revise PLST-0002 to: “When the player opens Planets, the default list contains the planets owned by any player. Choosing All planets lets them compare the available metal production and remaining deposit of owned and unowned planets in the same list.” The default controls membership. Existing sorting determines the order. Increment 10 must derive known ownership and values from the reader’s permitted observations.

## 07 · Order cutoff and reservations

Use the existing turn’s authoritative open/closed boundary. The deadline or the last ready player closes planning for everyone. While planning remains open, readiness is reversible and an owner can cancel their submitted order. A ready player’s cancellation must not require any other player’s response. Once planning closes, worker queue time grants no extra opportunity to submit or cancel. Validate turn number, time and open state under the project’s turn lock. The chosen reservation model keeps the settled balance intact during planning and shows the full cost reserved for the owner. Resolution charges once; cancellation releases the full reservation immediately.

## 03a · Assigned behavior

- When a player selects a planet on the system map or through the planet list, the same full planet view opens in the main play area for that game and planet.
- When a planet view opens, the player can identify the planet by name and coordinates and inspect its available ownership, biome, size, area, metal production and remaining deposit alongside space for its surface.
- When a player reloads a planet view or returns to its address, the same game and planet reopen.
- When a player chooses to return to the system from a planet view, the containing star system opens.

Use the existing game and planet identifiers in a durable route. Preserve current list scope, stable artwork and public address semantics. The player needs an explicit way back to the containing system after a direct visit. The next increment supplies the hex surface, so the current layout needs room for it without invented surface data.

## 03 · Final diff review

The final review covered both migration paths, source and stored planet fields, list filtering and numeric sorting, inspector values, and all eight requirement texts and their named tests. The 48 galaxy tests passed independently at `3e3263d1`. The cutoff fixtures now use the existing generator stub. Seeds 42 and 43 retain the home-placement edge cases after the change in draw order. The [public mutation report](../../../packages/shared/src/galaxy-creation/.stryker/reports/03-deposits.json) counted 179 killed, 49 surviving and two timed-out mutants, with none uncovered. Applying each of the six surviving static deposit configurations separately caused the tests to fail in a fresh process. The [focused home and Sol report](../../../packages/shared/src/galaxy-creation/.stryker/reports/03-home-boundaries.json) left three redundant assertions and a permitted equidistant choice. Review cleared the final commit.

## 03 · Implementation and mutation evidence

Commit `bcbce642` replaced the five legacy planet attributes in generation, storage, reads, sorting and inspection. Deposit generation follows home assignment so the whole starting system of every player is protected. Existing saves receive a one-time migration using their stored home systems and biomes. The default list retains planets owned by any player. Choosing All planets adds unowned candidates. The eight behavior texts have matching automated tests. On seed 1234 the saved match retained 621 star positions and contained 3,158 planets, including 975 with productive deposits.

Commit `14dc5d9f` replaced the inline chance stub with the existing generator fixture for exact 25% and 75% boundary cases. After the generated sequence changed, commit `3e3263d1` refreshed two home-assignment examples. The examples again exercise a nearest system whose planets are too small and a nearest system already assigned to a different player. The final galaxy suite passed 48 tests. Frontend tests passed 79 cases and the two backend integration suites passed 50. Shared, backend and frontend typechecks passed. The stored data, migration and browser comparisons are recorded under independent acceptance.

On `3e3263d1`, `pnpm --filter shared mutation:galaxy-creation` exited 0 after 99 seconds. Its [local report](../../../packages/shared/src/galaxy-creation/.stryker/reports/03-deposits.html) counted 230 mutants, with 179 killed, two timeouts, 49 survivors and zero uncovered mutants or errors. Six survivors replace the static deposit configuration or integer ranges with empty objects. In an isolated source copy the original distribution tests passed. Applying each replacement individually in a fresh process failed those tests in all six cases. The [substitution results](../../../packages/shared/src/galaxy-creation/.stryker/reports/03-static-mutants.json) record the replaced objects and exit codes.

Eleven public-suite survivors concern Sol or starting-home selection. The [focused run](../../../packages/shared/src/galaxy-creation/.stryker/reports/03-home-boundaries.json) added the corresponding generator fixtures and killed 63 of 67 mutants, with zero timeouts, errors or uncovered mutants. Three surviving changes remove assertions guaranteed by earlier checks and the fourth selects the other eligible system at exactly equal distance. The remaining 32 public-suite survivors concern ordinary topology, naming, identifiers and attribute selection. The seed-1234 saved-map snapshot and existing generator fixtures also exercise these paths.

## 03 · Acceptance

Accepted 3e3263d1. The reviewer cleared the final changes and the verifier repeated generation checks at that revision. The final corrections affected only tests. All six local criteria, existing-match migration and the default and All planets views passed. The implementation report records mutation outcomes and survivor dispositions. A typographic apostrophe in the checklist update caused a PowerShell parse error before any write. Correct quoting allowed the update to complete.

## 14 and 17 · Contested claims and pickups

Use the match’s persisted seeded randomness for a fair draw among the valid claimants for each planet or requesters for each item. Choose from a stable ordering independent of submission time. A canceled or otherwise ineligible request is absent from that draw. A single request wins without a contest. Preserve every uncontested item when resolving a partially contested load. This follows the existing deterministic resolution rule and allows a verifier to replay a contest without giving an earlier order priority.

## 04 · Assigned behavior

- When a match starts, each owned home planet has exactly one persisted command center on its center hex, and every unowned planet starts with an empty surface.
- When a planet surface is read in a fresh session or after server restart, each building retains its identity, type, planet and occupied hex.
- When a planet surface is displayed, its area gives its exact number of usable hexes, including the center. The other hexes fill concentric rings nearest first, beginning each ring in the east and continuing clockwise, including partial rings.
- When the player reloads or reopens a surface, when building records arrive in a different order, or when a building occupies an empty hex, all existing hexes retain their positions relative to the center.
- When buildings are stored on a planet, each hex holds at most one building and the planet holds at most one command center.
- When a player opens their home planet, they can distinguish the command center’s dedicated hex artwork from empty sites, inspect the surface and read the planet information in the same view.

The backend starts with the saved home ownership, creates the command centers in the match-start transaction and reads those saved buildings for the planet view. For already-started matches at this stage, the saved owned planets are their homes. Initialize a missing starting command center exactly once and preserve existing identities on further reads or restarts. Check the new API view beside the existing metal requirement. The verifier can use a controlled persisted fixture for building insertion and read order before the construction action arrives in 07.

## 03a · Independent acceptance

At 1280 × 720, selecting Earth on the Sol map and selecting planet 195575 on its ordinary system map each opened a dedicated game-scoped planet address in the main play area. Selecting their coordinates in All planets reopened the corresponding identical address. Earth showed Unclaimed, Oceanic, Small, area 4, production 0 and deposit 0 at 44:76:01. Planet 195575 showed Unclaimed, Metallic, Medium, area 6, production 4 and deposit 10 at 75:97:10. The old details sidebar and system map were absent. A 634 × 384 surface region sat beside the labeled facts. Alice and Bob also opened the same owned home from the default list and saw the same owner alias. Browser Back returned to the list.

Reloading directly after the map selection restored each planet. Separate fresh authenticated browser contexts at 390 × 844 opened the saved addresses and returned to the named containing systems. At phone width the artwork and facts stacked, all values were reachable by vertical scrolling, and the return control worked. Selecting the Sun still returned to Galaxy. An initial probe read the labels together with their values. Reading the definition elements independently corrected the probe and all four setup and player checks passed.

## 03a · Independent review

Both entry points now address the same game-scoped planet route. The full view reads its planet and containing system from the active player view, uses the existing Sol and biome art, displays all seven facts, and gives missing planet IDs a Galaxy exit. The old galaxy query address redirects to the canonical route. The reviewer matched all four requirement IDs and texts with their named tests and independently ran the frontend typecheck. The interactive story originally labeled an ordinary star with generic planet art as Sol. Commit `b12f199a` corrected that fixture to use Rigel. Final diff review found no open issues.

## 03a · Final browser evidence

The independent player flow and the maintained Galaxy and Planets flows passed all eight Chromium checks on implementation commit cfda7067, exit 0. The old planet query-string link redirected to the canonical address and showed the same owner. Final commit b12f199a changed only a Storybook fixture and its camera test. On that revision a separate browser probe opened a valid but absent planet ID, saw Planet unavailable, and used Return to Galaxy to reach the same game. All four setup and fallback checks passed, exit 0. Forced reloads logged turn-state subscription disconnects while the planets and their facts restored successfully.

## 03a · Implementation and verification

Commit `cfda7067` replaced the side panel with a full planet page reached from either the map or the list. Both link to the same game and planet identifiers. The containing system is also addressable, so the return link works directly after a fresh visit. Existing galaxy bookmarks with a planet query redirect to the canonical page. The full view reuses each planet’s map artwork and presents the owner, public coordinates, biome, size, area and separate metal values beside space for the surface.

The four PV requirements have matching automated cases. Seven tracked Chromium checks passed with exit 0, including the original Earth reload scenario, the same planet address via both entry points, browser Back to the list and returning to the correct system after viewing two different planets. The frontend production build, typecheck, lint and all 81 frontend render and interaction tests passed. A cold initial Storybook run reoptimized the router dependency and interrupted unrelated tests. Prebundling that dependency fixed the cold run. Review caught a fictional Sol fixture in the interactive story. Commit `b12f199a` uses the ordinary system name Rigel and its ordinary artwork; the 81 tests passed again. The [local Storybook review](http://127.0.0.1:60033/?path=/review/) includes the map and full planet profile.

Independent review and browser acceptance cleared `b12f199a`. The verifier checked authenticated desktop, narrow and fresh-context visits, Earth, a productive unowned planet, both players’ owner labels, legacy bookmarks and an unknown-planet exit.

## 03a · Acceptance

Accepted b12f199a. Both entry points opened the same saved game and planet, the full view exposed every required attribute, and the return control restored the correct system from fresh sessions. The reviewer cleared the final revision, including the test-only follow-up.

## 05 · Assigned behavior

- When a match starts, each participating player receives the configured starting balance of 100 credits, including the only player in a solo match.
- When a player enters or reloads the game, they can see their own saved global credit balance. Visiting another planet or colony shows the same balance for that player.

Create a balance per match participant and preserve it across sessions. Initialize existing participants missing a balance once, using the same starting grant. Keep the balance private to the owning participant in the player view. The epic makes scores and swarm progress public. It gives credits to the individual to spend, and future reservations could reveal a player’s plans if exposed to an opponent.

## 09 · Distance, trip preview and cost

Use the two bodies’ physical coordinates in LY to measure the straight-line trip. The displayed address identifies the body and its physical position supplies the distance. The settled and reserved cost is one credit per actual LY, including fractional LY within a system. Round for display only and give small nonzero distances and prices enough precision to distinguish them from zero. Both order entry points show the same destination, distance, departure speed, turn count and total cost. A destination must differ from the current body. Use the departure load for the whole trip and clamp the last segment to the actual distance remaining, so short trips arrive on the resolving turn and hauling later records only real distance.

## 04 · Independent database constraint tests

A second command center can violate both the occupied-site constraint and the one-command-center constraint. The existing isolated PostgreSQL test project can distinguish them. Exercise them independently in its disposable database, using a transaction or isolated test schema for the second building kind. Keep production building types limited to command centers during 04. Use the repository’s current database test infrastructure and verify the actual rejected constraint. Replace any temporary test-only kind with the trade center fixture once 06 supplies that production type.

## 04 · Independent surface and persistence review

Across every area from 1 to 218, all 23,871 usable sites had distinct axial positions within their surface. Each larger surface preserved the complete prefix of the next smaller surface. Every ring began in the east and followed adjacent sites clockwise under the SVG transform. The production view looks up buildings by planet and site, and the dedicated command center image is visually distinct from the numbered empty hexes. The schema scopes identity, parent references and both uniqueness rules to the game. The match-start transaction inserts centers after their planets, and the read transaction returns saved identities.

## 05 · Balance visibility and upgrade

- When a participant reads their player view, it returns that participant’s settled credit balance for the current game and keeps other participants’ credit balances private.
- When an existing match gains credit balances, each participant missing a balance receives the starting grant once. Reopening the match or restarting the backend preserves the stored amount.

## 04 · Final diff review

At `6a901725`, the reviewer matched all six requirement texts with their named tests and independently reran the ring property, match-start API test and fresh-session API read test. The PostgreSQL race tests distinguish the per-site uniqueness constraint from the per-planet command-center index. Their additional enum value exists only in a disposable test database. The shipped building enum contains the command center alone. Galaxy generation and turn resolution were unchanged in this increment. Final review found no open issues.

## 04 · Implementation and verification

Commit `6a901725` persists buildings with game-scoped UUID identity, type, planet and zero-based site. The match-start transaction writes one command center per home after saving the planets. The repeatable-read player view loads the saved rows in the same game. Migrations `0006` and `0007` create the table and initialize missing centers on owned planets in already-started games. The full planet page shows the selected site and its occupant alongside the planet facts, with dedicated command-center art and numbered empty sites. The stable ring traversal fills the east site first and proceeds clockwise.

The six assigned requirements each have a named regression. The shared domain project passed three tests, the two relevant backend router suites passed 52, and the frontend passed all 84 render and interaction tests. The PostgreSQL concurrency test passed both conflicting writes, checking SQLSTATE 23505 and the actual rejected constraint in each. The verifier’s browser run including the tracked home inspection and Galaxy cases passed nine checks. Shared, backend and frontend typechecks, scoped lint and the production frontend build passed. An intermediate frontend typecheck included the verifier’s temporary spec while it was being written. The complete package passed once the verifier removed the probe.

The [local Storybook review](http://127.0.0.1:62392/?path=/review/) shows the occupied, empty and full-page surfaces. The placement change is in match-start persistence and the saved view, with the galaxy generator and turn-resolution code unchanged. The former seed-1234 galaxy snapshot also passed without an update.

The final commit also passed the complete shared package suite (53 tests) and all backend integration suites (75 tests).

## 04 · Independent player and storage acceptance

Verified `6a901725415123635c8350152df574df3a93ad92`. All six criteria passed. The final Chromium run passed 13 checks, including authentication, the tracked Galaxy and Planets specs, and five independent player scenarios.

- Starting a solo and a two-player match created exactly one saved center per home. Fresh sessions and restarted backend processes returned the same three UUIDs, types, planet IDs and center sites as PostgreSQL. A populated pre-building database with two started games, 18 planets and a waiting lobby received four centers. Reapplying the migration and backfill, then reopening the database, preserved all four records.
- Both owners saw their center at site 0. All unowned worlds started without buildings. In the isolated database, the occupied-site and one-command-center rules rejected separate inserts under their respective constraint names. The same numbered site in another game remained independent.
- Chromium matched the displayed site count and east-first clockwise screen positions for every generated area from 2 through 11. A controlled area-one planet had only its usable center. An independent axial-coordinate calculation matched every surface from area 1 through 169, including eight complete rings or center-only layouts.
- Reloading and reopening preserved site offsets. Reversing building records preserved the component’s arrangement. Adding one saved building to Earth’s third hex changed only that occupant. The neighboring sites and Earth in the other match were unchanged. The two controlled database edits were restored after verification.
- The three home centers used the same identifiable building image. Empty sites used numbered outlines. The placed fixture used the same image off center.
- Both participants identified their own and the other home, selected the center with a pointer, and inspected an empty site with the keyboard. The selected-site text, planet facts and surface were visible together at desktop width. At 390 pixels the same controls worked and the facts were reachable below the surface.

## 04 · Acceptance

Accepted 6a901725. The verifier confirmed saved building identity through real backend restarts, both database uniqueness constraints, stable positions after reorder and new occupancy, and player access to the center and empty sites. The reviewer cleared this commit. The generator and turn resolver were unchanged, so their mutation suites did not apply.
