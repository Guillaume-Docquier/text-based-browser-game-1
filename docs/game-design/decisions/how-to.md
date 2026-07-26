# How to write Game Design Decision Records (GDDR)

## Philosophy

- GDDRs capture durable decisions about the game's philosophy and mechanics.
- They are usually written before implementation, as a result of brainstorming and deliberate design choices.
- A GDDR may also capture a decision discovered while implementing when that decision affects the future game.
- The template is intentionally small: `Title`, `Status`, `Context`, `Decision`, and `Consequences`.
- A GDDR explains why the game is the way it is, not how it works in minute details. How the game works will be detailed in `docs/game-design/systems/`.
- GDDRs are human-initiated. Agents can identify a candidate and help explore it, but must ask the human before creating one.
- GDDRs will in general close the design space as each GDDR represents additional constraints for future choices.

## When to write a GDDR

Write a GDDR when a decision:

- Establishes or materially changes a game mechanic, player experience, or durable design principle.
- Has meaningful tradeoffs for the game's depth, fairness, pacing, strategy, or long-term direction.
- Affects how other mechanics should work together.
- Should guide later implementation, even if implementation is not planned yet.

Do not write a GDDR for:

- A narrow implementation detail that does not change the intended game experience.
- Game balance.
- A temporary experiment with no durable design lesson.
- A decision already captured in an existing GDDR. Amend that record instead.

When in doubt, ask whether a future designer or implementer would benefit from knowing why this mechanic exists and what it is meant to achieve.

### Candidate GDDRs for agents

When an agent encounters a possible game-design decision, it should tell the human why it appears durable and ask whether to create a GDDR. It must not create one on its own.

Useful signals include:

- Choosing between mechanics with different player experiences or strategic consequences.
- Introducing a rule that shapes what players can do.
- Resolving a conflict between two desired game qualities.
- Discovering that a planned mechanic changes the meaning or balance of another mechanic.

## Creating a GDDR

Every GDDR goes through four phases.

### Phase 0: Gather game context

Before asking questions:

1. Read this index and the relevant GDDRs.
2. Read `000-gddr-template.md`.
3. Review relevant game-design notes, gameplay code, tests, and existing mechanics.
4. Identify the mechanics that this decision affects or depends on.
5. Note what is planned versus already implemented.

### Phase 1: Capture intent

The human leads the decision. Ask one question at a time and build on the answers.

Explore, as relevant:

1. What game problem are we solving?
2. What player behavior or experience should this create or avoid?
3. Which existing or planned mechanics does it connect to?
4. What alternatives were considered, and what tradeoffs do they create?
5. What does the chosen design allow?
6. How does it add, reduce, or focus the game's depth?
7. What is the smallest useful implementation step, and what can come later?
8. What is explicitly out of scope for now?

Before drafting, summarize the intended title, status, problem, design, consequences, relationships, and incremental path. Ask the human to confirm or correct it.

### Phase 2: Draft the GDDR

1. Copy `000-gddr-template.md`.
2. Choose the next `NNN-slug.md` filename.
3. Use `Planned` for an intended decision and `Implemented` once the game follows it. Add other statuses only when they become useful.
4. Explain the game problem and relevant mechanics in `Context`.
5. State the chosen game rule or design direction in `Decision`.
6. In `Consequences`, cover what the decision enables & prevents, its effect on depth, tradeoffs, and an incremental implementation path where useful.
7. Do not leave placeholders or add top-level template sections merely for extra detail.

### Phase 3: Review the draft

Review against `review-checklist.md`. Present the useful passes and gaps, then ask the human to approve any needed revisions. Do not finalize a GDDR with unresolved design gaps unless the human explicitly accepts them.

## Updating GDDRs

Do not rewrite the original intent of a record without preserving its history.

- When a planned decision is implemented, change its status to `Implemented` and update the index.
- When a decision is abandoned, deprecate it and explain why.
- When a decision is replaced, create a new GDDR and link both records.
- Add later learning or implementation notes in the relevant existing section.

Update `README.md` whenever a GDDR changes status or becomes relevant to a new game-design area.
