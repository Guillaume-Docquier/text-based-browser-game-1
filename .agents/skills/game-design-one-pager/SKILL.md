---
name: game-design-one-pager
description: Develop a new game-concept one-pager for the OpenPencil Game Design Canvas. Use when asked to create a new one pager.
---

# Game Design One-Pager

## Outcome

Create an editable one-page design document that explains one game concept. Follow the one-pager approach used in Stone Librande's GDC talk: organize mechanics and design decisions so that the reader can understand their relationships at a glance. A one-pager is not a high fidelity mockup, but it must be appealing and pleasing to read. People should want to hang them on their office walls. Leverage tables, formulas, sequences, and diagrams to convey information.

## Prepare three independent proposals

Dispatch three subagents in parallel, one for A, B, and C. Give each a distinct layout direction suited to the content. Examples include a requirements table, an action sequence, a contribution matrix, or an annotated dependency diagram. Choose structures that explain the concept; do not produce three color variations or force the same three templates for every topic.

Choose and state each subagent's model and reasoning effort explicitly, following the repository's subagent instructions and the user's preferences. For a typical one-pager, `gpt-6.1-sol` with `high` reasoning effort is a suitable choice because both content interpretation and layout require judgment. Select an available equivalent when needed. Use a fresh context when setting explicit overrides and supply the complete brief.

The parent prepares isolation before dispatch:

1. Create three clearly named draft pages sequentially in the live document, such as `Concept A - Requirements`, `Concept B - Process`, and `Concept C - Dependencies`.
2. Assign each agent one page ID and, if useful, a root frame ID. The agent may write only within that page. Reference map pages are read-only for the agents.
3. Tell agents to use explicit document and page IDs, not whichever page happens to be active. Do not allow separate headless rewrites of the shared `.fig` file. The parent coordinates final saving and integration.
4. Start all three agents before waiting for results. Keep the parent available for the user's questions, corrections, or other tasks. Route common content corrections to all agents; route option-specific changes only to the relevant agent.

Each delegation must contain:

- The full agreed content brief and any unresolved choices, with relevant existing content quoted or summarized accurately.
- The assigned layout direction and why it suits the concept.
- The theme, typography, page dimensions or width reference, and relevant read-only reference IDs.
- The exact document ID, owned page/root IDs, and prohibition on changing other agents' pages, the game map, or document-wide settings and tokens.
- Instructions to use native editable elements, concise copy, useful diagrams, and clear one-pager boundaries.
- Instructions to inspect the rendered result, check overflow and lint, fix issues within the assigned page, and return the root ID, preview, and any unresolved issue.

## Review and refine

Review all three proposals for complete and consistent content, readable hierarchy, theme consistency, and actual layout differences. Inspect rendered previews; do not treat a successful tool call or node count as visual validation. Run or review lint and overflow checks, fixing substantive issues before presenting the options.

Present A, B, and C with a short description of the layout difference and their locations or previews. Let the user choose or combine them. Do not select a winner or integrate one merely because the agents have finished.

The user may edit the canvas directly, request changes across all options, or combine sections from multiple options. Refresh the live nodes before each revision. Apply changes to the scope requested. When the user asks to keep source options unchanged, create a new lettered version for the combination. Reuse native sections where practical and check that their typography and spacing agree.

Selection and refinement may span several turns. Keep the current choice and latest corrections; do not regenerate three options for each follow-up. If the user chooses an option and requests edits, complete those edits. If they also request integration, carry out both without another confirmation.

## Integrate and finish

When the user says to "fold" or "integrate" a selected one-pager, follow the steps:

1. Resolve the chosen version from the user's request and current pages. Selection may be followed by further edits; integrate when the user asks to fold it into the map or otherwise clearly requests integration. Do not ask again after that instruction.
2. Reinspect the chosen draft after the user's edits. Move its native root frame onto `Game design map`, preserving all children, text, and vectors. Prefer moving or cloning native nodes over recreating the design from a screenshot or incomplete export.
3. Give the frame a clear concept name consistent with the map. Position it near its source concept, with space for the full frame and its connector.
4. Draw a directional arrow from the relevant parent concept to the new one-pager. Anchor it near the referenced element when practical. Use no visible arrow label and no repeated breadcrumb inside the destination panel.
5. Remove the source draft page and delete unselected alternatives.
