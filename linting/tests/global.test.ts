import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LintSession } from "./lint-session.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe("global lint rules in source files", () => {
  const session = new LintSession()

  // oxlint-disable-next-line vitest/no-hooks -- Start one Oxlint process for all cases in this file.
  beforeAll(async () => {
    await session.start()
  })

  afterAll(async () => {
    await session.stop()
  })

  describe("default export exceptions for tool entry points", () => {
    it.each([
      ["Railway's auto-discovered config", ".railway/railway.ts"],
      ["Oxlint's plugin loader", "linting/plugins/fixture.ts"],
      ["Storybook's config loader", "packages/frontend/.storybook/main.ts"],
    ])("should allow a default export for %s", async (_reason, path) => {
      // Arrange
      const fixture = {
        path,
        code: `
          export default { enabled: true }
        `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })
  })

  describe.each([
    ["root", "fixture.ts"],
    ["backend", "packages/backend/src/fixture.ts"],
    ["frontend", "packages/frontend/src/fixture.ts"],
    ["shared", "packages/shared/src/fixture.ts"],
  ])("%s source files", (_scope, path) => {
    describe("no barrel files", () => {
      it.each([
        {
          name: "wildcard re-exports",
          code: `
            export * from "node:assert/strict"
          `,
          diagnostic: "oxc(no-barrel-file)",
        },
        {
          name: "type-only wildcard re-exports",
          code: `
            export type * from "@guillaume-docquier/tools-ts"
          `,
          diagnostic: "oxc(no-barrel-file)",
        },
        {
          name: "namespace re-exports",
          code: `
            export * as react from "react"
          `,
          diagnostic: "oxc(no-barrel-file)",
        },
        {
          name: "named re-exports",
          code: `
            export { describe } from "vitest"
          `,
          diagnostic: "eslint-js(no-restricted-syntax)",
        },
        {
          name: "type-only re-exports",
          code: `
            export type { Branded } from "@guillaume-docquier/tools-ts"
          `,
          diagnostic: "eslint-js(no-restricted-syntax)",
        },
        {
          name: "re-exports of imported types used locally",
          code: `
            import type { Branded } from "@guillaume-docquier/tools-ts"

            export type ExampleId = Branded<"ExampleId", string>
            export type { Branded }
          `,
          diagnostic: "unicorn(prefer-export-from)",
        },
      ])("should reject $name", async ({ code, diagnostic }) => {
        // Arrange
        const fixture = { path, code }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([diagnostic])
      })
    })

    describe("no namespace imports", () => {
      it.each([
        {
          name: "value imports",
          code: `
            import * as tools from "@guillaume-docquier/tools-ts"

            export const result = tools.Result.Success(1)
          `,
        },
        {
          name: "type-only imports",
          code: `
            import type * as fs from "node:fs"

            export type FileDetails = fs.Stats
          `,
        },
      ])("should reject namespace $name", async ({ code }) => {
        // Arrange
        const fixture = { path, code }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual(["import(no-namespace)"])
      })
    })

    describe("no default exports", () => {
      it.each([
        {
          name: "default export declarations",
          code: `
            export default { enabled: true }
          `,
        },
        {
          name: "exports aliased to default",
          code: `
            const settings = { enabled: true }

            export { settings as default }
          `,
        },
      ])("should reject $name", async ({ code }) => {
        // Arrange
        const fixture = { path, code }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual(["import(no-default-export)"])
      })

      it.each([
        ["tool configuration", ".config.ts"],
        ["Storybook story metadata", ".stories.tsx"],
      ])("should allow a default export for %s", async (_reason, suffix) => {
        // Arrange
        const fixture = {
          path: path.replace(/\.ts$/, suffix),
          code: `
            export default { enabled: true }
          `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([])
      })
    })

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

      it.each(["Arrange", "Act", "Assert"])("should reject %s", async (phase) => {
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
        expect(diagnostics).toStrictEqual([allowedComments])
      })

      it("should reject a block comment with an allowed prefix", async () => {
        // Arrange
        const fixture = {
          path,
          code: `
          /* INTENT: Keep the default available before startup. */
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
          // An example of an INTENT: comment.
          export const defaultLimit = 10
        `,
        }

        // Act
        const diagnostics = await session.lint(fixture)

        // Assert
        expect(diagnostics).toStrictEqual([allowedComments])
      })
    })

    it("should reject an unhandled promise returned by a callback", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        export function saveTurn(save: () => Promise<void>): void {
          save()
        }
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual(["typescript(no-floating-promises)"])
    })

    it("should allow a call to a synchronous callback", async () => {
      // Arrange
      const fixture = {
        path,
        code: `
        export function saveTurn(save: () => void): void {
          save()
        }
      `,
      }

      // Act
      const diagnostics = await session.lint(fixture)

      // Assert
      expect(diagnostics).toStrictEqual([])
    })
  })
})
