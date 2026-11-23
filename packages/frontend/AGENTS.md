# Frontend agent instructions

`pnpm --filter frontend storybook:build` must be run through a reviewed, one-command Codex sandbox exception (`require_escalated` with the exact prefix `pnpm --filter frontend storybook:build`) to avoid sandbox cache write issues.
