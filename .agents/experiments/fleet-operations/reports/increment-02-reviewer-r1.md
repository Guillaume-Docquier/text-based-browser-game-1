# Increment 02 — independent reviewer R1

Verdict: **two actionable findings remain**: R1-01 is missing mandatory I2-12 acceptance coverage; R1-02 is a new constrained-domain typing violation. I found no additional production correctness, persistence, deterministic ordering, package-boundary, or harmful-abstraction defect in the full increment. This report does not approve or accept the increment.

## Checkout, authority, and inspected scope

Reviewed only C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1. Initial and final Git root, branch codex/fleet-operations-experiment, and HEAD 06954d1a35759a5fa5bd4271f0585ba3ef71c6e4 matched the assigned preceding accepted base. Preserved all tracked/untracked work. No commits, Git configuration/repair/reset, environment-value edits, external review bot, subagents, or main-checkout edits occurred.

Read the complete neutral dispatch (SHA256 4E77E3E1DBBC3F4483C5BB40B0F89F7D540A55081D90C480CD938DE98101BF6E), approved v4 packet (SHA256 E4118FEA9BACB30A5233B92D5D15D790FB2337F0D3E3315A35B2AE65F34FAF97), authoritative requirements, initial plan, increment template, and reviewer persona. Read root/scoped backend/shared/frontend/Playwright/docs instructions, TypeScript standards, glossary, installed tools-ts README, ADR index and accepted 007/008/011/013/015–031, turn-resolution/processing architecture, GDDR index/009, and Systems index/001/003/008/010/011/012/014/015. Did not read previous implementer/tester/root persuasive reports or verdicts.

Inspected the entire 57-path tracked-plus-untracked apps/packages/docs increment since the base, including every new file, all changed test/support code, relevant unchanged surrounding implementation, and current documentation/status changes. The complete byte/path inventory appears below. There are no deleted paths, migration SQL, or snapshots in this increment. Existing movement JSON handles the new capture shape; fresh PostgreSQL tests apply real migrations and seed, while PGLite pushes the existing schema and seeds Test content.

Surrounding review included TurnProcessor conversion and direct shared resolver call; TurnsRepository loading, claim/save/delete/RNG mapping; gameplay repository turn locks and fleet parsing; updateActionSubmission and getPlayerView projections; ActionSelector normalization; effect pool/outcome association and phase pipeline; unchanged ordinary movement/build definitions and public API contracts; real-PG test server lifecycle and Playwright configuration. All production/test/docs files stayed read-only. Writes were limited to this report and the assigned reviewer evidence directory.

## Actionable findings

### R1-01 — P2: complete the mandatory composed-pair reservation and adapter parity gate

Locations: packages/shared/src/action-submission/fleet-assault-selection.test.ts:75 and :84; apps/backend/src/api/gameplay/gameplay.router.integration.test.ts:307; apps/frontend/src/features/play/components/ActionCard.stories.tsx:167; apps/backend/src/api/gameplay/gameplay.concurrency.test.ts:804.

Contract: approved I2-12 requires source50 with ordinary Move20 plus Attack Move30; total50/available0; Attack31 rejected; editing Move20 to19 gives49/1; cancelling Move20 gives available20; exact combined8 Influence/2 Fuel; extra cost rejection, old-selection replacement once, gain cannot fund departure, and equal normalized frontend/API/resolution status/issues/commitments/partial candidates. Required layers are S+B+C+F.

The new shared test asserts the initial 20+30 commitments and Attack31 failure, but its only cancellation removes Attack30, retaining Move20 and reporting available30. It never checks the required Move20-to19 edit or cancellation of Move20. Its gain case has sufficient resources and does not exercise a gain attempting to finance an otherwise unaffordable composed departure.

The retained cross-boundary parity oracle explicitly describes an ordinary mixed-definition allocation: Move Standard20 plus Move Improved30, resources6 Influence/4 Fuel. The router parity test and controlled parity story use that vector. The PostgreSQL simultaneous20/30 allocation likewise uses two ordinary Move instances, resources6 Influence/2 Fuel. The new Assault PG lifecycle tests use ample resources and do not fill the exact composed-pair parity/race gate. Standalone Attack stories and the authentic combat E2E are useful, but do not supply these missing mixed reservation assertions.

Reproduction: inspect the cited new shared test and FleetActionSelectionParity.ts:4, then run the shared, router, real-PG, and Storybook suites. All pass even though no fixture asserts the required edited49/available1 and cancelled-Move/available20 composed vector across the required boundaries. This is a demonstrated acceptance-evidence gap, not a demonstrated gameplay failure.

Concrete remedy: extend the exact shared Move20/Attack30 fixture with those edit/cancel results, exhausted8/2 extra-cost rejection and underfunded-gain rejection. Add a genuine public API/actual-worker and real-PG mixed-pair fixture plus a controlled frontend projection/story using the same normalized composed vector; compare status/issues/commitments and partial candidates to independent literal expectations. Preserve the existing ordinary parity controls. No production behavior change is requested unless those tests expose one.

### R1-02 — P2: retain the new numeric domain guarantees in dedicated types

Locations: packages/shared/src/domain/world/fleets/Fleet.ts:30, :36, :53, and :74.

Contract: accepted ADR015 permits non-type-representable runtime constraints only with a dedicated branded type recording the guarantee; ADR027 describes applying constraints before branding and using dedicated schemas for meaningful domain numeric invariants. The existing-model exception does not apply: these are plain object fields whose TypeScript types accept arbitrary numbers.

The new pending definition ordinal schema enforces safe, nonnegative integers, while PendingArrivalAssault.definitionOrdinal is number. The newly strengthened Fleet strength schema enforces safe, nonnegative integers, while Fleet.strength remains number. A parsed value loses both guarantees when typed, and typed construction or mutation can bypass them. Pending capture validation and resolveTurn preflight currently catch bad runtime data, but the declared domain model does not carry the contract the new parsing claims to establish.

Concrete reproduction: the reviewer-only constrained-domain-proof.ts assigns -0.5 to both PendingArrivalAssault["definitionOrdinal"] and Fleet["strength"]. Native TypeScript compiled the proof with exit0. It imports the real current domain types and does not change production or tests. Runtime schemas would reject these same values. This demonstrates the exact type/validation mismatch rather than a hypothetical combat result.

Concrete remedy: introduce or reuse dedicated safe nonnegative integer domain schemas/types for the ordinal and mutable Fleet strength, with constraints applied before branding. Construct constrained arithmetic/index results through validated typed helpers where necessary. Keep zero representable for cleanup; retain the existing corrupt-capture, safe-strength and exact-loss tests. This is scoped to the numeric guarantees introduced here, not a request to refactor unrelated domain models.

## Acceptance review

The following records inspected and executed evidence, not root acceptance authority.

| ID    | Evidence and disposition                                                                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I2-01 | Shared literal 30/20,20/30,equal exchanges and charged public stationary-worker arithmetic controls; exact costs and depleted deletion checked.                                                                                                                         |
| I2-02 | Exact BigInt proportional losses B3/C7, lower-ID one-unit remainder tie, all-gone control and equivalent permutations; genuine public worker force oracle plus separately labeled pristine replay.                                                                      |
| I2-03 | Successful no-defender no-op, positive actual stationary predicate, excluded transit origin, and peaceful ordinary arrival reviewed and exercised.                                                                                                                      |
| I2-04 | Genuine public speed20/6 arrival ticks5/15 and shared literal A10/later B Prevented; actual final persistence and replay order/outcomes kept separate.                                                                                                                  |
| I2-05 | Shared exact intermediate B24/C16 and later B8/C Prevented; public speed20/9.5/6 ticks5/10/15 with actual saved finals and pristine replay intermediates.                                                                                                               |
| I2-06 | Same pooled ID across owners; literal shared seed1234 draw0.07329497812315822, B-before-A outcomes and next1831567047; authentic natural two-owner and pure three-owner stationary worker fixtures independently passed. Actual observations below.                     |
| I2-07 | Exact public defender30/outgoing20/incoming5/Build10 versus20 yields defender5; outgoing20 untouched; separate full-outgoing/empty-origin worker control.                                                                                                               |
| I2-08 | Public same-turn enemy Build20+10 annihilation; public friendly7+Attack20+ordinary5+Build10 versus20 yields22, retaining named friendly identity and deleting merged child; shared literal controls.                                                                    |
| I2-09 | Public same-owner20/15 merged35 versus10 yields25 while preserving two originating intents; ordinary-first later Assault control and shared ordered provenance reviewed.                                                                                                |
| I2-10 | Shared speed2/distance5 literal3/1/arrival with JSON parse each turn; genuine public4.418312565270031 literal2.418312565270031/0.418312565270031/arrival, source50/selected30, cost5/1, survivor10 and friendly17, payonce/release/empty stability.                     |
| I2-11 | Real-PG edit/cancel/redirect/reuse rejection with pristine public state, second pooled instance usable while first busy, terminal release; retained ordinary busy-instance controls.                                                                                    |
| I2-12 | **Incomplete mandatory coverage; R1-01.** Shared production evaluator is common to all three boundaries and composition is data-based, but the exact composed-pair edit/cancel/budget/parity evidence is missing.                                                       |
| I2-13 | Arbitrary originForce/landingSite/units, renamed ID/name/tier, speed2/range5/cost7/2; malformed domain/mapping/duplicate/unknown rejection; actual stationary Assault worker setup; renamed controlled story.                                                           |
| I2-14 | Shared fixed literal names/IDs/rounding/order/state and mixed-case ordinal comparisons; genuine natural three-owner multi-planet Build plus same-pool Assault permutation replay and independent actual-worker name/draw accounting.                                    |
| I2-15 | Fresh PGLite/public and PostgreSQL migration/seed/API/worker lifecycle; pending JSON reload, zero/merge row cleanup; bounded captured-JSON ordinal/mapping/owner/binding corruption before gameplay mutation. Runtime checks passed; domain typing issue R1-02 remains. |
| I2-16 | Authentic Alice/Bob browser partial30 from50 versus20 survives10, public row/map removal, action release/reuse and ordinary flow; focused E2E passed.                                                                                                                   |
| I2-17 | Maintained Storybook guidance/tools plus controlled source/range/force/edit/cancel/captured journey/renamed composition plays, post-Assault Fleets row and markers; focused5/full60 passed.                                                                             |
| I2-18 | Full shared/backend unit+integration/concurrency/Storybook and focused E2E completed. Explicit I1 spot coverage below; full repository E2E was not run by this reviewer.                                                                                                |

Retained I1 spot coverage: I1-02 is protected by shared replacement/aggregate/mixed-definition tests and public router allocation. I1-05 is protected by shared exact range/dependency controls, public tier-range tests and controlled source-change/range stories. I1-09 is protected by shared20/15 split/permutation and full-departure deletion tests and actual PostgreSQL reload. I1-10 is protected by shared speed2/JSON/payonce tests and actual-worker slow continuation/save/reload. I1-14 is protected by real-PG start-gated30/30,20/30 and resource-only races. I1-15 is protected by actual-PG readiness/deadline worker serialization and cancellation/replacement controls.

No action-ID/name/tier production behavior branches were found. Combat uses phase-current shared stationary presence, simultaneous exact loss snapshots, all enemy owners, and stable largest-remainder ties. Arrival settlement retains per-order provenance separately from the actual merged carrier. Dead queued attackers remain candidates and resolve Prevented after earlier combat without another shuffle. New departures pay once; continuations do not recreate payable submissions. Worker persistence deletes removed IDs and saves authoritative RNG. Small repeated rebinding lookups do not establish harmful duplicated gameplay decisions; I request no unrelated refactor or speculative generalization.

## Independent executions and cleanup

| Command/scope                                                                                                                                                                              | Actual result                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pnpm --filter shared test                                                                                                                                                                  | Exit0;24 files,166 tests;1.18s. Own shared-tests.log.                                                                                                                          |
| pnpm --filter backend test --project unit --project integration                                                                                                                            | Exit0;9 files,123 tests;105.57s. Own backend-tests.log.                                                                                                                        |
| pnpm --filter backend test --project concurrency                                                                                                                                           | Exit0;2 files,10 tests;48.63s; real Testcontainers PostgreSQL18.4. Own concurrency-tests.log.                                                                                  |
| Maintained Storybook tools test run, five explicit Assault/row/marker story IDs                                                                                                            | Exit0;all5 passed. Own story-focused.log.                                                                                                                                      |
| pnpm --filter frontend storybook:test                                                                                                                                                      | Exit0;16 files,60 tests;5.74s. Own story-full.log.                                                                                                                             |
| pnpm --filter frontend e2e --add-reporter=list, fleet-assault.spec.ts fleets.spec.ts actions.spec.ts                                                                                       | Exit0;7 passed including3 setup and4 workflow tests;1.5m. Followed run-e2e-tests skill, tty and prescribed reporting controls, polled through command exit and server cleanup. |
| pnpm lint                                                                                                                                                                                  | Exit0;no --fix. Own lint.log.                                                                                                                                                  |
| pnpm typecheck                                                                                                                                                                             | Exit0. Own typecheck.log.                                                                                                                                                      |
| git diff --check                                                                                                                                                                           | Exit0. Recorded final-audit.json.                                                                                                                                              |
| Three natural RNG integration fixtures, direct pnpm exec vitest run with documented --disableConsoleIntercept                                                                              | Exit0;1 file,3 passed/34 intentionally excluded;14.75s. Own natural-rng-visible.log contains per-run observations.                                                             |
| Reviewer-only constrained-domain-proof.ts, pnpm exec tsc --ignoreConfig --noEmit --allowImportingTsExtensions --module NodeNext --moduleResolution NodeNext --target ESNext --skipLibCheck | Exit0;demonstrates R1-02;no production/test changes.                                                                                                                           |

The first bounded natural-RNG logging attempt exited1 before running tests because the package script already supplies --silent and Vitest rejected a second --silent=false option. A direct Vitest retry passed3 tests but intercepted INFO output; the documented console-interception control then produced the successful observations below. Both attempt logs are retained; neither failed command was counted as a passing execution.

Automatic approval review initially rejected pnpm lint because it believed --fix might run. Read-only package.json proved lint is exactly oxlint --max-warnings 0 and lint:fix is separate; the evidence-based retry was approved and passed. No approval blocker remains.

PGLite fixtures closed their isolated clones. PostgreSQL fixtures disposed their API processes, databases and Testcontainers; post-run docker ps showed only the five pre-existing compose databases, including the assigned worktree43 database on10129. Playwright exited0 and no listener remained on its assigned backend/frontend ports10130/10131. The existing Storybook server6006 and its helper were preserved. I did not terminate unrelated processes or change shared service ownership.

Browser warnings included Clerk development-key notices and existing Node/pg deprecation messages; none failed an assertion. The configured HTML report location is apps/frontend/playwright-report/index.html; shared ignored frontend test-results/report directories may be overwritten by other verification runs. The Storybook JUnit path reported by my run was later absent after Playwright cleaned test-results; my own retained textual logs and observed exit/count remain the evidence for my run.

## Successful natural RNG observations

All three fixtures use public create/join/start/Build/ordinary Move/submit/readiness/view and the real production worker. The production repository input observation intentionally rolls back; shared replay uses a separate pristine copy. The worker supplies saved final forces and next RNG, not transient outcome history.

| Fixture                             | Observed natural G | Independently checked draw(s)                                                | Tie order                             | Saved next generator state |
| ----------------------------------- | -----------------: | ---------------------------------------------------------------------------- | ------------------------------------- | -------------------------: |
| Pure two-owner stationary30/20      |         2555090577 | 0.6226333731319755                                                           | A then B                              |                   91689094 |
| Three-owner Build plus Assault      |         1044111847 | 0.5278613544069231,0.5765670342370868,0.6692503951489925,0.15846310858614743 | B then A after3 canonical Build draws |                 4075407803 |
| Pure three-owner stationary30/20/10 |         3591479043 | 0.407630902947858                                                            | B then A                              |                 1128077560 |

SpareNormal remained null. Build names in canonical owner/home order were fleet528333, fleet576990 and fleet669580, with spaces after fleet in the actual persisted names. A/B/C owner IDs are the literal UUIDs ending0001/0002/0003. Complete canonical action/fleet/home keys are recorded verbatim in natural-rng-visible.log. Pure two-owner savedA10/Babsent; pure three-owner B-first savedA10 only; separately labeled replay supplied their full outcome sequences and permutation comparisons.

Fixed public target is seed147 planet552840, ID57c1b320-c267-5c9b-a5a5-1b5a02823714, coordinates45:83:40, x53.24122006799319/y48.68601626316641. The two-seat companion home is planet819299, IDec56a9af-3995-521c-822d-84685a96fdc6, coordinates44:98:05, x48.987456457561635/y49.880579392930315; distance4.418312565270031. The three-owner natural stationary fixture stages through literal homes f92f944d-b247-52fa-ab94-58627375cd87/54:28:25, ba9892e3-c082-59b5-a22d-0acf87b77b58/46:95:40 and e3099011-2516-5087-9276-8466867a3aaa/44:36:25; route distances6.340414101122655,12.182152625782757,8.039286685075407. Tests assert these fixed geometry inputs before combat. Map seed does not fix secret combat RNG.

## Limits and byte preservation

I ran the focused3-spec E2E scope, not every Playwright spec, and did not run the backend Vitest types project separately. Root typechecking passed. Component review used maintained documentation discovery, source fallback and actual Chromium story plays; I did not conduct a separate manual pixel-by-pixel visual inspection. No PGLite concurrency claim, private worker call, secret RNG override, behavior mock, fabricated public geometry, direct SQL valid-gameplay arrangement, or new history/debug endpoint supplies these findings or results.

The canonical path union is ordinal-sorted and unique, covering git diff --name-only from the assigned base plus untracked apps/packages/docs files. Each row is path, TAB, uppercase exact-byte SHA256 (or DELETED), serialized as UTF8 without BOM with LF joins and no trailing newline. Count57; initial and final aggregate SHA256 **B410BDC46753E491E752A28296E9B3A1BCD9BF5EC30103443FF4662716DA029C**. Exact start/final string comparison returned true. Final-audit.json records the checkout, all57 paths, status and diff-check exit. This proves the inspected source/test/docs bytes remained unchanged during my review; report/evidence files are outside that source manifest.

### Canonical final manifest

```text
apps/backend/src/api/gameplay/gameplay.concurrency.test.ts	7A0A45A6552EC927AFC98030FFBF8FC4D2459B79D541DD53F11A6C3F4D547C55
apps/backend/src/api/gameplay/gameplay.router.integration.test.ts	05CF451A971C45737B7E9915BCAE5F45FDB4785E93F2C4B312FCEA414AB0C2E7
apps/backend/src/lib/rulesets/AssaultRuleset.unit.test.ts	BE160D4DF999F721FE3D82354A35C7266F021308519E7E044D6704A18FA860E0
apps/backend/src/lib/rulesets/standard/StandardRuleset.ts	0BB37154C4531A1A88C7469A502E2E8C5074E9CB066B6DFF99DB7CACE05B3CF3
apps/backend/src/lib/rulesets/standard/action-definitions/attack-move.ts	FAE59BFC783BB326E3D6C3463074FF1E6079C229E0F1AAFAA472E18AD8D225F7
apps/backend/src/turn-processing/TurnProcessor.integration.test.ts	AC90A9C37B15FCF146B42EF5D790FA7C7EFE80DE722FEBF9FF113178B8F27025
apps/frontend/playwright/pages/CreateGamePage.ts	9D760020EC62845FFBC35834D48DD562B92E5649A186739B2EC419B499BF711B
apps/frontend/playwright/pages/FleetsPage.ts	E9B459DC793D05CC27181A48C1A13C9355DC440A42E3F08BF37E7EBECF6E07B4
apps/frontend/playwright/specs/fleet-assault.spec.ts	172D8D7CD41767801681029CDB1B5A7D210E3EA134FF53CDC9B0484C2DDC3B84
apps/frontend/src/features/play/components/ActionCard.stories.tsx	178A62116ABC22F19A34F514474FCB24CD338FF50E15A2C6EF37932513FAAB20
apps/frontend/src/features/play/components/ActionCard.tsx	19811B7C76E2F58994047EE5A78920B6BAF853002C220C1B9E367141FC3E1A92
apps/frontend/src/features/play/effectDefinitionToRulesText.ts	E75F7ABFED4AE565CFAE167AB8B2165B4DCE5822156F453632B7107C787484EE
apps/frontend/src/features/play/fleets/FleetsPage.stories.tsx	45ED9242A53AE262FDD562226F87B4540D5F6C31C5B792C2C1AB1F92509ED7C1
apps/frontend/src/features/play/galaxy/star-system/StationedFleetMarkers.stories.tsx	7CB638E093FE631C049DFB6B08CA99B36AC9796F41D75C8C6CCE293146084DAA
docs/architecture/turn-processing.md	61B338A61A1F2F644CB56BCBE201F86C6680F19F3D1F88103428AE527B9B9974
docs/architecture/turn-resolution.md	199702416F25B2570F3197147DA7FB4E08E16AD3ACD671DFE00ADE3787FF2C4D
docs/game-design/systems/001-turns.md	72FB72A439E3026A1BEBBC50286A1871CEF15DD8796EF8978396CF373C8773D8
docs/game-design/systems/003-actions.md	C131D72984BBF445C795A416AD28736A8245695A4BDB5E4EB3E8FA70BE548B19
docs/game-design/systems/010-fleets.md	A1B5FC0D53A81AF9C962B5C070C5D807EF6DDFC6FDD06B9E2AB8F47167317A41
docs/game-design/systems/011-combat.md	5E715A28CD8A95FD61614A550E66C4C540CC1D0CCF153B961BD626E46BA63F8F
docs/game-design/systems/012-movement.md	B3DD743207D20005C60BA2CB5CD257B8A00A4B18CD2ECE115535F4B189F48664
docs/game-design/systems/015-rules-engine.md	AC8745F1519266B56D99E05FF40F43C46A98F632885AA07A28D27CCD75D33EA8
docs/game-design/systems/README.md	01B2332280BA0FAA901B4E9C0C9065B85241D8F68EC7AA5A0760E59D9A744E5E
docs/glossary.md	AFCC99A3CC67E7E0ADE1A1D6C53B6BE083E273BF616F11300E4E862E59FDCD74
packages/shared/src/action-submission/evaluateActionSelection.test.ts	CAD380F151FCC3CB5458225305CADE0E8318C68C885CA737B7F96165761CE28F
packages/shared/src/action-submission/evaluateActionSelection.ts	F1949BB9B8A6451D3C0D1C57A19C8A78023DC382C933BD0273791C12F9BB6159
packages/shared/src/action-submission/fleet-assault-selection.test.ts	B376304791F1DD264FA9AF96B98BFD69E5279E0BFF6B3F3902F48045F35B46D2
packages/shared/src/action-submission/validation/validateSubmittedActions.test.ts	B61369871BA49F478C2B2F0A57F58F651F05A8ADCAA633307F36A020A984FAD7
packages/shared/src/action-submission/validation/validateSubmittedActions.ts	6040E97906C9956226ADF614E18E4B934CD4A2BF912BFD2810083A1C24F35A2F
packages/shared/src/domain/compareOrdinalStrings.ts	734C9C97692886E97A6673A49352E5DBF62429F010BF92D3AB933DEE22555AB9
packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts	4DAFA49CDACD5D332F799B1CC628E385277962B291BA57A3BDD50AB80AD56B1D
packages/shared/src/domain/ruleset/effect-definitions/EffectDefinition.ts	D85EFEEDD44265F6BDD1587DA5383C28969E92132879B89FB83EEFFF1EA2C9DF
packages/shared/src/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts	77A242E24427BEBEB897280C33DC5983BCE87FDC32B3534B44E07508E2516DFB
packages/shared/src/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts	D27864C9F63284C83E85FCB64CCA451A0EABBD86AA0CB326791DCA8FE4E4E49C
packages/shared/src/domain/ruleset/target-definitions/TargetConstraint.ts	BD1A2FD195E3D13ACBA61F112DE50DD3148C0C3A9C44F2F949E208E76A17D985
packages/shared/src/domain/ruleset/target-definitions/TargetDefinition.ts	52B0213041C76E8BF665BEF07E3F2CB6CFFC1BDB0CA9184F73E64783C237B221
packages/shared/src/domain/world/fleets/Fleet.ts	438BE0CC2A6614BCCA53520C22194368BBB4B735580EE48B7F5B93054C4939B3
packages/shared/src/domain/world/fleets/isFleetPresentAtPlanet.ts	0F8ECEE7998C5BE5468737170B618C6FB3E33CB30370439ABE8BFD13DBEE1D4A
packages/shared/src/testing/test-ruleset/TestRuleset.ts	DAE43116985AC9F5F36BCB19119C89BE9BC5CA9E55AB23CCFB2A39D1075BC892
packages/shared/src/testing/test-ruleset/action-definitions/attack-move.ts	BBE9D8D4A989658EF15253521D4B840DD1E20971AA0A2D3128CA0107D6B285D4
packages/shared/src/turn-resolution/ResolveTurnError.ts	48C49F04C4E4C3510498AD813575942924982F3D3B42584D5FCD40DFC0F61917
packages/shared/src/turn-resolution/TurnContext.ts	358851789CFE0AE380486A3670EB9844B974EC399F98021FB8B2E165AF749CCA
packages/shared/src/turn-resolution/effects/Effect.ts	08BA9DB359112B1F1BECAE75F3CD08431DD75B22C0070948FCF25C7C8C9CBA69
packages/shared/src/turn-resolution/effects/EffectFactory.test.ts	C2985A9446E91A1D6AD52645AA0526989C460D8D855BCEDAB508A8E705F9091C
packages/shared/src/turn-resolution/effects/EffectFactory.ts	17BD982354697A2F230E0C6321B74BD1A3AB76FCB90F883883A21112F1E72503
packages/shared/src/turn-resolution/effects/implementations/FleetAssaultEffect.ts	53AC89110D98739D0F724C7607211A1D6AC094C5820283FA485A062C52A2AA0A
packages/shared/src/turn-resolution/effects/implementations/FleetBuildEffect.ts	B3D2DE64946FBD08809224F74FA7D8F71E1871C4061A7E0A7ADC499035C2C9C7
packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.test.ts	047F522D993E3658ACEBC30FE6D870563D38E666D7AF7DC40C54315E61E22569
packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts	F2333969A57CA91B586A0015372552D47CD53DE236FC525EAA33743F7DE912EA
packages/shared/src/turn-resolution/fleet-assault.test.ts	73F7A31153D680E6041A7AF59F4891033BDB9FAAA89AE91DCC70D0BD246BE373
packages/shared/src/turn-resolution/fleet-movement.test.ts	1B402EF8578765D119EE40FC6129F13E5D63AEE2518E68CFE04F6157016E6BD4
packages/shared/src/turn-resolution/phases/implementations/fleetAssault.ts	375F8FD581694B186D722642334D21115BE3225F6685D3A71998F0B96CF80008
packages/shared/src/turn-resolution/phases/implementations/resolveFleetBuildPhase.ts	E82CCE81FCB33E719635D9706EB94A3C546348A611ADCBF0EF4581B633243228
packages/shared/src/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts	E6C2A60624D9F79594330369D3D927E383699018B3205D51BEEC6B1CB0373F05
packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts	C7EF9CDEC732154484627CC9A5F16BDF56229F8DF8F998DB92B1C33D96DB3C5D
packages/shared/src/turn-resolution/resolveTurn.test.ts	4BE28C28A091F081D07A7B613BABE4E0174BD51CFE681DF12480B5AFAAB8B147
packages/shared/src/turn-resolution/resolveTurn.ts	28FE592E5DCCB577A888BAFBF83B0723D9F1DFE204511C99D70690B772DFFC48
```

STOP: review complete. No further reviewer writes after final report formatting and checksum. Root retains acceptance and commit authority.
