# Launch prompt

Open a task rooted at the prepared worktree and select **GPT-6.1 Sol / xhigh** before submitting the prompt. The persona text cannot change the model of an already running task.

Worktree: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1`

Paste the following:

```text
Act as the Fleet Operations Orchestrator using gpt-6.1-sol with xhigh reasoning.

Work only in:
C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1
Branch: codex/fleet-operations-experiment

Read AGENTS.md and:
- .agents/personas/fleet-orchestrator.md
- .agents/experiments/fleet-operations/requirements.md
- .agents/experiments/fleet-operations/initial-plan.md
- .agents/experiments/fleet-operations/increment-template.md
- .agents/experiments/fleet-operations/run-state.md

Implement the agreed fleet movement, normal Assault, and colonization scope from end to end. The requirements file records my answers and supersedes the older colonization design. Do not reopen settled scope decisions.

You own orchestration and acceptance. Delegate each increment through:
1. Fresh planner: gpt-6.1-sol / medium, using .agents/personas/fleet-planner.md.
2. Review and approve its implementation plan and acceptance criteria.
3. Fresh implementer: gpt-6-luna / max, using .agents/personas/fleet-implementer.md.
4. Fresh tester: gpt-6-luna / max, using .agents/personas/fleet-tester.md. It reviews and improves only tests, using the approved plan. Route demonstrated production bugs back to the implementer and repeat verification.
5. Fresh reviewer: gpt-6.1-sol / high, using .agents/personas/fleet-reviewer.md. It checks the full increment for correctness, architecture, duplication, unnecessary abstractions, and useful missing generalizations. Route findings back to the implementer and repeat until no actionable findings remain.
6. Independently verify acceptance, then commit the increment.

Explicitly pass model and reasoning effort on every spawn. Use fork_turns="none" (or the runtime's equivalent) so implementer, tester, and reviewer do not inherit this conversation or each other's reasoning. Send the persona, approved plan, absolute worktree path, base commit, acceptance criteria, and repository reading requirements. Use existing implementation agents for fixes when available, but keep independent tester/reviewer passes fresh.

Keep one code/test writer active at a time. Maintain durable plans, findings, evidence, and progress in the experiment directory so work can resume after compaction. Do not implement production fixes yourself to bypass a role or review gate.

You are authorized to make routine in-scope decisions, update the affected existing documentation, commit each accepted increment, push this branch, open/update one PR against main, and repair its CI. Follow the repository PR skill and template, and attach the PR to the task. Do not merge, enable auto-merge, request an external review bot, or modify the main checkout.

Finish only when all agreed behavior is implemented, every increment has passed its loop and is committed, and the open PR is ready for human review with all required and applicable CI green for its latest head commit. Continue through implementation, tests, review fixes, and CI failures without routine confirmation. Ask me at most two questions at a time only for a genuinely blocking unresolved design decision, accepted-ADR contradiction, or permission/environment limitation.

Start now by verifying the worktree and current run state, then commission the first increment plan.
```
