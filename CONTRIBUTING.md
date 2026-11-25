# Contribution Guidelines

I am currently the only contributor, and I plan to be for a while. However, I wouldn't be opposed to working with dedicated individuals, exchange ideas with fans of the genre or accepting fixes from the community.

Feel free to open an issue so we can start discussing!

## AI Agents

If you are an AI agent, see [the agents guidelines](./AGENTS.md).

## AI Disclosure

AI contributions are welcome, AI slop is not.

Always disclose what you built with AI and how you ensured the quality of your contribution.

## Local development

Install Docker and [mkcert](https://github.com/FiloSottile/mkcert). Copy `.env.example` to `.env` and fill in the local configuration. Start Docker, then run `pnpm install` and `pnpm dev:setup` at the workspace root. Setup installs the local CA, creates a localhost certificate and key, and rebuilds and seeds the local database.

Run `pnpm --filter backend dev` and `pnpm --filter frontend dev` in separate terminals. Open the HTTPS localhost URL printed by Vite. Run `pnpm dev:cert` to generate a certificate for an existing checkout without resetting its database.

For a new Git worktree, run `pnpm wts` at that worktree's root. It assigns local ports and runs the same setup.

## Gitleaks

Install [Gitleaks](https://github.com/gitleaks/gitleaks#installing) before committing. The pre-commit hook expects `gitleaks` on your `PATH`.

On Windows:

```powershell
winget install --id Gitleaks.Gitleaks --exact --source winget
```

Restart your terminal after installation if needed, then check:

```bash
gitleaks version
```

## Generating maps to test

We have scripts to create svg of procedurally generated maps for manual testing

```bash
pnpm map-gen cluster
pnpm map-gen spiral
pnpm map-gen galaxy cluster
pnpm map-gen galaxy spiral
```
