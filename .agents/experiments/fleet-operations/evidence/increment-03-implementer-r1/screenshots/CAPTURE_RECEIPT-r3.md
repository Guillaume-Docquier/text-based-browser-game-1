# Authenticated Playwright screenshot receipt (X r3)

Captured from the successful full X run recorded in `../gate-X-full-final-r3.command.txt` and `../gate-X-full-final-r3.log` (actual exit 0; 24 tests passed). The images are original Playwright screenshot attachments copied before a later test runner could clear `apps/frontend/test-results`; no pixels were synthesized or edited.

- `c3-23-colonization-pending-35-remainder-15.png`: Alice's 15-strength stationary home Fleet and 35-strength Fleet en route to the neutral target at `55:07:50`.
- `c3-23-colonization-owner-alice.png`: the target's live Owner label is Alice after the arrival resolves.
- `c3-23-colonization-claimed-fleets-15.png`: both surviving 15-strength Alice Fleets, at home `45:98:30` and target `55:07:50`.
- `c3-04-colonization-prevented-fleets-bob19.png`: the complete owner table after the explicit Assault control: Alice 84 at `54:00:40`, Bob 19 at target `55:19:10`, and Bob 15 at `56:10:20`.
- `c3-04-colonization-prevented-unclaimed-target.png`: target `55:19:10` remains Unclaimed after the arriving Fleet is reduced to 19 strength.

The source files were under `apps/frontend/test-results` in the two passing `fleet-colonization.spec.ts` test-result folders, each in Playwright's `attachments` subdirectory. The full run included the authenticated setup dependencies.
