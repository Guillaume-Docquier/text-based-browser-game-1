---
name: run-e2e-tests
description: Run and follow frontend Playwright end-to-end tests. Use whenever running this repository's E2E suite, focused specs, pnpm fte, or verification that includes E2E tests.
---

# Run end-to-end tests

Run from the repository root. Let Playwright start and stop the backend and frontend through its configured web servers.

## Execution

Use `exec_command` with `tty: true`. On native Windows in Codex, use a reviewed command exception with `sandbox_permissions: "require_escalated"` and `prefix_rule: ["pnpm", "--filter", "frontend", "e2e"]`. The sandbox denies Playwright's `taskkill /T /F` server cleanup, leaving the runner waiting for servers to close. Use the default sandbox on other platforms.

In PowerShell, run these lines in one command:

```powershell
$env:PLAYWRIGHT_HTML_OPEN = "never"
$env:PLAYWRIGHT_LIST_PRINT_STEPS = "1"
pnpm --filter frontend e2e --add-reporter=list
```

In other shells, set the same environment variables for the test command. These settings print tests and steps while preserving the HTML report without automatically serving it after failures.

For a focused run, add a spec path relative to `apps/frontend`, such as `playwright/specs/planets.spec.ts`. Keep Playwright's setup dependencies enabled so Clerk authentication runs.

## Progress and results

Poll the returned terminal session with `write_stdin` until the command exits. Assess quiet intervals using the latest test or step, test timeout, and diagnostics; passing test output alone does not confirm server cleanup finished.

Report the test counts, command exit code, and relevant failures or warnings. The HTML report is saved at `apps/frontend/playwright-report/index.html`.
