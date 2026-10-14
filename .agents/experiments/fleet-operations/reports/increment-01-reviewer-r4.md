# Increment 01 — independent reviewer r4

## Verdict

**No actionable findings for the FULL current increment.** I independently reviewed the entire tracked and untracked apps/packages/docs change against base `acde251d2fb2164eb7cd881fb55fc5f08e52d817`, the authoritative requirements, and the approved unchanged v1 packet. This conclusion includes all I1-01 through I1-17, rather than only recent corrections. No production, test, migration, or existing documentation file was changed by this review.

Root owns finding dispositions, fixes, fresh quality gates, acceptance, commits, PR updates, and CI. This report is an independent code-review verdict for the exact snapshot below, not a replacement for those gates.

## Identity and independence

- Reviewer: Fleet Operations Reviewer, gpt-6.1-sol / high.
- Actual root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`.
- Actual branch: `codex/fleet-operations-experiment`.
- Actual HEAD and supplied base: `acde251d2fb2164eb7cd881fb55fc5f08e52d817`.
- Working increment was uncommitted; tracked modifications, deletions, and untracked files were preserved. The main checkout was not used or modified.
- Requirements and approved v1 packet were primary inputs. Previous implementer, tester, reviewer, and orchestrator verdict reports/finding narratives were not read. Report filenames visible in Git status supplied no correctness evidence.
- All linked-worktree commands used an explicit workdir and normal-account `require_escalated`; no administrator elevation, Git configuration repair, environment-file changes, or main-checkout fallback occurred.

## Scope actually inspected

Read root and every relevant scoped AGENTS (shared, backend, frontend, Playwright, docs), TypeScript coding standards, glossary, installed tools-ts README, ADR index and accepted 007/008/011/013/015–031, turn-resolution/turn-processing architecture, GDDR index/009, and Systems index/001/003/008/010/011/012/014/015. Requirements supersede the older colonization design; Assault, Colonize, and composed deferred arrival intent are correctly outside this increment.

Inspected every inventory entry below, including deleted validation implementations/tests and untracked evaluator, schemas, movement tests, concurrency test, Storybook stories, SQL migration, and snapshot. Surrounding code included effect creation/pool/phase resolution, game-start action insertion, ruleset persistence, readiness and deadline closure, worker claim/load/save, frontend mutation contracts, existing fleet/map consumers, and actual database test harnesses.

## Independent assessment of the contract

| Criteria | Assessment and concrete reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1-01    | Actual ActionSelector/ActionCard projection, UpdateActionSubmissionUseCase, GetPlayerView, and locked resolution consume the same evaluator with total resources, current selections, coordinates, full fleets, players, and pool identity. Frontend candidate filtering delegates; adapters do not reproduce movement predicates. The fixed parity vector uses explicit expected commitments and reaches real API/resolution/Storybook boundaries.                                                                                                                                                                                                                 |
| I1-02–04 | Replacement removes the same player's edited instance before adding its draft once. Cancellation removes that instance alone. Full proposals aggregate resource costs and mapped source Strength across definitions/instances. Strength overdraw is attributed to every allocation, preserving candidate feedback under ID/order permutations; resources use total balances. Same-turn gains and builds cannot finance departure. Explicit 20+30, 19 replacement, 21 rejection, cancellations, and mixed 6 Influence/4 Fuel oracles exercise these semantics.                                                                                                       |
| I1-05–07 | Constraints resolve the selected source's origin coordinates and enforce finite inclusive range, distinct planet identity, owned stationary source, and available positive safe-integer force. Missing dependency remains incomplete; missing origin cannot create unlimited range. Coincident distinct planets remain valid. Force parsing rejects missing/invalid/unsafe values and undeclared keys, and the API rejects incomplete or mixed-null transport. Exhausted blank-force sources are unavailable. Source changes immediately clear invalid dependent selections.                                                                                        |
| I1-08    | Schemas validate mapped target/input roles, compatible constraints/references, matching owned/stationary/range/no-op prerequisites, supported variants, finite positive parameters, unused inputs, and the one-move-per-definition limit. Arbitrary tags, including constructor, work through own-property lookups. Move plus a supported gain remains executable. Mechanics dispatch on effect/constraint types; no action-ID/name/tier/label gameplay branch was found.                                                                                                                                                                                           |
| I1-09–10 | The movement phase allocates all new departures before arrivals/builds. Each child uses deterministic UUID-v5 game/player/turn/instance/source identity; the original retains only the remainder. Full allocation carries an explicit removed ID through TurnProcessor into persistence. Old journeys are snapshotted separately so each old/new journey advances once. Original speed/submission/departure persist, continuation creates no payable submission, and transient continuation outcomes retain provenance without history tables. Decimal speed regression oracles cover exact expected turn counts and preserve genuinely longer journeys.            |
| I1-11    | Occupancy is derived from live owner+instance bindings, not definition identity. The shared evaluator rejects busy selections, and null cancellation checks occupancy before its write branch. API/worker tests prove edit/redirect/null-cancel rejection, alternate same-definition use of the remainder, moving-child rejection, and release on arrival. Frontend shows a journey summary without selectable or payable controls; reload and actual later-turn release pass E2E.                                                                                                                                                                                  |
| I1-12    | Arrivals settle by calculated Tick and stable Fleet ID. A same-owner stationed survivor retains ID/name and receives the arriving force; the child is explicitly removed. Ambiguous duplicate stationed identity fails instead of selecting an arbitrary survivor. Enemy co-location preserves both forces and ownership; ordinary movement creates no Assault.                                                                                                                                                                                                                                                                                                     |
| I1-13    | Complete destination/distance/movement tuples are parsed at database boundaries and checked for owner, pool instance/definition, mapped selections, force, destination, departure turn, and duplicate occupancy before engine effects mutate state. A missing historical source is allowed only for an existing journey. Worker round trips inputs/movement and emits explicit nulls for stationary and next-turn available states. Fresh PostgreSQL boot applies migrations in the concurrency suite; a separate fresh PGLite chain and structural snapshot comparison passed. Full-source deletion is observed through PostgreSQL worker save/reload/player view. |
| I1-14–15 | GameplayRepository acquires the current Turn row FOR NO KEY UPDATE before readiness/deadline/decision reads. Evaluation and update retain that transaction. Readiness, worker start, and deadline closure serialize on the same Turn row. Real Testcontainers PostgreSQL start-gated races exercise 30/30, 20/30, resource budgets, cancel/replace, readiness, and closure. No post-closure update path was found. These are real PostgreSQL checks, not PGLite concurrency claims.                                                                                                                                                                                 |
| I1-16–17 | Standard/Test content explicitly declares speeds 0.1/1/5 and inclusive ranges 5/10/25; the runtime and UI consume that data. Tick 0/5/20 and permutation tests have explicit expected values. The fixed phase order remains engine-owned. Full Storybook interaction tests and affected E2E specs cover invalid/blank force, partial departure, resource presentation, source-dependent candidates, reload, continuation, and arrival release.                                                                                                                                                                                                                      |

Native erasable TypeScript, direct shared imports, named type-only API contracts, Result handling at engine boundaries, app/worker separation, and branded schemas remain consistent with the accepted architecture. The consolidated evaluator removes harmful repeated validation/accounting; the bounded movement lifecycle and persistence projections do not introduce a speculative workflow framework. No concrete harmful duplication, unnecessary abstraction, or missing generalization warranted a finding. Standard and Test content remain independently owned as required. Updated existing documentation accurately describes ordinary movement as implemented while keeping combat, colonization, hostile competition, and other planned systems partial.

## Verification actually executed

All listed verification commands completed with exit 0. Test runners were followed through final exit.

| Command / check                                                                                                                                      | Result                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter shared test`                                                                                                                          | 21 files; 134 tests passed.                                                                                                                                                                                                                                                     |
| `pnpm --filter backend test --project unit`                                                                                                          | 2 files; 6 tests passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter backend test --project integration`                                                                                                   | 6 files; 97 tests passed.                                                                                                                                                                                                                                                       |
| `pnpm --filter backend test --project concurrency`                                                                                                   | 2 files; 5 tests passed using fresh real PostgreSQL 18.4 Testcontainers.                                                                                                                                                                                                        |
| `pnpm --filter frontend storybook:test`                                                                                                              | 15 files; 54 tests passed, including all seven ActionCard stories.                                                                                                                                                                                                              |
| `pnpm --filter frontend e2e playwright/specs/actions.spec.ts playwright/specs/fleets.spec.ts playwright/specs/readiness.spec.ts --add-reporter=list` | 7 tests passed (including authentication setup), 48.3 s. Runner-only PLAYWRIGHT_HTML_OPEN=never and PLAYWRIGHT_LIST_PRINT_STEPS=1; isolated worktree database verified first. No listeners remained on assigned API/frontend ports 10130/10131 after runner exit.               |
| `pnpm lint`                                                                                                                                          | Passed.                                                                                                                                                                                                                                                                         |
| `pnpm typecheck`                                                                                                                                     | Passed.                                                                                                                                                                                                                                                                         |
| `pnpm --filter shared typecheck`                                                                                                                     | Passed.                                                                                                                                                                                                                                                                         |
| `pnpm --filter backend typecheck`                                                                                                                    | Passed.                                                                                                                                                                                                                                                                         |
| `pnpm --filter frontend typecheck`                                                                                                                   | Passed.                                                                                                                                                                                                                                                                         |
| `git diff --check`                                                                                                                                   | Passed before report and after own-report formatting.                                                                                                                                                                                                                           |
| Fresh PGLite migration smoke check                                                                                                                   | Piped an in-memory Node module to `pnpm exec node --input-type=module -` in backend; drizzle-orm/pglite/migrator applied ./drizzle. Verified two migration rows and nullable jsonb selected_inputs/movement with no SQL defaults; database closed. No test/source file created. |
| Snapshot structural comparison                                                                                                                       | 0001 prevId equals 0000 id; after removing id/prevId and the two added columns, snapshots compare equal. SQL/journal/snapshot inspected.                                                                                                                                        |
| `pnpm exec oxfmt --write .agents/experiments/fleet-operations/reports/increment-01-reviewer-r4.md`                                                   | Own report only; passed.                                                                                                                                                                                                                                                        |

Loaded and followed the repository Storybook and E2E skills before corresponding execution. Ran installed `pnpm exec storybook skills stories` and `pnpm exec storybook skills write-story`, and Storybook tools docs list/show discovery (exit 0). Git root/branch/HEAD/status, scoped-file searches, full diff reads, manifest hashing, snapshot comparison, and service-listener checks were read-only. A few exploratory reads used an incorrect guessed Systems path or rg wildcard/path; their diagnostic errors were corrected by file discovery and subsequent successful reads. They do not constitute a product or environment failure.

## Material limitations

This reviewer did not rerun frontend production build, Storybook build, source formatting, or latest-head CI, and did not commit or alter acceptance/run-state. Root must complete and record those unchanged mandatory gates. Source formatting was not applied because production/tests/docs were read-only; own report was formatted. Focused browser tests and full automated Storybook interactions were executed, but no separate manual visual screenshot review was performed. Finite start-gated race runs complement the transaction inspection; they do not prove every possible schedule. No actionable uncertainty remained within the inspected increment.

## Environment limitations

No environment limitation blocked the review or executed verification. Docker-enabled normal-account escalation succeeded. Non-failing runtime warnings included pg concurrent-query deprecation, Node/Storybook deprecation, and development Clerk/color notices; no assertion or runner failed because of them. Existing tracked/untracked work was preserved, and no environment values or unrelated services were changed.

## Exact snapshot accounting

Manifest SHA256: `2F6044C7DB57170CE51F9C28F569A2DB88BFC05B727AC630A3FC15EE7878956F`.

Inventory: **89 existing files, 10 deleted files; 99 sorted unique entries**. Reports, packet, and run-state are excluded by the mandated apps/packages/docs path scope. Untracked source and migration files are included. The same hash was verified after report generation/formatting.

Recipe (PowerShell, worktree root):

```powershell
$reviewBase = 'acde251d2fb2164eb7cd881fb55fc5f08e52d817'
$reviewPaths = @(@(git -c core.quotepath=false diff --name-only $reviewBase -- apps packages docs) + @(git -c core.quotepath=false ls-files --others --exclude-standard -- apps packages docs)) | Sort-Object -Unique
$reviewRows = @($reviewPaths | ForEach-Object {
  if (Test-Path -LiteralPath $_ -PathType Leaf) {
    $_ + "`t" + (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
  } else {
    $_ + "`tDELETED"
  }
})
$reviewText = [string]::Join("`n", $reviewRows)
$reviewHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($reviewText)))
```

Each inventory line is relative path, TAB, uppercase SHA256 of exact file bytes or DELETED. Manifest hash uses UTF8 of LF-joined lines with no terminal newline. The code block below contains the full inventory:

```text
apps/backend/drizzle/0001_fleet-action-inputs-and-movement.sql	E2C84805F9C11E42071E86D50964F9B1DD75859389531584AFC78DD025EB24E3
apps/backend/drizzle/meta/_journal.json	2C9C952FC5CF254F4BE24DF8F54352EE8723302F38129C84B234942DD2F206BC
apps/backend/drizzle/meta/0001_snapshot.json	24E227BC98382593F11C73E7E9FC124C7664DF8C5F7703298EB07343AD729AD5
apps/backend/src/api/gameplay/gameplay.concurrency.test.ts	BFADA827FB847FD93CBE958818083514E1F8643D56B560DA53149232BA8CA730
apps/backend/src/api/gameplay/gameplay.repository.ts	87CB6269E06DE31DFA13E0D9E127B2DECA7EC46A43FB89DB73244D40AAC86985
apps/backend/src/api/gameplay/gameplay.router.integration.test.ts	FAEAB6B17896B38C9A3B343596C2D07680CCCA0FE438218A90D33DC4E26C7EB9
apps/backend/src/api/gameplay/getPlayerView.useCase.ts	38CA0928DB108D3FF8938CB603FE507FF4520BDD9D9594EC20E44BAB824F2963
apps/backend/src/api/gameplay/SubmittedActionTargetsDto.stub.ts	1CC0B6D4C3BC1502AE5E585300A578AFF028D616E4295281ED92C8B2533D27BB
apps/backend/src/api/gameplay/SubmittedActionTargetsDto.ts	EDF33FAF2890A63CD8A780CB5A898E0BCB9BEA3DE44BF98143C84623F3E42B9A
apps/backend/src/api/gameplay/updateActionSubmission.useCase.ts	738ABD699515CD967B0B0DAFCB5D26E5FEF86902B043AF7FC94DD52514C2F4B3
apps/backend/src/api/types.ts	5488F2E474B087FC9CB82FEDCCF2BF63A51AE88FCA8D67F1AABDB8C3F48FB0C4
apps/backend/src/lib/db/schema.ts	B592E3AF10FBD8F1823D3AC541F31734ADE6C673140B923C510C50119B2F9944
apps/backend/src/lib/rulesets/standard/action-definitions/build-fleet.ts	FECD55F302F7BF28C49C8E4D634011CC284E04ECC23C4DF787B8F32248C21A74
apps/backend/src/lib/rulesets/standard/action-definitions/gain-energy.ts	95BE71B4722CA328707B1BD2753C3CE0A1E7F85E87AD9E5E5C31625085489462
apps/backend/src/lib/rulesets/standard/action-definitions/gain-fuel.ts	87BF5AA6E5FFEA343940B29F4AFA4B428545F402DE11D2530D6A75576EAC3EAC
apps/backend/src/lib/rulesets/standard/action-definitions/gain-influence.ts	41DA7621971A4057995871B905BD0237419E6C327AD7E9BFDD7EEE98C5E0CB9F
apps/backend/src/lib/rulesets/standard/action-definitions/gain-metal.ts	86370DB9F88C92C868ADAD7A91ACD72A6F3C478CF247CF4139DBD90493A389F2
apps/backend/src/lib/rulesets/standard/action-definitions/move-fleet.ts	6B54A5D8F5C2AE0BDAC100012D4937BBAC695CAD4EC6DCA7440CB838BCEAAF34
apps/backend/src/lib/rulesets/standard/action-definitions/move-fleet.unit.test.ts	BD841FFE5A980D8D36F0C72A19080FA776E05850437340675DF6E7D7375C3D9D
apps/backend/src/lib/rulesets/standard/action-definitions/win-the-game.ts	1A173EC94590245EC9C20F27DA6EE473D2194FADF439ABF71E2A74F01225073D
apps/backend/src/tests/ConcurrencyTestApiServer.ts	EB8BBF3455B67711F8A01BE5C5F644243BD253D7FBD15529F340DDBEDBC0B8D3
apps/backend/src/turn-processing/TurnProcessor.integration.test.ts	0349982FB9DD686627148AE5E601185A86DDE3A2A33446D95E1C21BF673D505D
apps/backend/src/turn-processing/TurnProcessor.ts	A5B01E0CBEF7DB73E847B2ED499C6ABCC0CE769A8B72F5201C44BDAB70AB1806
apps/backend/src/turn-processing/turns.repository.ts	650B3EAD667E12DDBEA0D7A22FCC28CC6FBCAB455DE3AD89BA8B611309142827
apps/frontend/playwright/pages/ActionsPage.ts	B4BC4EABDBBDE38B4FE8AB076EDFEA328A85F63DBF7F428F6DA7FD683D42C2CF
apps/frontend/playwright/pages/BasePage.ts	BC3AFA47617E85C7FE859E5263F0EB02AEF20848CEC6EE6DEB39D5E9C8120F1B
apps/frontend/playwright/pages/FleetsPage.ts	732534288DCEEFB24C3BEBC644C633E326A4F58D119F2FFF13EA677A8C434525
apps/frontend/playwright/specs/actions.spec.ts	6EB655FAFD3D5D703E205E7B93E6A1F713C33A1BC447103A4B334E425A104EC5
apps/frontend/playwright/specs/fleets.spec.ts	A47B8F10C10EF8CCB1E883C4297D30DA8326F5AB6A8D7574E8596A0C36C4F4F1
apps/frontend/playwright/specs/readiness.spec.ts	F7835494B7EB7D38EB0DD58E837D6F90335FB2E68AA0816DAE4D76E80FDFE981
apps/frontend/src/features/play/components/ActionCard.stories.tsx	EA1F7EB4509DDAC5B28C75711826AD2458C04157AD413E02D0D6B07B1F1E2777
apps/frontend/src/features/play/components/ActionCard.tsx	9E62FD1890E2F2C917F8B43949BFA10C0AAA11459769438EC118D61AEE035304
apps/frontend/src/features/play/components/ActionSelector.tsx	469C02A604AE7AA502DFA63878E0EF18EFB16725413E2E6CF2D864DD14121F8C
apps/frontend/src/features/play/components/TargetPicker.tsx	A21A8A8022CAABE40E30B7A7A8635D2BAC0AD41340F6CF418B40C3F0F6CEC30B
apps/frontend/src/features/play/fleets/FleetsPage.stories.tsx	2477D6D3D70D87C4C7DF9ACA4353F1B934B302ED2F4FD05C62B9C54045F1B134
docs/architecture/turn-processing.md	AC277D244F880CB448F2250E6AB360F00AD1F1F1958B6B763FD58FF73E8C6303
docs/architecture/turn-resolution.md	E2E90DCE6ABB20B8C48DA5EA5BF9A01A7787F9242F197CE9132530016F4D779E
docs/game-design/systems/001-turns.md	0D7A453EBD65E13480B0B337D68963C9E3A50826E5B6F31174D1C2B9B0AF00AF
docs/game-design/systems/003-actions.md	29D64A4FE4C781E471632BF36FE1030D6FF2F1FDE8E59C6833E6195550443652
docs/game-design/systems/010-fleets.md	73F67B15135D5C83C04BADCF18F4BAE856E81CEEE7174905D3FAF484A2D7C91A
docs/game-design/systems/012-movement.md	FD208F520A8B1A900159FD52347875D2622F9FF2AA19E9A3B181429600D3D0BF
docs/game-design/systems/015-rules-engine.md	2E91004165835CFDA2219322BFB63A839C828511489625BE8DBBE7BA76B58DB8
docs/game-design/systems/README.md	8292F5216BEB5DA7AC2BB1D91F1992F2E8318B6EC1AF0CC08BAB72F59C890987
docs/glossary.md	6B07B2701D6C9ECD8563E0BAD7D4CCF9F63FA8296729EA6AB79ABAF69F57B58F
packages/shared/src/action-submission/computeAvailableActions.test.ts	E952523D62DCF433D4D6B9992E4B11CD33FCC5DB67544424CAEA52F7A0F8BBF5
packages/shared/src/action-submission/computeAvailableActions.ts	359272D4A671C5C6CD07F509D9FFC490A4498AB60F195C53AD44993454A92F91
packages/shared/src/action-submission/evaluateActionSelection.test.ts	6FDF6243057E5868C110826447A4CDE2224B1929738FF6FA47291545976394E2
packages/shared/src/action-submission/evaluateActionSelection.ts	5091F6FF36B0B72739D77A7985E1AEFC161B9816CD03F7701DAA7DB078DEAC96
packages/shared/src/action-submission/getUncommittedResources.ts	DELETED
packages/shared/src/action-submission/validation/costs/validateCosts.test.ts	DELETED
packages/shared/src/action-submission/validation/costs/validateCosts.ts	DELETED
packages/shared/src/action-submission/validation/targets/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.test.ts	DELETED
packages/shared/src/action-submission/validation/targets/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.ts	DELETED
packages/shared/src/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts	DELETED
packages/shared/src/action-submission/validation/targets/validateTarget.test.ts	DELETED
packages/shared/src/action-submission/validation/targets/validateTarget.ts	DELETED
packages/shared/src/action-submission/validation/targets/validateTargets.test.ts	DELETED
packages/shared/src/action-submission/validation/targets/validateTargets.ts	DELETED
packages/shared/src/action-submission/validation/validateSubmittedActions.test.ts	52A3515035B8CA3567266EBE192CBA496FBFC0FAC57CA97DA19478B07E182280
packages/shared/src/action-submission/validation/validateSubmittedActions.ts	84268A551EA8B66F383C36A0F744F02BC128C7225E92800815703268CFB3016E
packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.stub.ts	0C53B5FE152B5AB9C1BB254EE7B240459740F7E49081384E78D6800411A7BB2A
packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts	ACF178DCF3203093158B210F4E804BF157F65008CAABA023493918359B421048
packages/shared/src/domain/ruleset/action-definitions/ActionInputDefinition.ts	20F4BB424B74E55BC26B9CFF6DB18865BD11AAB688C3F4DE9A1A2324407E7EB5
packages/shared/src/domain/ruleset/action-definitions/InputTag.ts	66421AC8E0794505A7F1470D2CFF91EEEEC2AE1FE44CF23CC721DD34B2CD07F8
packages/shared/src/domain/ruleset/action-definitions/PositiveInteger.ts	C982794D77D26F37F5F95D79B6A6C90E832CFE9842DAEB370E3CDC4BF4D26EB1
packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.stub.ts	9DBC7DC76EFC089FA917D27F26B733AF96E70D24855464D8A73A178F4317FA01
packages/shared/src/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts	85BDB6DDA68560CD21D6D7263DE0CE3686D30C7BF2428942139FDB242EE7897C
packages/shared/src/domain/ruleset/Ruleset.stub.ts	79F9A5D977CA9899390565A555284529C0022BE416F809C9E3553C24D32534CF
packages/shared/src/domain/ruleset/Ruleset.test.ts	414319636F5C43C9343D9EE9518ACF3E0C1CF7839EA8068DF5FD053BE51F160C
packages/shared/src/domain/ruleset/target-definitions/AbstractTargetConstraint.ts	A28EE1E62975683C55C0B07EAB99B7638CB5CB6FBEADF987DAB88EF8068BD658
packages/shared/src/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts	FCAE978A889550DE667FB0A9F6A144E1D3B19C45F01FFEB8DFA46858C56B52A5
packages/shared/src/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts	CCCD749B8FDB5BDA416C90E194F950BC583EF741F50487246BEC990F0653B237
packages/shared/src/domain/ruleset/target-definitions/TargetConstraint.ts	62EAF1C38C1C4ABBC6B555A9F0CF8A66CC7CD866D4BE433CDDFD44DF5C82448C
packages/shared/src/domain/ruleset/target-definitions/TargetDefinition.ts	B3BF8C8F9AC4C1D61480F364461161217CBDDF4FC0C2DDF1DAA486F7AFE958DC
packages/shared/src/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts	77B106CC6FB5FE3096C654D9887B5307CBB71258A0649EFEBAB1639C7181F00B
packages/shared/src/domain/turns/actions/Action.stub.ts	8D83CD5B89A40D11C785FF7B16841A4FFE5FCAD1DCD842D5FCBE5CE327917AC6
packages/shared/src/domain/turns/actions/Action.ts	F1AA18D322EB3987932C149B35B08358F5E1FC3F29DD9D0F66E0BB7BAB789417
packages/shared/src/domain/turns/actions/SelectedInputs.ts	E8102EFF8113172571BF329AF62D8183E838BBA23739104F6BAC07F014AC2E76
packages/shared/src/domain/world/fleets/Fleet.ts	BC842D4CDB899314437EE4D34D2BB5241B02586586026419BE8F9C7A021000AF
packages/shared/src/testing/FleetActionSelectionParity.ts	1E849D2E0E0AE2960F12FDBFDE5B013984D58D4F829D66D491876D3418958463
packages/shared/src/testing/test-ruleset/action-definitions/build-fleet.ts	AE0DD467058C7CD5514CCFA220EF9B550363A41E5580D8FB957D2AB0B21AB840
packages/shared/src/testing/test-ruleset/action-definitions/gain-energy.ts	6126187D33448DE3B12C8F4A9C7081982BF5C880D401B7CECABD2FF87C101C49
packages/shared/src/testing/test-ruleset/action-definitions/gain-fuel.ts	BF875E318ABCBDA502F475C1A518CA626A47594C598E4AEE41257849FE3B6700
packages/shared/src/testing/test-ruleset/action-definitions/gain-influence.ts	6BCD6C33587D474AA06DA3A56E2B4C47D1F900E7435FD542182BAC66F64D4968
packages/shared/src/testing/test-ruleset/action-definitions/gain-metal.ts	F3E72242793E1F662650200563805D9DE71DF509F8AA8B8A3205A554BE3D6AA0
packages/shared/src/testing/test-ruleset/action-definitions/move-fleet.ts	AE2AE54A03AA015C37692226ACA3D0C67A8CDFB92BFA17A7AA525D37942CE0EC
packages/shared/src/testing/test-ruleset/action-definitions/win-the-game.ts	EF4BC488BFDF1155557E2A3FD86F5B252E9DA075BA4621FFBE8F34ADB300AF5B
packages/shared/src/testing/test-ruleset/TestRuleset.ts	BE3C07DBA8719E55E9AA5FA3E33F9BDA99E96B54DB71022C1AA75CBD6A29BCC2
packages/shared/src/turn-resolution/effects/EffectPool.ts	56D16C813C3FABDBDC6C2005236E8190CAF2E2EF0435A7A8A2E1BA5C7867C65F
packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.test.ts	546FE13DCDED6BD540B80520E69E2B18C00E89659383F45DCFE94EFC73FCF114
packages/shared/src/turn-resolution/effects/implementations/FleetMoveEffect.ts	C15820ACBD3D3DFE3FD9D8CFEC7E3A1D1366F73CD2C1155C15D9ACDD476C9DC0
packages/shared/src/turn-resolution/effects/resolveTargetId.ts	E7FB519E8F64985CC14C6F99158D28BB6A7AA112CF7ACD62605856E0987CA6DF
packages/shared/src/turn-resolution/fleet-movement.test.ts	D80A4FB55DF0063C99CEE06A395B2D9FF8FE0F0C6A6669B7FE5A5FB06C1EF1DD
packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts	47AB9B6F31085DCD5D2454A80FAB1ED65522B285FC7796D3117BE854E6DAA91B
packages/shared/src/turn-resolution/ResolvedTurnState.ts	E1075CC46B26F29FFE8E3A0B2C87AAAA5DD3C7E70901BF033D4FE7C8E9B1BA94
packages/shared/src/turn-resolution/resolveTurn.test.ts	196795DF07DD4390A34A92A77B9EC51A5BD445304524E3AA8F8006D5FD8A9A5B
packages/shared/src/turn-resolution/resolveTurn.ts	19FB7B55A44CF43661E0688E22843488BE2A0E7DECFD5220C7787C2317D32983
packages/shared/src/turn-resolution/TurnContext.ts	793579E830F6679DD44BE3DFC3D64BC3EA1055811CDDD1D486AAF84772A98441
packages/shared/src/turn-resolution/TurnState.ts	8BD609399B66407DE67FD70D428F5A80390C2DBBFEFA8AB1C414986FFDAD691D
```

## Stop boundary

**STOP writes.** Only this assigned report was written by the reviewer. Production, tests, migrations, existing docs, packet, run-state, and other reports remain untouched. Findings: none. Root owns subsequent decisions and final acceptance.
