import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function devHttps({ isCI }: { isCI: boolean }): { cert: string; key: string } {
  const directory = new URL("./.dev-tls/", import.meta.url)
  const cert = fileURLToPath(new URL(isCI ? "ci-localhost.pem" : "localhost.pem", directory))
  const key = fileURLToPath(new URL(isCI ? "ci-localhost-key.pem" : "localhost-key.pem", directory))

  if (isCI) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-noenc",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost",
        "-out",
        cert,
        "-keyout",
        key,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    )
  } else if (!existsSync(cert) || !existsSync(key)) {
    throw new Error("Run pnpm dev:cert at the workspace root to generate the localhost certificate.")
  }

  return { cert, key }
}
