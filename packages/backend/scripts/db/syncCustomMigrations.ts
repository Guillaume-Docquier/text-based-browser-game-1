import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url))
const sourceDirectory = "migrations"
const outputDirectory = "drizzle"
const journalPath = path.join(outputDirectory, "meta", "_journal.json")
const sourceFilePattern = /^(\d{4})_([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/
const JournalSchema = z.object({
  entries: z.array(z.object({ tag: z.string().regex(/^\d+_[\w-]+$/) })),
})

type SourceMigration = { name: string; file: string }

syncCustomMigrations()

function syncCustomMigrations(): void {
  const sources = readSources()
  const sourceNames = new Set(sources.map(({ name }) => name))
  const existing = readJournal().entries.filter(({ tag }) => sourceNames.has(migrationName(tag)))

  for (const [index, { tag }] of existing.entries()) {
    syncExistingMigration(sources[index], tag)
  }

  for (const source of sources.slice(existing.length)) {
    const tag = generateCustomMigration(source.name)
    const output = path.join(outputDirectory, `${tag}.sql`)
    writeFileSync(backendPath(output), readFileSync(backendPath(source.file)))
  }
}

function syncExistingMigration(source: SourceMigration | undefined, tag: string): void {
  if (source?.name !== migrationName(tag)) {
    throw new Error(
      `Handwritten migration ${tag} is out of order or has more than one journal entry. Append new source files after the existing ones.`,
    )
  }

  const output = path.join(outputDirectory, `${tag}.sql`)
  const sql = readFileSync(backendPath(source.file))
  if (!existsSync(backendPath(output))) {
    writeFileSync(backendPath(output), sql)
  } else if (!readFileSync(backendPath(output)).equals(sql)) {
    throw new Error(
      `${output} differs from ${source.file}. Restore the existing SQL and add a new numbered source migration for the change.`,
    )
  }
}

function readSources(): SourceMigration[] {
  const files = readdirSync(backendPath(sourceDirectory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort()

  const numbers = new Set<string>()
  const names = new Set<string>()
  return files.map((file) => {
    const [, number, name] = sourceFilePattern.exec(file) ?? []
    if (number === undefined || name === undefined) {
      throw new Error(`Invalid migration filename ${file}. Use NNNN_descriptive-name.sql.`)
    }
    if (numbers.has(number) || names.has(name)) {
      throw new Error(`Handwritten migration ${file} must have a unique number and name.`)
    }
    numbers.add(number)
    names.add(name)
    return { name, file: path.join(sourceDirectory, file) }
  })
}

function generateCustomMigration(name: string): string {
  const drizzleKit = fileURLToPath(new URL("../../node_modules/drizzle-kit/bin.cjs", import.meta.url))
  execFileSync(
    process.execPath,
    [
      drizzleKit,
      "generate",
      "--dialect",
      "postgresql",
      "--schema",
      "./src/lib/db/schema.ts",
      "--out",
      outputDirectory,
      "--custom",
      "--name",
      name,
    ],
    { cwd: backendDirectory, stdio: "inherit" },
  )

  const latest = readJournal().entries.at(-1)
  if (latest === undefined || migrationName(latest.tag) !== name) {
    throw new Error(`Drizzle did not append a custom migration for ${name}.`)
  }
  return latest.tag
}

function readJournal(): z.infer<typeof JournalSchema> {
  return JournalSchema.parse(JSON.parse(readFileSync(backendPath(journalPath), "utf8")))
}

function migrationName(tag: string): string {
  return tag.slice(tag.indexOf("_") + 1)
}

function backendPath(file: string): string {
  return path.join(backendDirectory, file)
}
