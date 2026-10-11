# Increment 01 independent reviewer r3

Verdict: actionable findings. This reviews the complete current I1 increment against approved v1, including tracked and untracked apps/packages/docs paths, rather than only correction lines. No prior implementer, tester, reviewer, or orchestrator verdict reports were read before these conclusions.

## Snapshot and scope

- Actual root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`.
- Actual branch: `codex/fleet-operations-experiment`.
- Actual HEAD and review base: `acde251d2fb2164eb7cd881fb55fc5f08e52d817`.
- The increment is uncommitted. Initial status contained tracked modifications/deletions and untracked source, tests, migration SQL/snapshot, increment packets and reports. The main checkout was never used or modified.
- Production, tests, existing docs, packet and run-state were read-only. This report is the only intentional written review file; commands also produced ignored test/build artifacts. No commits, pushes, PR changes, environment-value changes, subagents, or source/test fixes.

Read the reviewer persona, authoritative requirements and approved increment packet; root/shared/backend/frontend/playwright/docs AGENTS; coding standards and glossary; installed tools-ts 10.1.2 README; ADR index and accepted 007/008/011/013/015–031; turn-resolution and turn-processing guides; GDDR index/009; Systems index and 001/003/008/010/011/012/014/015. The experiment requirements govern deferred colonization choices, without reopening settled scope.

Inspected the shared public evaluator and all three consuming adapters, numeric schemas/input/effect mappings and dependent constraints, arbitrary tags and invalid composition checks, replacement/cancellation ledgers, source eligibility, canonical splits/IDs, once-per-turn continuation and payment, effect-pool outcomes, per-instance occupancy, turn-row locking and closure, migration/JSON/load/save/cleanup, Standard and Test content, frontend drafts/candidates/in-progress presentation and existing fleet/map consumers, changed test support/scenarios and documentation statuses. Assault, Colonize and composed deferred arrival intents remain outside I1. No additional actionable harmful duplication, speculative abstraction, or missing generalization was identified in the mechanics inspected.

## Findings

### R3-01 — P2 — Decimal-speed journeys can arrive one whole turn late

Location: `packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts:56`, with the exact-zero arrival check at line 67 and tick calculation at line 70.

Trigger: an eligible Standard Move sends 20 Strength over distance 1 from `(0,0)` to `(1,0)` at the shipped speed `0.1`. Resolve departure turn 1 and nine later turns with no new submissions. Repeated binary floating-point subtraction leaves `distanceToEnd = 1.3877787807814457e-16` after turn 10. The `=== 0` check leaves the Fleet in transit and the Action instance occupied. Turn 11 finally lands it at tick 1, although the configured travel duration is ten turns and the final arrival should occur at tick 20 of turn 10.

Consequence: players lose an extra turn of arrival and Action reuse; the fleet is still unavailable for destination build/other later phases during its intended arrival turn. The bug uses shipped content and legal state, and survives JSON reload because the residual is persisted. The passing suites cover integer-speed tick boundaries, but miss this ordinary decimal-speed journey.

Violated contract: movement must advance by configured speed and arrive when the distance is exhausted; I1-10 automatic continuation/arrival and I1-16 shipped speed values and movement ticks; requirements Movement and System 012.

Independent reproduction used production `resolveTurn`, `TestRuleset`, trusted Action/Fleet/Planet/Turn stubs and seeded RNG, piped to `pnpm --filter shared exec node --input-type=module` without writing a test. Essential setup: owned stationary strength 50 at `(0,0)`; unclaimed destination `(1,0)`; `MOVE_FLEET_STANDARD_1`, mapped fleet/planet, selected input strength 20; ample Influence/Fuel. Feed each successful result's players/planets/fleets into the next numbered Turn with `submittedActions: []`.

Actual relevant output:

```json
{"turn":9,"remaining":0.10000000000000014,"origin":"origin","inTransit":true}
{"turn":10,"remaining":1.3877787807814457e-16,"origin":"origin","inTransit":true}
{"turn":11,"origin":"destination","inTransit":false,"arrivalTick":1}
```

Requested correction: make the arrival/distance boundary robust to floating-point accumulation, with a justified scale-aware numerical policy that preserves genuinely positive remaining travel and bounded 0–20 ticks. Add a behavioral oracle for the shipped `0.1` speed over an exact multiple, including a reload and Action release at the expected collecting turn. Do not change Standard balance values to avoid the defect.

### R3-02 — P2 — Invalid-submission regression tests accept any failure reason

Locations: `packages/shared/src/turn-resolution/fleet-movement.test.ts:326` and `packages/shared/src/turn-resolution/resolveTurn.test.ts:187`.

Trigger: the new corrupt-journey table and incomplete parity submission test verify only `expect(Result.isFailure(result)).toBe(true)` plus unchanged state. A regression returning an unrelated `FAILED_TO_RESOLVE_PHASES` or `UNRESOLVED_EFFECTS` failure before mutation would pass, even though the tests intend to prove authoritative initial validation and the cross-boundary missing-selection contract. Failure output also hides the actual payload behind `false`.

Consequence: these mandatory corruption/partial-selection checks do not establish the promised validation boundary or explanatory issue. This is a concrete missing oracle, rather than a preferred assertion style: different public failure categories are architecturally meaningful here.

Violated contract: approved acceptance preamble requires whole Result assertions; I1-01/I1-07/I1-13 and the rule that corrupt or initially illegal submissions fail authoritative validation; ADR-018 explicitly forbids Result guard assertions for verification.

Requested correction: compare each result with the complete expected `Result.Failure(ResolveTurnError.InvalidSubmissions(...))`, including the relevant exact issues and submission identity, retaining unchanged-state assertions. Use trusted fixture constructors for setup, not a production evaluator to calculate expected errors. This review made no mutation to demonstrate the oracle gap; the precise assertion predicates above establish it directly.

## Executed verification

All commands ran with explicit assigned-worktree workdir and normal-account `require_escalated`; no fallback checkout.

| Command                                                            | Exit | Observed result                                                                                                           |
| ------------------------------------------------------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter shared test`                                        |    0 | 21 files, 130 tests passed                                                                                                |
| `pnpm --filter backend test --project unit`                        |    0 | 2 files, 6 tests passed                                                                                                   |
| `pnpm --filter backend test --project integration`                 |    0 | 6 files, 96 tests passed                                                                                                  |
| `pnpm --filter backend test --project concurrency`                 |    0 | 2 files, 5 tests passed, real Testcontainers PostgreSQL 18.4; API boot migration, real worker and turn-row races executed |
| `pnpm --filter frontend storybook:test`                            |    0 | 15 files, 54 Chromium story/native tests passed                                                                           |
| `pnpm typecheck`                                                   |    0 | Root TypeScript check passed                                                                                              |
| `pnpm lint`                                                        |    0 | Oxlint passed                                                                                                             |
| `pnpm --filter frontend build`                                     |    0 | Vite production build passed                                                                                              |
| `git diff --check acde251 -- apps packages docs`                   |    0 | No whitespace errors                                                                                                      |
| Read-only decimal-speed native reproduction via stdin              |    0 | Reproduced R3-01 output above                                                                                             |
| `pnpm exec storybook skills stories` and `write-story` in frontend |    0 | Installed guidance loaded after repository Storybook skill                                                                |

The concurrency runner emitted the existing pg warning about parallel queries on one client; Storybook emitted module.register/Vite plugin warnings. They did not prevent execution or disposal; both long-running backend commands were followed through process exit. An initial multiline `node -e` attempt exited 0 without output and is not correctness evidence; the stdin reproduction above is the actual verified run.

No environmental blocker was encountered. This reviewer did not rerun E2E, Storybook build, or individual shared/backend/frontend typecheck scripts; E2E source was inspected, and the Storybook/E2E skills were loaded before corresponding consideration. Full applicable E2E, exact-prefix Storybook build and per-package gates remain the orchestrator's required acceptance work. Passing executed gates do not override the findings or approve a later edited snapshot.

## Exact tracked-plus-untracked manifest

The inventory below excludes reports/run-state by limiting the union to `apps packages docs`. It includes untracked sources, tests and both migration files, plus deleted tracked paths.

Recipe (PowerShell, from the actual review root):

```powershell
$base = 'acde251d2fb2164eb7cd881fb55fc5f08e52d817'
$tracked = @(git -c core.quotepath=false diff --name-only $base -- apps packages docs)
$untracked = @(git -c core.quotepath=false ls-files --others --exclude-standard -- apps packages docs)
$paths = @(@($tracked) + @($untracked) | Sort-Object -Unique)
$lines = @($paths | ForEach-Object {
  $path = $_
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    "$path`t$((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant())"
  } else {
    "$path`tDELETED"
  }
})
$text = $lines -join "`n" # no terminal newline
[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text)))
```

Aggregate SHA256: `F2AB06BE0B19D19FFF68D831B820B9E92ED8801FB0E12080C7E663EB4F351166`. Existing files: 89. Deleted paths: 10. Total paths: 99.

Full inventory (each line is relative path, TAB, uppercase exact-byte SHA256 or DELETED):

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
apps/backend/src/turn-processing/TurnProcessor.integration.test.ts	03E7AE575A99171D95B2A0F2C614618946E3B58E887663FE3ADA2F0485F245B6
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
packages/shared/src/action-submission/validation/validateSubmittedActions.test.ts	FD2AC087A86F139BD4FE02F66820FDB603039934D0B44595537DD5F5B5310DA3
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
packages/shared/src/turn-resolution/fleet-movement.test.ts	617054F3388EEB468CA72A458BB3A6A732B05EFEAADE5CA2F4C84091F93C2E31
packages/shared/src/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts	48A0A89ED2E7FB7B0DC07AA260573CDDB8329103F88731E7B5618A145D52AEF6
packages/shared/src/turn-resolution/ResolvedTurnState.ts	E1075CC46B26F29FFE8E3A0B2C87AAAA5DD3C7E70901BF033D4FE7C8E9B1BA94
packages/shared/src/turn-resolution/resolveTurn.test.ts	4017808AFF09B52D0A85A3884AB1D7C0C925A3D54F8B6C4F66AB09AC1798CB8A
packages/shared/src/turn-resolution/resolveTurn.ts	19FB7B55A44CF43661E0688E22843488BE2A0E7DECFD5220C7787C2317D32983
packages/shared/src/turn-resolution/TurnContext.ts	793579E830F6679DD44BE3DFC3D64BC3EA1055811CDDD1D486AAF84772A98441
packages/shared/src/turn-resolution/TurnState.ts	8BD609399B66407DE67FD70D428F5A80390C2DBBFEFA8AB1C414986FFDAD691D
```
