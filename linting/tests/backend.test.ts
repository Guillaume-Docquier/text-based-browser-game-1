import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

describe("backend lint rules", () => {
  it.each([
    {
      behavior: "allow returning an awaited void expression in a router",
      path: "packages/backend/src/api/gameplay/gameplay.router.ts",
      expected: [],
    },
    {
      behavior: "reject returning an awaited void expression in a regular module",
      path: "packages/backend/src/api/gameplay/updateReadiness.useCase.ts",
      expected: ["typescript(no-confusing-void-expression)"],
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
    const diagnostics = lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(expected)
  })
})
