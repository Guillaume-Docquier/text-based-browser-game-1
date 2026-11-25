import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const tlsDirectory = new URL("../packages/frontend/.dev-tls/", import.meta.url)
mkdirSync(tlsDirectory, { recursive: true })
execFileSync(
  "mkcert",
  [
    "-install",
    "-cert-file",
    fileURLToPath(new URL("localhost.pem", tlsDirectory)),
    "-key-file",
    fileURLToPath(new URL("localhost-key.pem", tlsDirectory)),
    "localhost",
  ],
  { stdio: "inherit" },
)
