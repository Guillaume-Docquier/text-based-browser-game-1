---
name: implementation-retro
description: Write a short retrospective on a ticket's implementation. Use when asked for a ticket retro or when the ticket workflow calls for one.
---

# Implementation retro

Answer these questions in the current chat unless the calling workflow specifies another destination.

Before drafting, read the [live turn updates retro](references/live-turn-updates-retro.md). Use its headings and level of detail. Review the ticket, the final diff, and relevant review and verification results for concrete examples from the implementation.

- What substantial work did the ticket leave out? What made it necessary?
- Did you follow the applicable architecture guidance? Name the rule and the implementation choice that shows where you followed it or departed from it.
- Which guidance helped, and which made the work harder? Give a concrete example of its effect.
- Did following an architecture rule literally work against its purpose? If so, describe what happened and how you would revise the guidance.
- What obstacles or guardrails did you encounter? What caught an issue, and what helped you find your way?

Keep it brief. Assume the reader knows the ticket, the codebase, and the diff. Explain what happened and how it affected the implementation, deployment, or handoff. If a question has no applicable example, say so in a few words.
