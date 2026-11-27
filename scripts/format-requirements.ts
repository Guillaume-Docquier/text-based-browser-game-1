import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { Result } from "@guillaume-docquier/tools-ts"

function findFirstRequirementRow(lines: string[]): number | undefined {
  const heading = lines.findIndex((line) => line.trimEnd() === "## Requirements")
  if (heading === -1) {
    return undefined
  }
  let header = heading + 1
  while (lines[header]?.trim() === "") {
    header++
  }
  if (
    !/^\s*\|?\s*ID\s*\|\s*Requirement\s*\|?\s*$/.test(lines[header]) ||
    !/^\s*\|?\s*:?-+:?\s*\|\s*:?-+:?\s*\|?\s*$/.test(lines[header + 1])
  ) {
    return undefined
  }

  return header + 2
}

export function formatRequirementsFile(source: string): Result<string, SyntaxError> {
  const lines = source.split("\n")
  const firstRow = findFirstRequirementRow(lines)
  if (firstRow === undefined) {
    return Result.Failure(new SyntaxError("Missing the ID and Requirement table under ## Requirements."))
  }
  sortRequirements(lines, firstRow)
  return Result.Success(lines.join("\n"))
}

function sortRequirements(lines: string[], firstRow: number): void {
  const rows = []
  for (const line of lines.slice(firstRow)) {
    const cell = /^\s*\|?\s*([^|\s][^|]*)\|/.exec(line)
    if (cell === null) {
      break
    }
    rows.push({ id: cell[1].trimEnd(), text: line.replace(/\r$/, "") })
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const [index, row] of rows.entries()) {
    const position = firstRow + index
    lines[position] = row.text + (lines[position].endsWith("\r") ? "\r" : "")
  }
}

function formatFile(file: string, mode: "--check" | "--write"): Result<void, Error> {
  const source = Result.tryCatch(() => readFileSync(file, "utf8"))
  if (Result.isFailure(source)) {
    return source
  }
  const formatted = formatRequirementsFile(source.value)
  if (Result.isFailure(formatted)) {
    return formatted
  }
  if (source.value === formatted.value) {
    return Result.Success(undefined)
  }
  if (mode === "--check") {
    return Result.Failure(new Error("Needs formatting. Run pnpm format:fix."))
  }
  return Result.tryCatch(() => {
    writeFileSync(file, formatted.value)
  })
}

function listRepositoryRequirementFiles(): Result<string[], Error> {
  return Result.tryCatch(() => {
    const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ":(top)*.requirements.md"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return files.split("\0").filter((file) => existsSync(file))
  })
}

function main(args: string[]): Result<void, string[]> {
  const [mode, ...paths] = args
  if (mode !== "--check" && mode !== "--write") {
    return Result.Failure(["Expected --check or --write"])
  }

  const files = paths.length === 0 ? listRepositoryRequirementFiles() : Result.Success(paths)
  if (Result.isFailure(files)) {
    return Result.Failure([files.error.message])
  }
  const errors: string[] = []
  for (const file of files.value) {
    const result = formatFile(file, mode)
    if (Result.isFailure(result)) {
      errors.push(`${file}: ${result.error.message}`)
    }
  }
  return errors.length === 0 ? Result.Success(undefined) : Result.Failure(errors)
}

if (import.meta.main) {
  const result = main(process.argv.slice(2))
  if (Result.isFailure(result)) {
    console.error(result.error.join("\n"))
    process.exitCode = 1
  }
}
