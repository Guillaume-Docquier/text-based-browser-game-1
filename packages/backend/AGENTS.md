# Backend agent instructions

On Windows with Codex, `CodexSandboxOffline` cannot access the Docker daemon pipe. Run `pnpm --filter backend test --project concurrency` with `exec_command` and `sandbox_permissions: "require_escalated"`. This uses the normal Docker-enabled account, not administrator elevation.
