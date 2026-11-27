import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { formatRequirementsFile } from "./formatRequirementsFile.ts"

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
  let formatted: string
  try {
    formatted = formatRequirementsFile(source)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
    console.error(`${file}: ${error.message}`)
    process.exitCode = 1
    continue
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
