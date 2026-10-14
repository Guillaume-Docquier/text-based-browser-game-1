# Increment 02 implementer R8 — O-I2-19

The Windows pre-commit hook now passes an explicit argument cap to the installed lint-staged 17.6 runner. The hook remains enabled and invokes the same repository-defined lint and formatting tasks for all matching staged files.

The sole repository source edit is .husky/pre-commit:

- Before: pnpm lint-staged
- After: pnpm lint-staged --max-arg-length 4096

lint-staged estimates command length from the task string and joined filenames, while Windows permits at most 8,191 command-line characters. The previously observed 8,145 and 8,113 estimates left too little room for pnpm/CMD wrapper arguments. Its installed chunking implementation recursively splits the staged file list when the configured maximum is exceeded, retaining task order and parallel groups. The conservative 4,096 limit avoids the wrapper overflow without changing file matching or task definitions.

## Execution

Ran pnpm lint-staged --max-arg-length 4096 directly, which is the exact command in the active hook. It completed with exit 0. lint-staged reported 51 files for each configured glob: three successful formatter invocations for the metadata/document glob, then two successful oxlint --fix invocations and two successful formatter invocations for the JavaScript/TypeScript glob. It also confirmed that it hid and restored partially staged changes and staged task changes. The full output and exact exit receipt are in evidence/increment-02-implementer-r8/lint-staged-r8.log and evidence/increment-02-implementer-r8/lint-staged-r8.exit.txt.

## Preservation checks

Before and after the run, the apps/, packages/, and docs/ manifest contained the same 61 paths and had aggregate SHA256 6D1F3C2C01406252D31B46ABCFF8AF71905DCF789336426A88CB7A2AD96EDB2C. The before/after manifest files are preserved in the R8 evidence directory.

The staged inventory remained 104 paths. The before/after git diff --cached --raw and name/status snapshots are byte-identical; no staged blob changed. The updated hook is unstaged, and the R8 report/evidence are untracked. No commit was attempted, and no environment or Git configuration was changed.

The hook's before/after SHA256 values are 41CEEA3AD087B3B455E142A82D5A2CFA9EF3A8F5D42AB4D4CB648C176B080C69 and C0508811ED3AC34DFCEB4CBD1DF365217F9554E904DC4CF070368EBC248E1637, respectively. Its one-line diff is the only repository source change in this correction.

This R8 quality-gate correction does not rerun or replace the separately completed Increment 02 gameplay acceptance gates. Root retains acceptance authority and will run the commissioned independent checks after handoff.

STOP: all R8 writes and verification commands are complete. No commit was made.
