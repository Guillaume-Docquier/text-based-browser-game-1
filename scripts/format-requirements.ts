import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

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

export function formatRequirementsFile(source: string): string {
  const lines = source.split("\n")
  const firstRow = findFirstRequirementRow(lines)
  if (firstRow === undefined) {
    throw new SyntaxError("Missing the ID and Requirement table under ## Requirements.")
  }
  sortRequirements(lines, firstRow)
  return lines.join("\n")
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

function matchesPath(file: string, input: string): boolean {
  const pattern = path.relative(".", input).split(path.sep).join("/")
  return pattern === "" || file === pattern || file.startsWith(pattern + "/") || path.matchesGlob(file, pattern)
}

function formatFile(file: string, mode: "--check" | "--write"): void {
  const source = readFileSync(file, "utf8")
  let formatted: string
  try {
    formatted = formatRequirementsFile(source)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
    console.error(`${file}: ${error.message}`)
    process.exitCode = 1
    return
  }
  if (source !== formatted) {
    if (mode === "--write") {
      writeFileSync(file, formatted)
    } else {
      console.error(`${file} needs formatting. Run pnpm format:fix.`)
      process.exitCode = 1
    }
  }
}

function selectRequirementFiles(paths: string[]): string[] {
  const includes = paths.filter((path) => !path.startsWith("!"))
  const excludes = paths.filter((path) => path.startsWith("!")).map((path) => path.slice(1))
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.requirements.md"], {
    encoding: "utf8",
  })
  return files
    .split("\0")
    .filter((file) => existsSync(file))
    .filter((file) => includes.length === 0 || includes.some((path) => matchesPath(file, path)))
    .filter((file) => !excludes.some((path) => matchesPath(file, path)))
}

function main(args: string[]): void {
  const [mode, ...paths] = args
  if (mode !== "--check" && mode !== "--write") {
    throw new Error("Expected --check or --write")
  }

  for (const file of selectRequirementFiles(paths)) {
    formatFile(file, mode)
  }
}

if (import.meta.main) {
  main(process.argv.slice(2))
}
