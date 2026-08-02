# How to write Systems documents

## Philosophy

- systems contain the details of game mechanics, to describe how they work in the game.
- systems support game design decisions.

## When to write a Systems document

Every single System in the game should be described in a Systems document. Someone with infinite memory and no prior knowledge of the game should be able to read all the systems document and know everything about the game.

## Creating a Systems document

Copy the template and fill it. The sections in the template are mandatory, but each document will probably have additional sections tailored to the system being described

Make sure that relevant GDDRs and Systems are referenced in the Systems document.

System relationships are bidirectional. Every System referenced under **Relates to** must link back to this document, including the Actions system when it uses this system's keywords or rules.

## Numbering and the index

Use the NNN-slug.md filename convention for every System document. Before creating a document, inspect the existing files and the [Systems index](./README.md) and choose an unused number. Never renumber an existing System or reuse a number from a merged, replaced, or retired document.

Update the Systems index in the same change as the System document. Add a new document with a link and a concise summary, and keep the summary and link current when the document changes. The index lists current Systems; lifecycle notes for merged or replaced documents must not leave obsolete entries presented as current.

## Maintaining implementation status

Keep implementation-status claims synchronized with the game. When a System's status is recorded in its document or the index, update every corresponding status entry in the same change. The status must describe the behavior currently implemented, distinguish planned rules from live rules, and identify partial implementation rather than implying that the whole System is implemented.

Documenting a rule does not make it implemented. Recheck status when implementation changes, and do not change a status based only on an intended design change.

## Merging and replacing Systems

Do not silently overwrite an existing System when its scope changes.

- When Systems merge, keep the surviving System's existing number, move the authoritative rules into that document, and update the index and all affected links. Leave a short “Merged into” note and a link in the merged document if it remains in the repository.
- When a System is replaced, create the replacement with a new unused number. Link the old and new documents to each other, explain which document is authoritative, and remove the superseded document from the current index after its links are updated.
- Preserve old numbers and links for history; never renumber or reuse them for the merged or replacement System.

## Reviewing a System

Before finalizing a new or changed System, use the [System Review Checklist](./review-checklist.md). Read every related GDDR and System, then review the rules together for coherent terminology, timing, ownership, validation, and cross-System dependencies. Resolve contradictions by making one document authoritative and linking the relationship explicitly. Confirm that the document's stated boundaries and potential flaws are consistent with the related documents and its implementation status.
