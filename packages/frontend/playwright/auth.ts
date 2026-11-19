import path from "node:path"
import { fileURLToPath } from "node:url"

const playwrightDirectory = path.dirname(fileURLToPath(import.meta.url))

export type User = (typeof users)[keyof typeof users]
export const users = {
  alice: {
    alias: "alice",
    email: "e2e-alice+clerk_test@example.com",
    authFilePath: path.resolve(playwrightDirectory, ".clerk/alice.json"),
  },
  bob: {
    alias: "bob",
    email: "e2e-bob+clerk_test@example.com",
    authFilePath: path.resolve(playwrightDirectory, ".clerk/bob.json"),
  },
  // CONSTRAINT: "e2e-charlie+clerk_test@example.com" exists, but until we need to use a 3rd user, it's better not to have it because we pay a setup tax for each user.
}
