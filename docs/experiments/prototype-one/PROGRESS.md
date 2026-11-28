# Prototype 1 progress

[Epic and match rules](issues/00-prototype-one-epic-and-match-rules.md)

Check each increment after verifying its acceptance criteria. Record decisions, problems and verification evidence in the [run log](RUN-LOG.md).

- [x] [01/26 · Assign prototype home worlds](issues/01-assign-prototype-home-worlds.md) — `a0f6e159`, `637336de`. Reviewed and verified at `637336de`. Across 128 galaxies every player had one eligible home in a distinct system. Solo and multiplayer players found and reopened their homes. The run log records scale, sampling and mutation results.
- [x] [02/26 · Add Sol to the generated galaxy](issues/02-add-sol-to-the-generated-galaxy.md) — `4741395d`. Reviewer cleared and verifier passed all six criteria at that commit. Seeded replacement, orbit checks, Sun-centered homes and public addresses passed across 56 seeds. Two players could locate and inspect all nine named bodies in Chromium.
- [x] [03/26 · Generate planetary metal deposits](issues/03-generate-planetary-metal-deposits.md) — `bcbce642`, `14dc5d9f`, `3e3263d1`. Reviewed and verified at `3e3263d1`. Generation across 588,616 planets, two players' list and inspector comparisons, persisted values and a 30,000-planet legacy upgrade passed.
- [x] [03a · Open planets in a full planet view](issues/03a-open-planets-in-a-full-planet-view.md) — `cfda7067`, `b12f199a`. Reviewed and verified at `b12f199a`. Earth and an ordinary planet had the same durable view from either entry point. Fresh sessions, reload, return to the correct system and desktop and narrow layouts passed.
- [x] [04/26 · Persist buildings and display them on stable planet hexes](issues/04-persist-buildings-and-display-them-on-stable-planet-hexes.md) — `6a901725`. Reviewer and verifier cleared all six criteria on that commit. Persisted home command centers kept their identities after restart. Hex counts, fixed rings, occupied sites, distinct art, and solo and multiplayer inspection passed.
- [x] [05/26 · Give each player a credit balance](issues/05-give-each-player-a-credit-balance.md) — `7f059a08`, `6d1082a7`. Reviewed and verified at `6d1082a7`. Solo and multiplayer balances started at 100, stayed private across colonies and sessions, and followed an isolated tuning change. Populated upgrade and contention checks passed.
- [x] [06/26 · Produce income with trade centers](issues/06-produce-income-with-trade-centers.md) — `af7cc5fd`. Reviewed and verified on that commit. Real readiness and deadline turns paid once per eligible center. Restart, retry, multiple owners and centers, tunability, PostgreSQL upgrade and 16/16 mutation kills passed. Paid construction checks the income boundary in 07.
- [ ] [07/26 · Construct buildings with a command center](issues/07-construct-buildings-with-a-command-center.md)
- [ ] [08/26 · Give each player a starting transport](issues/08-give-each-player-a-starting-transport.md)
- [ ] [09/26 · Move a ship between bodies](issues/09-move-a-ship-between-bodies.md)
- [ ] [10/26 · Apply fog of war at current positions](issues/10-apply-fog-of-war-at-current-positions.md)
- [ ] [11/26 · Survey planets along a ship’s route](issues/11-survey-planets-along-a-ships-route.md)
- [ ] [12/26 · Build ships at shipyards](issues/12-build-ships-at-shipyards.md)
- [ ] [12a · Add scout ships](issues/12a-add-scout-ships.md)
- [ ] [13/26 · Add colony ships](issues/13-add-colony-ships.md)
- [ ] [14/26 · Claim a planet](issues/14-claim-a-planet.md)
- [ ] [15/26 · Extract metal with mines](issues/15-extract-metal-with-mines.md)
- [ ] [16/26 · Release stockpile items for pickup](issues/16-release-stockpile-items-for-pickup.md)
- [ ] [17/26 · Load selected items onto a ship](issues/17-load-selected-items-onto-a-ship.md)
- [ ] [18/26 · Unload selected items from a ship](issues/18-unload-selected-items-from-a-ship.md)
- [ ] [19/26 · Track hauling history](issues/19-track-hauling-history.md)
- [ ] [20/26 · Refine metal into alloy](issues/20-refine-metal-into-alloy.md)
- [ ] [21/26 · Track Dyson swarm progress](issues/21-track-dyson-swarm-progress.md)
- [ ] [22/26 · Award production contribution points](issues/22-award-production-contribution-points.md)
- [ ] [23/26 · Award transport contribution points](issues/23-award-transport-contribution-points.md)
- [ ] [24/26 · Award refining contribution points](issues/24-award-refining-contribution-points.md)
- [ ] [25/26 · End the match on completion or timeout](issues/25-end-the-match-on-completion-or-timeout.md)
- [ ] [26/26 · Rank players at match end](issues/26-rank-players-at-match-end.md)

## Active work

07 is active. The implementer owns paid construction, private reservations, cancellation and resolution. The reviewer owns the diff, concurrency and mutation dispositions. The verifier owns independent owner/observer UI, API and worker trials. Next, exercise all four local criteria, including the funded-order follow-up from 06.
