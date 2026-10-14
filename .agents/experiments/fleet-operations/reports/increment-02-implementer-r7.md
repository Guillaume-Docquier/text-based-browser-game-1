# Increment 02 implementer R7 report

R7 applies the approved v4 contract (`.agents/experiments/fleet-operations/increments/increment-02.md`, SHA256 `E4118FEA9BACB30A5233B92D5D15D790FB2337F0D3E3315A35B2AE65F34FAF97`). All 18 acceptance rows remain mandatory. This report records only the approved real-PostgreSQL fixture scheduling correction for O-I2-18; it does not claim Increment 02 acceptance.

The work was performed on `codex/fleet-operations-experiment`, based on `06954d1a35759a5fa5bd4271f0585ba3ef71c6e4`, in the assigned worktree.

## Original failure and diagnosis

The preserved root run at `.agents/experiments/fleet-operations/evidence/increment-02-root-final/postgresql.log` exited 1: 5 tests passed, 1 failed, and 3 were skipped. The failing “captured Action Definition binding” case failed during its public Build setup, before JSON corruption was injected: its manually driven `TurnProcessor` returned `idle` rather than `processed`.

The log shows the API process's real-clock worker processed the due turn at 18:44:23.812, while the controlled-clock processor had found no turn at 18:44:23.777. Both workers were eligible because the fixture closed turns through public Ready calls, scheduling them at real `closedAt`. This was a fixture ownership race, not a demonstrated gameplay defect.

## Bounded correction

Only `apps/backend/src/api/gameplay/gameplay.concurrency.test.ts` was changed. Manual real-PostgreSQL fixtures now use a one-hour public turn interval and advance their injected `ControlledClock` by two hours before calling the existing `TurnsRepository.markDueTurnsAwaitingProcessing` path and the actual `TurnProcessor`. They no longer call unanimous Ready to schedule those manual turns against the API worker's real clock.

The main public arrival fixture and its captured-JSON corruption fixtures retain public create/join/start/build/submit/view setup, the actual API server and background worker, genuine persisted movement JSON, and all prior literal force, cost, identity, status, and unchanged-snapshot assertions. Corrupt cases still require the actual worker to return `failed` and preserve the same gameplay rows. Each successful manual step now also reads the target game's public view and asserts exactly the expected next turn in `COLLECTING_ACTIONS`; this detects an unrelated game being selected by the shared due-turn worker.

The existing manual reservation fixtures also use one-hour intervals and two-hour controlled advances, with the same target-game progression check. The two dedicated real-clock Ready/deadline concurrency tests retain the original 10-second interval and real worker path. Production code, rules, environment values, and test APIs are unchanged. The fixture follows the existing repository deadline path; its only direct database write remains the approved captured-movement JSON corruption seam.

## Verification

Final formatted test bytes were checked with these commands:

- `pnpm exec oxfmt --write apps/backend/src/api/gameplay/gameplay.concurrency.test.ts` — exit 0.
- `pnpm --filter backend exec vitest run --project concurrency --silent=true` — exit 0; 2 files and 11 tests passed in 50.41 seconds.
- `pnpm --filter backend exec vitest run --project concurrency --silent=true src/api/gameplay/gameplay.concurrency.test.ts -t "should reject a persisted captured Action Definition binding"` — exit 0; 1 passed, 8 skipped in 6.82 seconds.
- `pnpm --filter backend typecheck` — exit 0.
- `pnpm lint` — exit 0.
- `git diff --check 06954d1a35759a5fa5bd4271f0585ba3ef71c6e4 --` — exit 0.
- `docker ps --all --filter label=org.testcontainers=true --quiet` — exit 0; no Testcontainers-managed containers remained after the concurrency run.

The first post-edit lint attempt exited 1 only because the two API client variables became unused after removing the Ready calls. Those bindings were removed; the final formatter, full concurrency run, typecheck, lint, and diff check above use the resulting current bytes. Vitest emitted its existing experimental type-checking notice and PostgreSQL client deprecation warning; the final test runs passed. Test logs also include expected rejected-action API errors from negative assertions.

The captured-JSON focused run before the unused-binding cleanup passed all 4 corruption variants (5 skipped, exit 0). The complete final concurrency run and final single-case run both passed after formatting and cleanup. Full command/output/exit artifacts are under `.agents/experiments/fleet-operations/evidence/increment-02-implementer-r7/`. The initial failing run remains preserved at the root evidence path cited above.

## Source accounting

Before editing, `apps/backend/src/api/gameplay/gameplay.concurrency.test.ts` was copied to `evidence/increment-02-implementer-r7/gameplay.concurrency.test.ts.before-r7.txt`; both the copy and source had SHA256 `3D772743670A6E0BBCBD167593AA2C0601B9F6AB82E978F9AB560A15EB5D8C30`.

The complete before/after patch is preserved at `evidence/increment-02-implementer-r7/test-before-after.diff` (the `git diff --no-index` exit 1 is expected because the files differ). The final test file SHA256 is `7CB7A372874D82379CC4FF3A80F998F6CF85264AE780B3AC5D041D145029B3B8`.

The current sorted 61-path `apps`/`packages`/`docs` manifest relative to base is `evidence/increment-02-implementer-r7/source-manifest.txt`, with aggregate SHA256 `6D1F3C2C01406252D31B46ABCFF8AF71905DCF789336426A88CB7A2AD96EDB2C`. Compared with the frozen R6 manifest (`1F1F510563A75E4E9DE7F7ED423908D4C3D36B691506906974CA88103D6A4598`), exactly one entry changed: `apps/backend/src/api/gameplay/gameplay.concurrency.test.ts`; the other 60 source entries are byte-identical.

R7 resolves the diagnosed fixture race at the producer level. Independent tester/reviewer gates and root acceptance remain outstanding.

**STOP: I am stopping all source, test, evidence, and report writes here.**
