import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

describe("lint fixtures", () => {
  it("should run type-aware rules on the snippet", () => {
    // Arrange
    const fixture = {
      code: `
        Promise.resolve(1)
      `,
    }

    // Act
    const diagnostics = lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(["typescript(no-floating-promises)"])
  })

  it("should discover the backend config from a repository-relative path", () => {
    // Arrange
    const fixture = {
      path: "packages/backend/src/example/current-time.ts",
      code: `
        export const currentTime = Date.now()
      `,
    }

    // Act
    const diagnostics = lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(["eslint(no-restricted-globals)"])
  })
})
