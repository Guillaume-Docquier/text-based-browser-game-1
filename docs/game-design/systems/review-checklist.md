# System Review Checklist

Use this checklist in the final review of a new or materially changed System document. It reviews documents written from 000-system-template.md; do not add top-level sections just to satisfy a checklist item.

## Template fit

- [ ] The System uses Purpose, Core Concepts, Rules, and Potential Flaws.
- [ ] There are no placeholder questions left from the template.
- [ ] The filename follows the NNN-slug.md convention and uses an unused number.
- [ ] Additional sections are specific to the System and do not duplicate an authoritative rule from another document.

## Implementation status

- [ ] Any implementation-status claim describes the behavior currently in the game.
- [ ] Planned, partially implemented, and implemented rules are distinguishable.
- [ ] When status changes, every corresponding status entry in the System document and index is updated in the same change.

## Relationships and coherence

- [ ] Relevant GDDRs and Systems are linked from the document.
- [ ] Every System under Relates to links back to this document.
- [ ] The reciprocal link includes the Actions System whenever Actions use this System's keywords or rules.
- [ ] Terminology, timing, ownership, validation, and cross-System dependencies are coherent with related documents.
- [ ] Boundaries, assumptions, and known risks are stated where they affect another System.

## Index maintenance

- [ ] README.md is updated when the System is created, changed, merged, replaced, or its implementation status changes.
- [ ] The System is listed under the correct current entry with a resolving link and useful summary.
- [ ] Existing System numbers are not renumbered or reused.

## Merges and replacements

- [ ] A merged document identifies the surviving System and links to it, if the merged document remains in the repository.
- [ ] A replacement uses a new number, and the old and new documents link to each other.
- [ ] The index no longer presents a merged or superseded document as a current System.
- [ ] All links affected by the merge or replacement have been updated.

## Final coherence pass

- [ ] Reading this System with each related document does not produce contradictory rules.
- [ ] The document clearly separates what the game does now from what is planned.
- [ ] The review checked the complete System boundary, including interactions and failure cases that are intentionally out of scope.
