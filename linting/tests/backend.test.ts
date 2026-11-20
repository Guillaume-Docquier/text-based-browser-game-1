import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

describe("backend lint rules", () => {
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
      behavior: "reject returning an awaited void expression in a regular module",
      path: "packages/backend/src/api/gameplay/updateReadiness.useCase.ts",
      expected: ["typescript(no-confusing-void-expression)"],
    },
    {
      behavior:
        "allow returning an awaited void expression in a router because routers and their tests intentionally return awaited void outputs to streamline the router handlers",
      path: "packages/backend/src/api/gameplay/gameplay.router.ts",
      expected: [],
    },
  ])("should $behavior", ({ path, expected }) => {
    // Arrange
    const fixture = {
      path,
      code: `
        export const updateReadiness = async (execute: () => Promise<void>): Promise<void> => await execute()
      `,
    }

    // Act
    const diagnostics = session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(expected)
  })
})
