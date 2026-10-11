# Increment 01 independent reviewer R2

## Verdict and exact snapshot

**Changes requested: R2-01 (P2), R2-02 (P3), R2-03 (P3), and R2-04 (P3).** The original independent full review established R2-01/R2-02 in verification. After that review was delivered, targeted disposition of two separate root observations established R2-03 (unsound player-view/domain adapter contract) and R2-04 (missing required exhausted-source UI regression coverage), documented in the supplement below. No wrong current eligibility decision or product failure was demonstrated for R2-03/R2-04. No other actionable findings for the entire final tracked and untracked increment against the supplied base, including the migration, source, tests, frontend stories/E2E changes, and affected existing documentation.

Reviewed root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`. Actual Git root, branch `codex/fleet-operations-experiment`, and HEAD/base `acde251d2fb2164eb7cd881fb55fc5f08e52d817` verified. The increment remains dirty and preserved. Main checkout was never used. No prior implementer/tester/orchestrator reports or run-state finding narratives were read. Conclusions came from the approved v1 packet, authoritative requirements, complete changed-file scope, surrounding public interfaces, and independent executions.

Final source/test/documentation manifest SHA256: **DD23FBCD1EBECE4CBF5369E35AF93559599F04E068594E08519AC04528021792**. **89 existing files, 10 deleted paths, 99 total entries.** Reports and run-state are excluded. This verdict applies only to these exact bytes.

## Actionable findings

### R2-01 — P2: competing workers make the mandatory closure regression fail nondeterministically

Location: `apps/backend/src/api/gameplay/gameplay.concurrency.test.ts:422`–`:423`; the same orchestration recurs at `:501`–`:502`. Supporting interfaces: `apps/backend/src/tests/ConcurrencyTestApiServer.ts:37`, `apps/backend/src/turn-processing/turns.repository.ts:145` and `:178`.

The test starts the actual API process with its background worker, then also constructs a manual TurnProcessor against the same isolated PostgreSQL database. After Ready closes Turn 1, the background worker can finish that turn before the test advances its independent clock by 60 seconds and calls its manual worker. Turn 2 is then COLLECTING_ACTIONS, but its processing queue row is already scheduled within the manual clock's future horizon. Queue selection filters scheduledFor and processingStartedAt, without requiring AWAITING_PROCESSING. The subsequent startTurnProcessing update requires AWAITING_PROCESSING and returns no row, triggering the assertion at repository line178. The two games sharing that container and a second 60-second advance also allow the readiness game's later queue row to interfere with the deadline game's manual processing.

Observed evidence: the focused concurrency file failed with exit1 at test line423 / repository line178; the targeted same test passed on rerun. An isolated replay through the public router established the cause: after allowing the real worker to finish the ready turn, the player view reported `{"turn":2,"status":"COLLECTING_ACTIONS"}`; advancing the manual clock then calling its worker produced `AssertionError: Expected condition to be true`. The exception was caught for diagnostic output, so that replay command exited0.

This is a regression-test orchestration defect, not evidence that the reservation transaction permits overspending or post-closure writes. It violates I1-15's mandatory reliable readiness/deadline-worker evidence and the approved quality gate requiring real PostgreSQL concurrency. Coordinate ownership/observation of the intended processing transition and isolate the games' queue horizons so the test validates both allowed lock orders without competing unobserved processing or selecting another turn. Preserve the public-router and actual PostgreSQL boundaries; a passing rerun alone does not resolve it.

Reproduction (PowerShell, from this worktree; uses only a fresh Testcontainers database and public game/readiness routers):

```powershell
@'
process.execArgv.length = 0;
const { setTimeout } = await import("node:timers/promises");
const { Time, UnitOfTime } = await import("@guillaume-docquier/tools-ts");
const { createGameConfigurationStub } = await import("shared/domain/games/GameConfiguration.stub.ts");
const { ControlledClock } = await import("./src/lib/ControlledClock.ts");
const { ConcurrencyTestApiServer } = await import("./src/tests/ConcurrencyTestApiServer.ts");
const { createTurnProcessorStub } = await import("./src/turn-processing/TurnProcessor.stub.ts");
const server = await ConcurrencyTestApiServer.create();
try {
  const player = await server.createClient({ authenticated: true });
  const clock = new ControlledClock({ startDate: new Date() });
  const { turnProcessor } = await createTurnProcessorStub({ db: server.database, clock });
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({ turnIntervalSeconds: 10, mapGenerationSeed: 1234 })
  });
  await player.client.games.startGame.mutate({ gameId });
  const initial = await player.client.gameplay.getPlayerView.query({ gameId });
  await player.client.gameplay.updateReadiness.mutate({ gameId, turn: initial.turn, isReady: true });
  await setTimeout(1500);
  const background = await player.client.gameplay.getPlayerView.query({ gameId });
  console.log("BACKGROUND_STATE", JSON.stringify({ turn: background.turn, status: background.turnStatus }));
  clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) });
  try { console.log("MANUAL_RESULT", await turnProcessor.processNextDueTurn()); }
  catch (error) { console.log("MANUAL_FAILURE", String(error)); }
} finally {
  await server[Symbol.asyncDispose]();
}
'@ | pnpm --filter backend exec node --input-type=module
```

On slower hosts wait for the observed Turn 2 collecting transition before the manual call; the failure depends on that state, not on the precise 1500ms delay.

### R2-02 — P3: new Ruleset tests discard the Result payload and relevant schema error

Location: `packages/shared/src/domain/ruleset/Ruleset.test.ts:205`, `:384`, and `:385`.

The arbitrary-role/composed-gain case asserts only `Result.isSuccess(result)`. The invalid infinite-speed and zero-range cases assert only `Result.isFailure(...)`. They neither verify the expected normalized success value nor establish that the specific speed/range fields caused rejection. Any unrelated schema failure would satisfy the latter tests, and a failure of the success case reports only a boolean rather than the actionable payload. These are new mandatory I1-08 composition/schema oracles.

Accepted ADR018 explicitly requires comparing the full Result during verification instead of a boolean success-tag assertion; its stated reason also applies to boolean failure checks. Assert `Result.Success(expectedRuleset)` for the positive case, and full `Result.Failure(...)` objects containing the relevant field-path/error evidence for speed/range. The adjacent mapping and multiple-move tests already demonstrate this useful pattern. No production defect is inferred from these assertions.

## Scope and conclusions

Reviewed I1-01 through I1-17 against the actual shared evaluator and its UI/API/locked-resolution projections, complete retained resources and Strength ledgers, replacement/cancellation identity, arbitrary role/input tags, schema composition checks, owned stationary sources, inclusive dependent distance, safe integer force, atomic turn-row serialization, deterministic allocation, full-source deletion, once-per-turn progress, one-time payment, persisted provenance and occupancy, busy null cancellation/edit/redirect rejection, tuple/load corruption, migration chain, survivor identity, ordinary enemy co-location, transient continuation outcomes, fixed phases, and accurate existing documentation/statuses. Assault, Colonize, and deferred composed arrival intents remain outside this increment.

The evaluator is an actual runtime boundary shared by all three callers. API reads and mutation occur under the same turn-row transaction. Worker dependencies remain independent of API modules, and runtime app imports respect shared-package boundaries. Departure allocation precedes arrivals and builds; continuation does not become a new payable submission. Explicit removedFleetIds reaches database deletion. Movement provenance allows a deleted original source to remain historical while live sources still require existence. Friendly stationed identity survives; ordinary enemy Fleets remain unchanged. No content behavior selected by action ID/name/tier/UI label was found.

The larger evaluator is justified by present partial-selection, candidate, full-submission, ledger and journey-validation mechanics. Removal of the old independent validators reduces harmful duplicated rules. I found no concrete unnecessary abstraction or missing generalization warranting a separate finding; no speculative future scripting refactor is requested.

Read repository/persona instructions, nearest scoped AGENTS for shared/backend/frontend/Playwright/docs, TypeScript standards, glossary, installed tools-ts README, ADR index and relevant accepted007/008/011/013/015–031, turn architecture guides, GDDR index/009, and Systems index/001/003/008/010/011/012/014/015. Requirements supersede the older deferred colonization choices. The installed Storybook skill and maintained stories/write-story guidance were loaded before Storybook execution.

## Actual verification

Every started runner was followed to its exit. Commands ran in the exact worktree with normal-account required escalation where applicable.

| Command                                                                                                                                                       |   Exit | Observed result                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------------------------------------------------- |
| `pnpm --filter shared test`                                                                                                                                   |      0 | 21 files, 130 tests                                        |
| `pnpm --filter backend test --project unit`                                                                                                                   |      0 | 2 files, 6 tests                                           |
| `pnpm --filter backend test --project integration src/api/gameplay/gameplay.router.integration.test.ts src/turn-processing/TurnProcessor.integration.test.ts` |      0 | 2 files, 46 tests                                          |
| `pnpm --filter backend test --project concurrency src/api/gameplay/gameplay.concurrency.test.ts`                                                              |      1 | 1 passed, 1 failed; R2-01 at line423                       |
| `pnpm --filter backend test --project concurrency src/api/gameplay/gameplay.concurrency.test.ts -t "serialize submissions against readiness"`                 |      0 | 1 passed, 1 skipped; demonstrates timing sensitivity       |
| Isolated public-router/background-worker replay above                                                                                                         |      0 | Caught/reported R2-01 after observed Turn2 collecting      |
| `pnpm --filter frontend storybook:test src/features/play/components/ActionCard.stories.tsx src/features/play/fleets/FleetsPage.stories.tsx`                   |      0 | 2 files, 13 Chromium component tests                       |
| `pnpm exec storybook skills stories`, `pnpm exec storybook skills write-story` (frontend workdir)                                                             | 0 each | Maintained guidance loaded                                 |
| Fresh PGlite migration-chain inline script through `pnpm --filter backend exec node --input-type=module`                                                      |      0 | Both actions.selected_inputs and fleets.movement are jsonb |
| `git diff --check`                                                                                                                                            |      0 | No whitespace errors                                       |

The PGlite migration script imports PGlite, drizzle-orm/pglite and its migrator; creates a new in-memory client; runs `migrate(drizzle(client), { migrationsFolder: "./drizzle" })`; queries information_schema for the two new columns; and closes the client. Actual isolated PostgreSQL API boot in concurrency execution also applies the migration chain, then exercises JSON round-trips and full-allocation source deletion.

Material limits: I did not independently rerun the full E2E suite, full Storybook suite, frontend build, lint, or package/repository typechecks. E2E modifications were source-reviewed. Root owns the final complete acceptance execution. Focused green checks do not establish the unexecuted quality gates, and the concurrency failure precludes a clean gate conclusion.

Environmental/invocation observations, separate from defects: no approval, database availability, or dependency blocker remained. An initial inline replay invocation inherited `--input-type=module` into the forked API and exited1 with ERR_INPUT_TYPE_NOT_ALLOWED/startup timeout. Clearing process.execArgv corrected that invocation; the corrected run completed and disposed its server/container. Occasional guessed read paths failed and were corrected; they are not product findings. No environment values were modified.

## Manifest recipe

Run from the exact worktree in PowerShell. The sorted union includes untracked migrations, source and tests. Hash exact file bytes, use uppercase hashes, preserve relative paths and literal TAB separators, join with LF and no terminal newline, then hash UTF-8 bytes. No report/run-state paths enter this scope.

```powershell
$base = 'acde251d2fb2164eb7cd881fb55fc5f08e52d817'
$paths = @(
  @(git -c core.quotepath=false diff --name-only $base -- apps packages docs) +
  @(git -c core.quotepath=false ls-files --others --exclude-standard -- apps packages docs)
) | Sort-Object -Unique
$lines = @($paths | ForEach-Object {
  if (Test-Path -LiteralPath $_ -PathType Leaf) {
    $_ + "`t" + (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
  } else {
    $_ + "`tDELETED"
  }
})
$manifest = [string]::Join("`n", $lines)
[Convert]::ToHexString(
  [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($manifest))
)
```

Full inventory (relative path, TAB, SHA256 or DELETED):

```text
apps/backend/drizzle/0001_fleet-action-inputs-and-movement.sql	E2C84805F9C11E42071E86D50964F9B1DD75859389531584AFC78DD025EB24E3
apps/backend/drizzle/meta/_journal.json	2C9C952FC5CF254F4BE24DF8F54352EE8723302F38129C84B234942DD2F206BC
apps/backend/drizzle/meta/0001_snapshot.json	24E227BC98382593F11C73E7E9FC124C7664DF8C5F7703298EB07343AD729AD5
apps/backend/src/api/gameplay/gameplay.concurrency.test.ts	A05714174FDB85909BDB4E7B89298D43145AD690AF14F559980AAE46EBCF5450
apps/backend/src/api/gameplay/gameplay.repository.ts	87CB6269E06DE31DFA13E0D9E127B2DECA7EC46A43FB89DB73244D40AAC86985
apps/backend/src/api/gameplay/gameplay.router.integration.test.ts	FAEAB6B17896B38C9A3B343596C2D07680CCCA0FE438218A90D33DC4E26C7EB9
apps/backend/src/api/gameplay/getPlayerView.useCase.ts	922C6E0AEE2B8BCCA1E2C4786263C4311F41B897C6C43C849D3E13A035EAA37F
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
apps/frontend/src/features/play/components/ActionCard.stories.tsx	9BA705C48AD82E4BCA89184B9DC44EB84D6AE0E274776B382A1CCC37A52E27BA
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
packages/shared/src/domain/ruleset/Ruleset.test.ts	146B3746388421CF4577F9EC72E9F6A671F682908B50B96CDD755509719222E7
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
packages/shared/src/turn-resolution/resolveTurn.test.ts	CCFCC779E723C76B80291C79D3A1588FDDCCF2FA8CC23D22F734A9BDD64CDFB1
packages/shared/src/turn-resolution/resolveTurn.ts	19FB7B55A44CF43661E0688E22843488BE2A0E7DECFD5220C7787C2317D32983
packages/shared/src/turn-resolution/TurnContext.ts	793579E830F6679DD44BE3DFC3D64BC3EA1055811CDDD1D486AAF84772A98441
packages/shared/src/turn-resolution/TurnState.ts	8BD609399B66407DE67FD70D428F5A80390C2DBBFEFA8AB1C414986FFDAD691D
```

## Supplemental dispositions requested after independent full conclusions

This supplement follows the root's two separate observations after the complete independent review was delivered. It adds **R2-03 and R2-04, both P3**, to the existing R2-01/R2-02 changes-requested verdict. No prior role report/run-state narrative was consulted. The live public interfaces and current story coverage were re-read; no source/test changes were made. The original manifest remains the reviewed snapshot.

### R2-03 — P3: the player-view adapter passes incomplete objects as full SubmittedActions

Location: `apps/backend/src/api/gameplay/getPlayerView.useCase.ts:66`–`:67` and `:175`. Supporting definitions: `apps/backend/src/api/gameplay/gameplay.repository.ts:89`, `:500`; `packages/shared/src/domain/turns/actions/Action.ts:29`.

Every submitted PlayerViewActionModel intentionally contains id, actionDefinitionId and non-null selections, but no playerId. toPlayerViewAction returns exactly that shape. isSubmittedAction nevertheless claims `action is SubmittedAction`, whose domain type and runtime schema require playerId. Filtering with that predicate changes the static type without creating the missing field; toPlayerViewDto actually supplies these incomplete objects to evaluateSubmittedActions' `readonly SubmittedAction[]` parameter. A selected ordinary Action therefore triggers the unsound adapter contract now, independently of any future feature.

Current evaluateSubmittedActions converts these submissions into proposals without reading their playerId, and createEligibilityState separately supplies correctly owned full Actions. Consequently, no incorrect current resource/Strength decision or authorization bypass is demonstrated. The actionable problem is the present false type guarantee at the application/domain boundary: the value being passed does not satisfy the advertised SubmittedAction contract, and the guard hides the required normalization from typechecking.

This violates the approved plan's complete normalized shared-boundary projection and the repository's domain schema/type boundary discipline. Narrow the repository view model only to its own submitted-selection variant. Then explicitly construct owner-correct SubmittedActions, preferably by deriving submitted domain Actions from the already normalized eligibilityState.actions. Avoid claiming that a DTO already contains fields it does not contain. This is a bounded adapter correction, not a request to widen the transport contract or change evaluator ownership semantics.

Precise reproduction by shape: any repository action with non-null selections passes the predicate; `action.playerId` is undefined and SubmittedActionSchema parsing that same object reports a missing playerId. The current evaluator does not access that property, explaining why the passing integration tests do not disprove the contract finding.

### R2-04 — P3: retain a distinct frontend exhausted-source negative oracle

Location: `apps/frontend/src/features/play/components/ActionCard.stories.tsx:427`–`:535` (current CommittedSourceCandidateFeedback). Relevant covered shared case: `packages/shared/src/action-submission/evaluateActionSelection.test.ts:574`.

The current story edits an instance allocating20 from Home50 while another instance retains30. After clearing the edited force, own-instance exclusion leaves20 available; Home correctly remains a selectable candidate. This is useful coverage and should remain. It cannot assert the separate exhausted-source behavior: another instance reserves all50, the displayed instance is fresh with blank force/source, Home has zero unallocated Strength and must be absent from the selectable options while unreserved alternative sources remain selectable.

The shared test proves the evaluator's zero-remaining decision. Current UI stories exercise eligible sources, dependent destination rejection, occupied Actions and renamed tags, but no current story asserts this exhausted-source option rejection. I1-06 explicitly requires consistently rejecting exhausted sources at S+B+F, and the plan requires frontend candidate decisions from full normalized retained state. Omitting other retained commitments from the frontend projection, or accidentally rendering an exhausted candidate as selectable, could leave the current20+30 positive story green while violating that criterion. Thus the gap has a specific distinct failure oracle, not an arbitrary demand for another test count.

Retain the edit-exclusion story and add a separate actual ActionCard story with the fully reserved50/fresh blank draft. Assert Home is absent from selectable options, at least one alternative remains visible/selectable, and the blank draft cannot submit. No product failure was observed; classification is missing required frontend regression coverage.

## Supplemental verification and STOP

Only targeted read-only inspections and the assigned report append/format were performed for these dispositions. No additional test suite was run because neither observation requires another broad gate execution. The report was formatted with `pnpm exec oxfmt --write .agents/experiments/fleet-operations/reports/increment-01-reviewer-r2.md` (exit0). The final manifest was recomputed after formatting and verified against **DD23FBCD1EBECE4CBF5369E35AF93559599F04E068594E08519AC04528021792**, including the exact99-path inventory. Source, tests and documentation bytes are unchanged.

**STOP: reviewer writes have ended. Root owns dispositions, routing and verification of any subsequent correction.**
