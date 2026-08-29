import path from "node:path"
import { fileURLToPath } from "node:url"

const playwrightDirectory = path.dirname(fileURLToPath(import.meta.url))

export const users = {
  alice: {
    email: "e2e-alice+clerk_test@example.com",
    authFilePath: path.resolve(playwrightDirectory, ".clerk/alice.json"),
  },
  bob: {
    email: "e2e-bob+clerk_test@example.com",
    authFilePath: path.resolve(playwrightDirectory, ".clerk/bob.json"),
  },
  // Charlie exists, but until we need to use a 3rd user, it's better not to have it
  // We pay a setup tax for each user
  // charlie: {
  //   email: "e2e-charlie+clerk_test@example.com",
  //   authFilePath: resolve(playwrightDirectory, ".clerk/charlie.json"),
  // },
}

/**
 * Use when you need an authenticated user for a whole suite.
 * Use the alice and bob fixtures when you need multiple users.
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
  storageState: users.alice.authFilePath,
}
