import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const playwrightDirectory = dirname(fileURLToPath(import.meta.url))

export const aliceAuthFilePath = resolve(playwrightDirectory, ".clerk/alice.json")
export const bobAuthFilePath = resolve(playwrightDirectory, ".clerk/bob.json")
export const charlieAuthFilePath = resolve(playwrightDirectory, ".clerk/charlie.json")

/**
 * Use when you need an authenticated user.
 *
 * @example
 * ```ts
 * test.describe("authenticated user", () => {
 *   test.use(aliceUser)
 *
 *   test("edits profile", () => {
 *     // authenticated as Alice
 *   })
 * })
 * ```
 */
export const aliceUser = {
  storageState: aliceAuthFilePath,
}
