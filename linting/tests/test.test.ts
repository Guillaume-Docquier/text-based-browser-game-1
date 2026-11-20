import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

const allowedComments = "cosmic-empires(allowed-comments)"

describe.each([
  ["root", "fixture.test.ts"],
  ["backend", "packages/backend/src/fixture.test.ts"],
  ["frontend", "packages/frontend/src/fixture.test.ts"],
  ["frontend TSX", "packages/frontend/src/fixture.test.tsx"],
  ["shared", "packages/shared/src/fixture.test.ts"],
])("test lint rules in %s", (_scope, path) => {
  it.each(["Arrange", "Act", "Assert"])("should allow %s in a test file", (phase) => {
    const diagnostics = lint({
      path,
      code: `
        // ${phase}
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should still allow an INTENT comment in a test file", () => {
    const diagnostics = lint({
      path,
      code: `
        // INTENT: Keep the default available before startup.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should still allow a CONSTRAINT line comment", () => {
    const diagnostics = lint({
      path,
      code: `
        // CONSTRAINT: The protocol reserves the first identifier.
        export const firstId = 2
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should still allow an oxlint disable directive", () => {
    const diagnostics = lint({
      path,
      code: `
        // oxlint-disable-next-line no-debugger
        debugger
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should still allow a TypeScript expect-error directive", () => {
    const diagnostics = lint({
      path,
      code: `
        // @ts-expect-error: Exercise an invalid value.
        export const count: number = "invalid"
      `,
    })

    expect(diagnostics).toStrictEqual([])
  })

  it("should reject an ordinary comment in a test file", () => {
    const diagnostics = lint({
      path,
      code: `
        // Set the default limit.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })

  it("should reject a block comment with a test-only prefix", () => {
    const diagnostics = lint({
      path,
      code: `
        /* Arrange */
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })

  it("should require the test-only prefix at the start of the comment text", () => {
    const diagnostics = lint({
      path,
      code: `
        // This is the Arrange section.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual([allowedComments])
  })
})
