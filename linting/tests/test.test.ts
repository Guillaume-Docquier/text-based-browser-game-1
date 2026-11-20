import { describe, expect, it } from "vitest"
import { lint } from "./lint.ts"

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

  it("should reject an ordinary comment in a test file", () => {
    const diagnostics = lint({
      path,
      code: `
        // Set the default limit.
        export const defaultLimit = 10
      `,
    })

    expect(diagnostics).toStrictEqual(["cosmic-empires(allowed-comments)"])
  })
})
