# Contribution Guidelines

I am currently the only contributor, and I plan to be for a while. However, I wouldn't be opposed to working with dedicated individuals, exchange ideas with fans of the genre or accepting fixes from the community.

Feel free to open an issue so we can start discussing!

## AI Agents

If you are an AI agent, see [the agents guidelines](./AGENTS.md).

## AI Disclosure

AI contributions are welcome, AI slop is not.

Always disclose what you built with AI and how you ensured the quality of your contribution.

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

## Testing lint rules

Run `pnpm test:lint`. Add scenarios for source files in `linting/tests/global.test.ts` and scenarios for test files in `linting/tests/test.test.ts`. Show the source as an inline TypeScript snippet and assert the exact Oxlint diagnostic codes. The `lint` helper defaults to `fixture.ts` at the repository root. Set a repository-relative `path` to test a package config or a filename override. Oxlint discovers the applicable configs from that path.

## Generating maps to test

We have scripts to create svg of procedurally generated maps for manual testing

```bash
pnpm map-gen cluster
pnpm map-gen spiral
pnpm map-gen galaxy cluster
pnpm map-gen galaxy spiral
```
