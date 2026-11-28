---
name: author-behavioral-requirements
description: Use whenever creating or editing a Cosmic Empires behavioral requirements file (*.requirements.md), including during implementation of another task.
---

# Author behavioral requirements

Place `<entryPoint>.requirements.md` beside `<entryPoint>.ts`. Follow the [sample specification](references/sample.md) for the title, counter, and table columns.

Write one observable behavior per row. State the conditions and the outcome a caller can observe through the entry point. Include an edge case or interaction when it changes the expected outcome.

Start each ID with the module's uppercase letter code, such as `GC` for Galaxy Creation. Use `MODULE-FACET-NNNN` when the behavior belongs to a distinct part of the module. Reuse the same uppercase facet code for related rules, such as `PLNT` for planets. Use `MODULE-NNNN` when the rule applies to the module as a whole. Those prefixes should use 2-4 letters, choose them carefully. Too short, and they're hard to understand, but too long and they are distracting.

All facets share the module's `Next ID number`. Start a new specification at `0001`. For each addition, use the displayed four-digit number and increment the counter in the same edit. Preserve the full ID when revising or moving a requirement. Deleting a row retires its number permanently.

An empty specification keeps the title, counter, and table header with zero data rows. If the last row is removed, keep the current counter for the next addition.
