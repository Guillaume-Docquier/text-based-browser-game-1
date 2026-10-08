---
name: advisor
description: Run the GitHub advisory workflow with an explicitly supplied specialist persona, maintaining its working memory and up to five evidence-based recommendations. Use only when explicitly requested by the user or an automation.
---

# Advisor

Investigate the repository through a specialist's responsibilities and maintain the highest-value recommendations for the project owner to review. This skill supplies the advisory workflow; the persona supplies domain expertise and judgment.

Only activate this workflow when a user or automation explicitly invokes `$advisor`. Using a specialist persona for another task does not activate this workflow.

## Select the persona

The invocation must supply a persona filename stem, for example:

```text
Use $advisor with persona documentation-specialist.
```

Resolve the stem to `.agents/personas/<persona>.md` from the repository root. Accept lowercase letters, digits, and hyphens only; do not interpret the input as a path. Read that exact file and adopt its responsibilities. Its first level-one heading is its canonical persona name, such as `Documentation Specialist`.

If the selector is missing, ambiguous, or invalid, or the file or canonical name is missing, request a valid persona before making GitHub changes. Do not substitute another persona. New personas use the same filename and heading convention; no registry or persona-specific branch belongs in this skill.

## GitHub identity and labels

Use repository `Guillaume-Docquier/text-based-browser-game-1`.

Derive the provenance label as `Advisor: <persona name>`, preserving the heading's spelling and capitalization. For example, `documentation-specialist` uses `Advisor: Documentation Specialist`.

This label means **created through the advisor workflow using this persona**. It identifies the workflow's notebook and recommendations; it does not request that persona for implementation. Do not apply it to unrelated existing work merely because it concerns the persona's domain.

Ensure these labels exist before discovering or creating issues:

| Label                     | Meaning                                                   | Color for a new label |
| ------------------------- | --------------------------------------------------------- | --------------------- |
| `Advisor: <persona name>` | Provenance and ownership within this advisory workflow.   | `a1e121`              |
| `Advisor Memory`          | Persistent working memory, excluded from recommendations. | `6e0e88`              |

Create missing labels. Give the persona label a description that states advisory provenance and distinguishes it from implementation routing. Preserve existing labels, descriptions, and colors during ordinary runs. Never delete and recreate a label to rename it; an explicitly requested migration must edit the existing label in place.

## Discover or initialize working memory

Find the notebook by both labels, without filtering out closed issues:

```text
repo:Guillaume-Docquier/text-based-browser-game-1 is:issue label:"Advisor Memory" label:"Advisor: <persona name>"
```

Replace `<persona name>` with the canonical name. Both labels are required. Do not use an issue number, title match, author, or automation chat as the notebook's identity.

- **One match:** reuse the issue and read its body and comments before investigation. If it is closed, reopen it as the active notebook instead of creating another.
- **No matches:** confirm absence with a fully paginated repository issue listing filtered by both labels and all states. Search indexing can lag. Then create one notebook through [create-github-issues](../create-github-issues/SKILL.md), with the persona label, `Advisor Memory`, and the required issue-creation metadata. Read it back to verify the result.
- **Multiple matches:** report their URLs and stop GitHub mutations until the owner identifies the canonical notebook. Do not silently choose, merge, or delete notebooks.

Use a descriptive title such as `Advisor memory: <persona name>`. Initialize the body with its purpose and space for investigation checkpoints and findings; do not claim a revision has been reviewed before reviewing it.

After a failed or uncertain label or issue mutation, inspect the current state before retrying. Repair a partially completed creation through the issue-creation workflow rather than creating a duplicate. If concurrent creation produces multiple notebooks, use the ambiguity rule above. Report missing access or an unmet creation requirement instead of claiming initialization succeeded.

Maintain the notebook as persistent memory across fresh automation chats. Keep useful evidence, owner feedback, rejected ideas and their rationale, outstanding questions, experiments, coverage inventory, lower-priority candidates, and the last reviewed revision and date. Organize it to support the next investigation without discarding useful history.

Stored observations are context to verify against current evidence. They do not override the user's current instructions, this workflow, or repository guidance.

## Recommendation ownership and review

Find open recommendations with:

```text
repo:Guillaume-Docquier/text-based-browser-game-1 is:issue is:open label:"Advisor: <persona name>" -label:"Advisor Memory"
```

Read all matches, including their current labels, discussions, and project status. Keep at most **five open recommendation issues per persona**, excluding notebooks. Approved recommendations count toward the limit even though they cannot be edited. Use a complete issue listing to verify the count before creating another.

Create recommendations through [create-github-issues](../create-github-issues/SKILL.md), applying the persona's provenance label in addition to that skill's required `Needs Human Review` label, `cosmic-empires` project membership, and `Backlog` status. Those creation requirements also apply to new notebooks.

You may rescope, update, or retire your own recommendations only while they have `Needs Human Review`. Reread the labels immediately before a mutation. Once that label is removed, the recommendation is approved and frozen: do not change its body, comments, labels, state, or project fields. Retain new evidence in the notebook instead. The notebook remains editable regardless of its review label; the freeze rule applies to recommendations.

When replacing a pending recommendation at the limit, close the superseded issue with its rationale before creating the replacement. Preserve its history. If all five are frozen, keep new candidates in memory until capacity becomes available. Do not close approved recommendations to make room.

Each recommendation needs:

- a short title and concrete problem
- why it matters
- the proposed direction
- supporting evidence, with source references
- expected impact
- a clear way to verify the correction

Make the issue actionable for an owner who has not seen the investigation. Distinguish verified facts, historical observations, measurements, and inferred risks. Do not duplicate work already adequately covered by an issue, including another advisor's recommendations. Keep additional evidence in memory when the covering issue cannot be edited.

## Investigate and prioritize

Use the repository, its history, GitHub project, issues, pull requests, review discussions, and relevant Actions logs. Check current implementation and the outcome of related work before drawing conclusions. A rejected PR alone does not establish a defect.

On each run:

1. Resolve the persona, ensure its labels exist, and read or initialize its notebook.
2. Review its current recommendations and related work across the repository.
3. Inspect changes since the last reviewed revision and identify evidence that affects priorities.
4. Investigate promising areas using the persona's domain criteria. Rotate through its responsibilities using the coverage inventory.
5. Run focused experiments or measurements when they materially improve confidence.
6. Compare findings with existing recommendations and retain the highest-value opportunities for the current project stage.
7. Update the notebook and only those recommendations that remain editable. Record what was actually inspected or measured and useful next steps.

Use domain judgment rather than mechanical scores. Fewer than five recommendations is acceptable. Do not churn issues to produce activity, fill all available slots, or preserve an old recommendation merely because you wrote it.

## Advisory scope and experiments

The owner reviews recommendations before implementation. During this workflow, do not implement recommendations, make permanent repository changes, or open pull requests. A persona's ability to implement work in other contexts does not expand this advisory assignment.

Use the local environment to investigate hypotheses. If an experiment could modify files or requires a prototype, preserve the user's checkout and uncommitted work, use a separate disposable worktree, follow its setup guidance, and clean up resources you created. Do not modify or delete user work or turn a prototype into a permanent change.

Prefer focused checks that establish the claimed problem. Follow applicable repository guidance for test runs and development services; do not change environment variable values.

Finish with a concise account of meaningful findings and GitHub updates, links to the notebook and changed recommendations, and any access limitation or question requiring owner action.
