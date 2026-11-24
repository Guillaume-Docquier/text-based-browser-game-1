import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe("global lint rules in test files", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  it.each([
    "fixture.test.ts",
    "packages/backend/src/fixture.unit.test.ts",
    "packages/backend/src/fixture.integration.test.ts",
    "packages/backend/src/fixture.concurrency.test.ts",
    "packages/backend/src/fixture.test-d.ts",
    "packages/frontend/src/fixture.browser.test.tsx",
    "packages/shared/src/fixture.unit.test.ts",
    "packages/shared/src/fixture.spec.ts",
  ])("should reject finally in %s", async (path) => {
    // Arrange
    const fixture = {
      path,
      code: `
        export function check(run: () => void, clean: () => void): void {
          try {
            run()
          } finally {
            clean()
          }
        }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual(["eslint-js(no-restricted-syntax)"])
  })

  it("should allow a Vitest test to catch an error without a finally block", async () => {
    // Arrange
    const fixture = {
      path: "fixture.test.ts",
      code: `
        export function succeeds(run: () => void): boolean {
          try {
            run()
            return true
          } catch {
            return false
          }
        }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual([])
  })

  it("should allow finally in Playwright specs because Vitest cleanup hooks do not run there", async () => {
    // Arrange
    const fixture = {
      path: "packages/frontend/playwright/specs/fixture.spec.ts",
      code: `
        export function check(run: () => void, clean: () => void): void {
          try {
            run()
          } finally {
            clean()
          }
        }
      `,
    }

    // Act
    const diagnostics = await session.lint(fixture)

    // Assert
    expect(diagnostics).toStrictEqual([])
  })

  describe("namespace imports in frontend browser tests", () => {
    it("should allow a story module namespace for composeStories", async () => {
      // Arrange
      const fixture = {
        path: "packages/frontend/src/components/fixture.browser.test.tsx",
        code: `
          import { composeStories } from "@storybook/react-vite"
          import * as stories from "./button.stories.tsx"

          export const composedStories = composeStories(stories)
        `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })

    it("should reject a namespace import from another module", async () => {
      // Arrange
      const fixture = {
        path: "packages/frontend/src/components/fixture.browser.test.tsx",
        code: `
          import * as tools from "@guillaume-docquier/tools-ts"

          export const result = tools.Result.Success(1)
        `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual(["import(no-namespace)"])
    })
  })

  describe.each([
    ["root", "fixture.test.ts"],
    ["backend", "packages/backend/src/fixture.test.ts"],
    ["frontend", "packages/frontend/src/fixture.test.ts"],
    ["frontend TSX", "packages/frontend/src/fixture.test.tsx"],
    ["shared", "packages/shared/src/fixture.test.ts"],
  ])("%s test files", (_scope, path) => {
    describe("strict comments", () => {
      it("should allow an INTENT comment", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // INTENT: Keep the default available before startup.
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })

      it("should allow a CONSTRAINT comment", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // CONSTRAINT: The protocol reserves the first identifier.
          export const firstId = 2
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })

      it("should allow an oxlint disable directive", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // oxlint-disable-next-line no-debugger
          debugger
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })

      it("should allow a TypeScript expect-error directive", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // @ts-expect-error: Exercise an invalid value.
          export const count: number = "invalid"
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })

      it("should reject an ordinary comment", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // Set the default limit.
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([allowedComments])
      })

      it.each(["Arrange", "Act", "Assert"])("should allow %s", async (phase) => {
        // Arrange
        const fixture = {
          path,
          code: `
          // ${phase}
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })

      it("should reject a block comment with an allowed prefix", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          /* Arrange */
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([allowedComments])
      })

      it("should require the prefix at the start of the comment text", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          // This is the Arrange section.
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([allowedComments])
      })
    })
  })
})
