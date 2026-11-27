# Behavioral requirements

Keep each specification beside its public entry point in `<entryPoint>.requirements.md`. Use the entry point name and “requirements” as the document title. Link to this guide above the `## Requirements` heading. An empty specification ends at that heading.

Under `## Requirements`, give each requirement a level-three heading in the form `### <ID>`. In the paragraph below it, state the input conditions and the outcome a caller can observe. Include an edge case or interaction when it changes that outcome.

Use the prefix `GC` for Galaxy Creation and `TR` for Turn Resolution. For a new requirement, append a hyphen and the next number for that prefix, starting at `001`. Keep the ID when revising the wording or moving the entry. When removing a requirement, retire its ID. Check the file history before assigning a number that may have been used.
