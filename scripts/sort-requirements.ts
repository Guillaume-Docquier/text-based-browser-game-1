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

function sortRequirements(source: string): string | undefined {
  const lines = source.split("\n")
  const firstRow = findFirstRequirementRow(lines)
  if (firstRow === undefined) {
    return undefined
  }
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
  return lines.join("\n")
}

const [mode, ...paths] = process.argv.slice(2)
if (mode !== "--check" && mode !== "--write") {
  throw new Error("Expected --check or --write")
}

function matchesPath(file: string, input: string): boolean {
  const pattern = path.relative(".", input).split(path.sep).join("/")
  return pattern === "" || file === pattern || file.startsWith(pattern + "/") || path.matchesGlob(file, pattern)
}

const includes = paths.filter((path) => !path.startsWith("!"))
const excludes = paths.filter((path) => path.startsWith("!")).map((path) => path.slice(1))
const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.requirements.md"], {
  encoding: "utf8",
})
for (const file of files.split("\0")) {
  if (
    file === "" ||
    !existsSync(file) ||
    (includes.length > 0 && !includes.some((path) => matchesPath(file, path))) ||
    excludes.some((path) => matchesPath(file, path))
  ) {
    continue
  }
  const source = readFileSync(file, "utf8")
  const sorted = sortRequirements(source)
  if (sorted === undefined) {
    console.error(`${file} is missing the ID and Requirement table under ## Requirements.`)
    process.exitCode = 1
  } else if (source !== sorted) {
    if (mode === "--write") {
      writeFileSync(file, sorted)
    } else {
      console.error(`${file} has requirements out of ID order. Run pnpm format:fix.`)
      process.exitCode = 1
    }
  }
}
