import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const playwrightDirectory = dirname(fileURLToPath(import.meta.url))

export const authFilePath = resolve(playwrightDirectory, ".clerk/user.json")

/**
 * Use when you need an authenticated user.
 *
 * @example
 * ```ts
 * test.describe("authenticated user", () => {
 *   test.use(authenticatedUser)
 *
 *   test("edits profile", () => {
 *     // user will be authenticated
 *   })
 * })
 * ```
 */
export const authenticatedUser = {
  storageState: authFilePath,
}
