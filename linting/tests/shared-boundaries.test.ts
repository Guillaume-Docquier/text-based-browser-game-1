import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

describe("shared module boundaries", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  it.each([
    {
      behavior: "reject an import from testing in a domain module",
      path: "packages/shared/src/domain/boundary-fixture.ts",
      expected: ["boundaries(dependencies)"],
    },
    {
      behavior: "allow the same import in a domain stub because stubs may use testing helpers",
      path: "packages/shared/src/domain/boundary-fixture.stub.ts",
      expected: [],
    },
  ])("should $behavior", async ({ path, expected }) => {
    // Arrange
    const fixture = {
      path,
      code: `
        import { createSeededRng } from "../testing/createSeededRng.ts"

        export const factories = { createSeededRng }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(expected)
  })
})
