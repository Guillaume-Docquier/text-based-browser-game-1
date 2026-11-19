import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const oxlint = fileURLToPath(new URL("./bin/oxlint", import.meta.resolve("oxlint/package.json")))
const fixturesDirectory = path.join(repositoryRoot, ".temp")

type LintFixture = {
  code: string
  path?: string
  config?: string
}

export function lint({ code, path: fixturePath = "fixture.ts", config = "oxlint.config.ts" }: LintFixture): string[] {
  mkdirSync(fixturesDirectory, { recursive: true })
  using fixture = mkdtempDisposableSync(path.join(fixturesDirectory, "lint-"))
  const sourcePath = path.resolve(fixture.path, fixturePath)
  if (!sourcePath.startsWith(fixture.path + path.sep)) {
    throw new Error(`Expected a path inside the lint fixture, received ${fixturePath}`)
  }

  const configUrl = pathToFileURL(path.resolve(repositoryRoot, config))
  writeFileSync(path.join(fixture.path, "oxlint.config.ts"), `export { default } from ${JSON.stringify(configUrl.href)}\n`)
  writeFileSync(
    path.join(fixture.path, "tsconfig.json"),
    JSON.stringify({ extends: path.join(repositoryRoot, "tsconfig.json"), files: [path.relative(fixture.path, sourcePath)], include: [] }),
  )
  mkdirSync(path.dirname(sourcePath), { recursive: true })
  writeFileSync(sourcePath, code, { flag: "wx" })

  const result = spawnSync(
    process.execPath,
    [oxlint, "--config", "oxlint.config.ts", "--format", "json", "--threads", "1", "--", sourcePath],
    {
      cwd: fixture.path,
      encoding: "utf8",
    },
  )
  if (result.error !== undefined) {
    throw result.error
  }
  if ((result.status !== 0 && result.status !== 1) || !result.stdout.trimStart().startsWith("{")) {
    throw new Error(`Oxlint failed to lint ${fixturePath} (exit ${result.status}):\n${result.stderr}${result.stdout}`)
  }

  const report: unknown = JSON.parse(result.stdout)
  if (
    typeof report !== "object" ||
    report === null ||
    !("number_of_files" in report) ||
    report.number_of_files !== 1 ||
    !("diagnostics" in report) ||
    !Array.isArray(report.diagnostics)
  ) {
    throw new Error(`Expected an Oxlint report for one file, received:\n${result.stdout}`)
  }

  return report.diagnostics.map((diagnostic: unknown): string => {
    if (typeof diagnostic === "object" && diagnostic !== null && "code" in diagnostic && typeof diagnostic.code === "string") {
      return diagnostic.code
    }
    throw new Error(`Oxlint reported a diagnostic without a code:\n${JSON.stringify(diagnostic)}`)
  })
}
