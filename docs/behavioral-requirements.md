# Behavioral requirements

Keep each specification beside its public entry point in `<entryPoint>.requirements.md`. Use the entry point name and “requirements” as the document title.

Use `MODULE-NNNN` for a module-wide requirement, or `MODULE-FACET-NNNN` to group related requirements. Use uppercase letters for the module and optional facet. For example, `GC-PL` groups Galaxy Creation requirements about planets.

Put one `Next ID number` directly below the title. All requirements in the module share this counter. Use four digits, starting at `0001`. When adding a row, use the displayed number and increment it in the same edit. Keep the full ID when rewording or moving a row. When deleting a row, retire its number across the module and leave the counter at its current value.

Under `## Requirements`, use a Markdown table with two columns, `ID` and `Requirement`. Give each requirement one row. Keep rows for each facet together. Add a row at the end of its group, or start a new group at the end of the table. Treat module-wide rows as one group. In the `Requirement` cell, state the input conditions and the outcome a caller can observe. Include an edge case or interaction when it changes that outcome. For an empty specification, keep the table header and separator with zero data rows.

## Sample document

```markdown
# `createGalaxy` requirements

Next ID number: 0005

## Requirements

| ID         | Requirement                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| GC-0001    | When the player list is empty, every planet in the returned galaxy is unowned. |
| GC-PL-0002 | Each planet in the returned galaxy has a unique planet ID.                     |
| GC-PL-0004 | When one player starts a galaxy with at least one planet, they own one planet. |
| GC-ST-0003 | Each star in the returned galaxy has a unique star ID.                         |
```
