# Behavioral requirements

Keep each specification beside its public entry point in `<entryPoint>.requirements.md`. Use the entry point name and “requirements” as the document title.

Put `Next ID number` directly below the title. Use four digits, starting at `0001` in a new file. When adding a requirement, use the displayed number for its ID and increment the field in the same edit. Keep each ID when rewording or moving its row. When removing a row, retire its ID and keep the counter at its current value.

Under `## Requirements`, use a Markdown table with two columns, `ID` and `Requirement`. Give each requirement one row. In the `Requirement` cell, state the input conditions and the outcome a caller can observe. Include an edge case or interaction when it changes that outcome. For an empty specification, keep the table header and separator with zero data rows.

## Sample document

```markdown
# `createGalaxy` requirements

Next ID number: 0002

## Requirements

| ID      | Requirement                                                                    |
| ------- | ------------------------------------------------------------------------------ |
| GC-0001 | When the player list is empty, every planet in the returned galaxy is unowned. |
```
