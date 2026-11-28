import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { formatRequirementsFile } from "./format-requirements.ts"

describe("formatRequirementsFile", () => {
  it("should sort the prefixes and requirements tables by their respective IDs", () => {
    const input = `# Galaxy Creation requirements

Next ID number: 0021

## Prefixes

| ID | Stands for |
| --- | --- |
| ST | Star. |
| GC | Galaxy Creation. |
| PL | Planet. |

## Requirements

| ID | Requirement |
| --- | --- |
| GC-ST-0003 | A star. |
| GC-PL-0010 | A planet with an escaped \\| pipe. |
| GC-0008 | The whole galaxy. |
| GC-PL-0002 | Another planet. |
`
    const expected = `# Galaxy Creation requirements

Next ID number: 0021

## Prefixes

| ID | Stands for |
| --- | --- |
| GC | Galaxy Creation. |
| PL | Planet. |
| ST | Star. |

## Requirements

| ID | Requirement |
| --- | --- |
| GC-0008 | The whole galaxy. |
| GC-PL-0002 | Another planet. |
| GC-PL-0010 | A planet with an escaped \\| pipe. |
| GC-ST-0003 | A star. |
`

    expect(formatRequirementsFile(input)).toStrictEqual(Result.Success(expected))
    expect(formatRequirementsFile(expected)).toStrictEqual(Result.Success(expected))
  })

  it("should keep an empty requirements table and leave other tables in their original order", () => {
    const input = `## Requirements

| ID | Requirement |
| --- | --- |

## Notes

| ID | Requirement |
| --- | --- |
| B | First note. |
| A | Second note. |
`

    expect(formatRequirementsFile(input)).toStrictEqual(Result.Success(input))
  })

  it("should preserve CRLF and the end of the file when the last row moves", () => {
    const header = "## Requirements\r\n\r\n| ID | Requirement |\r\n| --- | --- |\r\n"
    const input = header + "| TR-0002 | Second. |\r\n| TR-0001 | First. |"
    const expected = header + "| TR-0001 | First. |\r\n| TR-0002 | Second. |"

    expect(formatRequirementsFile(input)).toStrictEqual(Result.Success(expected))
  })

  it("should report a missing requirements table", () => {
    const input = `## Requirements

| ID | Notes |
| --- | --- |
`

    expect(formatRequirementsFile(input)).toStrictEqual(
      Result.Failure(new SyntaxError("Missing the ID and Requirement table under ## Requirements.")),
    )
  })

  it("should report a malformed table under the prefixes heading", () => {
    const input = `## Prefixes

| ID | Notes |
| --- | --- |

## Requirements

| ID | Requirement |
| --- | --- |
`

    expect(formatRequirementsFile(input)).toStrictEqual(
      Result.Failure(new SyntaxError("Missing the ID and Stands for table under ## Prefixes.")),
    )
  })
})
