# Fleet operations experiment

Preparation only: implementation starts when the human runs [launch.md](launch.md).

- [Requirements and scope](requirements.md): human decisions, hard constraints, and working defaults.
- [Initial plan](initial-plan.md): increment sequence, repository entry points, and acceptance scenarios.
- [Increment packet](increment-template.md): the independent handoff contract for every role.
- [Run state](run-state.md): durable progress and evidence across context compaction.
- Personas: [orchestrator](../../personas/fleet-orchestrator.md), [planner](../../personas/fleet-planner.md), [implementer](../../personas/fleet-implementer.md), [tester](../../personas/fleet-tester.md), [reviewer](../../personas/fleet-reviewer.md).

## Runtime

| Role         | Model       | Reasoning effort |
| ------------ | ----------- | ---------------- |
| Orchestrator | gpt-6.1-sol | xhigh            |
| Planner      | gpt-6.1-sol | high             |
| Implementer  | gpt-6.1-sol | medium           |
| Tester       | gpt-6.1-sol | medium           |
| Reviewer     | gpt-6.1-sol | high             |

These are repository persona instructions, following the existing `.agents/personas` convention. The launch session must select the orchestrator model and effort; prose cannot change the active session's model. Every subagent spawn must explicitly set both model and effort, and use a fresh context. Do not silently substitute models.

The runtime currently exposes `collaboration.spawn_agent` with `model`, `reasoning_effort`, and `fork_turns: "none"`. Pass the persona and approved increment packet in its message. Use equivalent explicit settings if the launch runtime exposes a different agent API. Do not require a named-agent selector or configuration format the installed tool does not support. Official background: [OpenAI subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Prepared workspace

- Worktree: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`.
- Branch: `codex/fleet-operations-sol`.
- Fetched base: `e9408c64620fc988dc3b1fd39827afabcb7d40f5` (`origin/main`, 2026-10-10).
- `pnpm wts` completed successfully; it owns the isolated environment and database setup.
- Keep experiment records in this branch. Do not change the main checkout.
- Do not rerun `pnpm wts` on a resume without a setup problem: it resets this worktree's database. Use `pnpm db:up` if its container is stopped.

Delivery: one commit per completed increment, then one open pull request against main with green CI for its latest commit. Leave merging to the human.
