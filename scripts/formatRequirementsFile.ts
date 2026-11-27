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
