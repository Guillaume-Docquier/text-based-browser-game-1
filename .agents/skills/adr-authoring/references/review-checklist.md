# ADR Review Checklist

## Meaning and scope

- [ ] For an existing ADR, compare the rule, scope, exceptions, and material reasons before and after the edit.
- [ ] An editorial edit preserves the decision's meaning and leaves amendment history alone.
- [ ] A material refinement or a status change to an accepted ADR has a dated amendment entry that explains the change. A replacement decision has its own ADR and reciprocal links.
- [ ] Each technical detail is needed to state or justify the durable decision. Contributors can change the current implementation within the rule without needing another ADR edit.

## Structure and content

- [ ] The filename uses `NNN-slug.md` with a unique number. The slug matches the ADR title in lowercase, with words separated by hyphens.
- [ ] The record has `Status`, `Context`, `Decision`, and `Consequences`. Supporting material fits within those sections, and all template placeholders are replaced.
- [ ] The status reflects the decision. Rejected, deprecated, or superseded records explain the reason and any replacement.
- [ ] Context stands on its own. It explains what prompted the decision, relevant constraints, and any alternatives that explain the choice.
- [ ] The decision gives future contributors a concrete rule, with scope and exceptions where needed. Any conflict with another accepted decision is resolved explicitly.
- [ ] Consequences describe real benefits, costs, risks, and any required architectural follow-up.
- [ ] Related records are linked where they affect the decision. The index reflects status changes and tells contributors when to consult the record. The index link text matches the linked filename without its directory or `.md` extension.

When reporting a review, cite the affected text, explain its effect on the decision, and give a specific correction. For an existing record, summarize the rule before and after, or state that both versions impose the same rule.
