# How to write ADRs

## Philosophy

- ADRs explain durable decisions, not every implementation detail.
- The ADR template is intentionally small: `Title`, `Status`, `Context`, `Decision`, and `Consequences`.
- Capture useful options, rejected alternatives, boundaries, risks, and follow-up work inside the existing template sections.
- The ADR must be self-contained — no tribal knowledge assumptions

## When to Write an ADR

Write an ADR when a decision:

- Changes how the system is built or operated, such as a new dependency, architecture pattern, infrastructure choice, API design, or testing strategy.
- Is hard to reverse once code is written against it.
- Affects other people or agents who will work in this codebase later.
- Has real alternatives or tradeoffs that are worth preserving.

Do not write an ADR for:

- Routine implementation choices within an established pattern.
- Bug fixes or typo corrections.
- Decisions already captured in an existing ADR. Update the existing ADR instead.
- Style preferences already covered by linters or formatters.

When in doubt: if a future agent working in this codebase would benefit from knowing _why_ this choice was made, write the ADR.

### Proactive ADR Triggers for Agents

If you are an agent coding in this repo and encounter any of these situations, stop and propose an ADR before continuing:

- You are about to introduce a new dependency that does not already exist in the project.
- You are about to create a new architectural pattern that other code will need to follow.
- You are choosing between two or more real alternatives and the tradeoffs are non-obvious.
- You are about to change something that contradicts an accepted ADR.
- You are writing a long code comment explaining why a pattern exists.

To propose one, tell the human what decision you have reached, why it matters, and ask whether they want to capture it as an ADR. If yes, use the workflow below.

## Creating an ADR

Every ADR goes through four phases. Do not skip phases.

### Phase 0: Scan the Codebase

Before asking questions, gather repo context:

1. Read `docs/adr/README.md` and any relevant accepted ADRs.
2. Read `docs/adr/000-adr-template.md`.
3. Check the relevant package and project files, such as `package.json`, route definitions, API types, schemas, tests, or infrastructure files.
4. Find related code patterns that the decision would affect.
5. Note conflicts with existing ADRs or conventions before drafting.

Carry this context into the questioning loop so the ADR does not contradict the repo.

### Phase 1: Capture Intent (Socratic)

Interview the human to understand the decision space. Ask questions one at a time and build on previous answers. Do not dump a list of questions.

Core questions (ask in roughly this order, skip what's already clear from context or Phase 0):

1. What are we deciding? — Get a short, specific title. Push for a verb phrase ("Choose X", "Adopt Y", "Replace Z with W").
2. Why now? What changed, broke, or will break if we do nothing?
3. What existing constraints matter?
4. What options or patterns were considered?
5. What option are we choosing, and why?
6. What becomes easier because of this?
7. What becomes harder, riskier, or more constrained?
8. What's your current lean? — Capture gut intuition early. Often reveals unstated priorities.
9. Is anything explicitly out of scope?

Adaptive follow-ups:

- What would make us revisit this later?
- What is the worst outcome if this decision is wrong?
- Which existing ADRs or code patterns does this interact with?
- What work follows from accepting this decision?

Stop when you can fill the template without making things up.

Before drafting, present a short intent summary and ask the human to confirm or correct it:

> **ADR Intent Summary**
>
> - **Title**: {title}
> - **Status**: {status}
> - **Context**: {trigger, constraints, related ADRs/code, alternatives if useful}
> - **Decision**: {chosen rule or change, including scope boundaries if useful}
> - **Consequences**: {positive consequences, negative consequences, risks, follow-up work}
>
> Does this capture your intent?

Do not proceed to Phase 2 until the human confirms the summary.

### Phase 2: Draft the ADR

1. Copy `docs/adr/000-adr-template.md`.
2. Choose the next numeric filename, using the existing `NNN-slug.md` convention.
3. Use a title that names the decision, not just the problem.
4. Fill the template sections:
   - `Status`: Usually `Proposed` for a draft and `Accepted` once agreed. Use `Rejected`, `Deprecated`, or `Superseded` when updating old decisions.
   - `Context`: Explain the problem, trigger, relevant constraints, related ADRs/code, and alternatives or rejected options when they matter.
   - `Decision`: State the chosen rule or change clearly enough to act on. Include scope boundaries or non-goals here when needed.
   - `Consequences`: Capture concrete upsides, downsides, risks, operational impact, and follow-up work.
5. Do not leave placeholder text.
6. Do not add top-level sections just to satisfy a checklist. If extra information matters, fit it into the template or add a small subsection inside the relevant template section.

### Phase 3: Review the Draft

Review the draft against `docs/adr/review-checklist.md`.

Present the review as a concise summary, not a raw checklist dump:

> **ADR Review**
>
> **Passes**: {what is solid}
>
> **Gaps found**:
>
> - {specific gap}
>
> **Recommendation**: {ship it, fix the gaps first, or return to Phase 1}

Only surface failures and notable strengths. If there are gaps, propose specific fixes and ask the human to approve them.

Do not finalize until the ADR passes review or the human explicitly accepts the gaps.

## Consulting ADRs

Agents should read existing ADRs before implementing changes that touch architecture, API design, infrastructure, persistence, testing strategy, or cross-cutting conventions.

### When to Consult ADRs

- Before starting work on a feature that touches architecture.
- When you encounter a pattern and wonder why it is done that way.
- Before proposing a change that might contradict an accepted decision.
- When a human says to check the ADRs.
- When an ADR reference appears in code, docs, or review feedback.

### How to Consult ADRs

1. Read `docs/adr/README.md`.
2. Scan the relevant titles and summaries.
3. Read the relevant ADRs fully.
4. Follow accepted ADRs unless the work is explicitly to supersede or revise them.
5. If code and an accepted ADR disagree, flag the mismatch before changing direction.

## Updating ADRs

Do not rewrite history unless the ADR is still a draft. For accepted ADRs:

- To accept or reject a draft, update `Status` and add any final context needed.
- To deprecate an ADR, set `Status` to `Deprecated` and explain the replacement path.
- To supersede an ADR, create a new ADR and link both ways.
- To add later learning, add a dated note or amendment inside the relevant template section.

Update `docs/adr/README.md` when an ADR is accepted, deprecated, superseded, or otherwise changes how contributors should use the index.
