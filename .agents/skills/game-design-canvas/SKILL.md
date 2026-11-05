---
name: game-design-canvas
description: Maintain the Game Design Canvas in OpenPencil. Use when updating the game design canvas or updating one pagers.
---

# Game Design Canvas

## Purpose and target

The Game Design Canvas is a single OpenPencil page containing editable one-pagers. Each one-pager explains one game concept. The starting point is the Pillars, which leads into the Overview and then fans out to the different game concepts as the design develops. Refine this canvas over time instead of making a separate final document for each concept.

The established file is `../../../docs/game-design/brainstorm/one-pager/game-design-canvas.fig` in the repository. Its shared page is named `Game Design Canvas`. Use the open document when available. Discover its current document, page, and node IDs; IDs can change after reloads. If the file has moved, inspect open documents and the workspace before asking for a new location, and update this skill with the new path once you found the file.

Read the available `open-pencil` skill for tool use and design authoring. Use its MCP tools against the live document and specify document and page IDs explicitly.

## Working rules

- Always respect and leverage the included Design System to keep the canvas maintainable in the long term.
- Inspect the current canvas and relevant one-pagers before editing. The user edits the design directly; preserve those changes. Use current canvas content and the user's latest instructions instead of restoring old conversation values.
- Keep text, tables, diagrams, and arrows editable as native design elements. Screenshots are references or previews, not the finished one-pager.
- Keep one clear frame boundary per one-pager. All selected one-pagers belong on the shared map page. Separate pages are for draft alternatives.

### Metadata naming

- Name layers and groups by their role or topic. Do not copy visible text, numeric values, game rules, outcomes, or example states into metadata. For example, use `Turn count` instead of `Traitor 100 turns` so a content change does not make the name stale.
- Read the actual node hierarchy before choosing a name. Use short names such as `Title`, `Description`, `Label`, and `Value` when ancestors already provide the context. Inside `Science`, use `Title` and `Description`, without repeating `Science`.
- Keep the topic on the parent group where it helps navigation. Retain a qualifier on a child only when its ancestors do not supply that context or the qualifier distinguishes sibling roles. In a flat HUD, use `Metal amount` and `Science level`; inside `Turn settings`, use `Count` and `Policy`.
- Do not assume that visual containment means parent-child containment. Elements drawn inside a mode band or inspector can be siblings of that shape. Check their actual parents before removing context from their names.
- Keep metadata abstract enough to remain accurate when the content changes.

## Refine an existing one-pager

Read its current structure, apply the requested content or layout change, and adjust the surrounding layout to fit. Preserve its theme and unaffected content. Use auto-layout for text and tables where useful; diagram geometry may need fixed positions.

If the request calls for a new concept with alternatives, follow [the one-pager skill](../game-design-one-pager/SKILL.md). A routine edit to an existing one-pager does not require three proposals.

## Arrange the map

Use the Overview as the center of the canvas, with the Pillars above it. Fan side one-pagers outward along an arc, with roughly equal angular spacing and similar displacement from the overview. Keep frames upright. Allow for their different heights and widths when choosing the radius.

Increase the radius or canvas extent when the side panels become crowded. Prefer a broad circular arrangement and direct arrows over stacked panels with long detours around them. Keep each arrow near its overview reference, preserve the intended direction, and avoid crossing other panels or unrelated arrows. Existing reference order can guide the order along the arc.

When moving frames, update their connectors in the same task. Adjust neighboring panels as needed to produce a clear layout, while preserving their content. Do not assume all connectors automatically follow moved frames.

## Verify and save

Export and inspect the changed one-pager and, for placement changes, the full map. Check text wrapping, alignment, frame boundaries, spacing, arrow endpoints, and arrow direction. Check both panel overlaps and whether a line passes through another panel; a transparent arrow frame's bounding box alone is not evidence of a collision.

Run the OpenPencil linter on changed designs and fix relevant errors and warnings. Review informational findings with judgment: fixed diagram geometry is not a reason to force auto-layout. Save the live `.fig` document. Briefly report what changed and any remaining issue. Leave the user's viewport alone unless they ask to see or focus a design.
