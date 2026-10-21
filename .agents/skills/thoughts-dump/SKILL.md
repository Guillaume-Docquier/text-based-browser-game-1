---
name: thoughts-dump
description: Capture successive user thoughts in a dedicated section at the end of a chosen file, preserving the rest of its content. Use when the user wants to dump thoughts or maintain brainstorm notes in a file.
---

# Thoughts Dump

Turn the user's thoughts into concise, accurate notes in the specified file. Act as a note-taker; do not implement the ideas or resolve design questions unless asked.

## Target file and section

- Accept a file path or an unambiguous file reference as input. Ask for the target if it is missing or ambiguous. Keep using that target for subsequent thoughts until the user changes it.
- Read the file and its applicable editing instructions before making changes.
- Reuse its existing Thoughts dump section, or create one at the bottom. Only create the section on the first thought to avoid creating an empty section.
- Edit only that section. Preserve all other content, formatting, and user edits. A thought about changing another part of the file is a note to record, not permission to make that change.
- Accept any file type. Use a heading in prose documents, a comment section where the format permits comments, or an equivalent section supported by the format's editing tools. Preserve file validity and behavior. If the format cannot hold notes without changing unrelated content or behavior, explain the limitation and ask where to put them; do not silently create a different file or convert the original.

## Capture each thought

1. Identify the idea, constraints, examples, and unresolved questions. Ask a focused clarification only when ambiguity would materially change the note. Otherwise, preserve the user's uncertainty and proceed.
2. Add the thought to the section, or consolidate it with related notes already there. Remove repetition without losing distinct constraints or examples. If a new thought clearly revises an earlier one, update the earlier note; ask if the intended revision is unclear.
3. Use short headings, bullet points, and tables where they make the content easier to read or shorter. Match the file's terminology and use plain, direct language without artificial line wraps.
4. Keep proposals, decisions, and open questions distinct. Do not turn "could" into "will," add inferred mechanics, or present a brainstorm as implemented behavior. A question inside a submitted thought can remain an open question; it does not automatically request a solution.
5. Keep assistant suggestions out of the notes unless the user asks to record them or adopts them. Do not add generic advice, research, or implementation plans to a thought-capture request.

## Verify and respond

- Review the change to confirm that it captures the thought accurately and changes only the Thoughts dump section.
- Follow applicable formatting and validation requirements. If formatting would alter content outside the section, retain only the section's formatting changes and preserve the original content elsewhere.
- Give a brief confirmation of what was recorded. Do not repeat the full notes unless asked.
- Do not commit or publish notes automatically. When requested, commit only the intended changes and follow the repository's requirements.
