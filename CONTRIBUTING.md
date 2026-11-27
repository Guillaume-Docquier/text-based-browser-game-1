# Contribution Guidelines

I am currently the only contributor, and I plan to be for a while. However, I wouldn't be opposed to working with dedicated individuals, exchange ideas with fans of the genre or accepting fixes from the community.

Feel free to open an issue so we can start discussing!

## AI Disclosure

AI contributions are welcome, AI slop is not.

Always disclose what you built with AI and how you ensured the quality of your contribution.

## Project setup

Install the dependencies below, and run `pnpm dev:setup`

### Gitleaks

Install [Gitleaks](https://github.com/gitleaks/gitleaks#installing) before committing. The pre-commit hook expects `gitleaks` on your `PATH`.

On Windows:

```powershell
winget install --id Gitleaks.Gitleaks --exact --source winget
```

Restart your terminal after installation if needed, then check:

```bash
gitleaks version
```

### mkcerts

Install [mkcerts](https://github.com/FiloSottile/mkcert) to get an https certificate during development.

On Windows (you probably need to be admin):

```powershell
choco install mkcert
```

## Generating maps to test

Run these commands from the repository root to write experimental SVGs to the ignored `generated/` directory. Use `--seed` to repeat a run or `--output` to choose a file.

```bash
pnpm map-gen cluster
pnpm map-gen spiral
pnpm map-gen galaxy cluster
pnpm map-gen galaxy spiral
```

Run `pnpm map-gen:previews` to regenerate the six [tracked previews](packages/shared/src/galaxy-creation/preview/) with seed `1234`. Each galaxy command produces an overview and a sample of star systems. The pre-commit hook regenerates and stages these previews from the current working tree when a change under `packages/shared/src/galaxy-creation/` is staged. The shared CI job runs the same command on the committed code.
