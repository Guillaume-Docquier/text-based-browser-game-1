import child_process from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parseEnv } from "node:util"

type AssignedPorts = {
  WORKTREE_COUNTER: number
  DATABASE: number
  BACKEND: number
  FRONTEND: number
}

const DOT_ENV = ".env"
const FIRST_PORT = 10000
const PORTS_NEEDED = 3
const BLOCK_COUNT = Math.floor((49152 - FIRST_PORT) / PORTS_NEEDED)
const WORKTREE_COUNTER_MAX = 1000

;(function main(): void {
  console.log("\nSetting up this worktree\n")
  const mainCheckoutPath = copyEnv()

  console.log("\nAssigning dedicated ports\n")
  const ports = getWorktreePorts(mainCheckoutPath)
  updateEnv(ports)
})()

/**
 * Copy the main checkout's .env file into this worktree
 */
function copyEnv(): string {
  // Example output for "git worktree list --porcelain"
  //
  // worktree C:/Users/Guillaume/Dev/text-based-browser-game-1
  // HEAD 33e0f082a0a4912b6785dc9ac31dd77ce782f06b
  // branch refs/heads/codex/worktree-isolation
  //
  // worktree C:/Users/Guillaume/.codex/worktrees/storybook-agent-evaluation/text-based-browser-game-1
  // HEAD 2425f7b228e0d6aec5606852af5c72751163f5c6
  // branch refs/heads/codex/storybook-agent-workflows
  //
  // worktree C:/Users/Guillaume/Dev/text-based-browser-game-1-temp
  // HEAD fe619416cb75f50a9cc133dffa43861798ad365b
  // branch refs/heads/temp
  //
  // The first entry is always the main checkout
  const mainCheckoutPath = child_process
    .execFileSync("git", ["worktree", "list", "--porcelain", "-z"], { encoding: "utf8" })
    .split("\0")[0]
    .slice("worktree ".length)

  try {
    console.log(`🔧 Copying .env from ${mainCheckoutPath} into this worktree`)
    fs.copyFileSync(path.join(mainCheckoutPath, DOT_ENV), DOT_ENV)
    console.log("✅ .env copied\n")
  } catch (e) {
    console.log("❌ Could not copy .env from the main checkout")
    throw e
  }

  return mainCheckoutPath
}

/**
 * Assign ports for this worktree services based on a looping worktree-counter
 * We hope for the best:
 * - We don't atomically read + increment
 * - We don't validate that the ports are available
 */
function getWorktreePorts(mainCheckoutPath: string): AssignedPorts {
  console.log("🔧 Getting the base port")
  const counterPath = path.join(mainCheckoutPath, ".worktree-counter")
  const counterFileDescriptor = fs.openSync(counterPath, "a+")
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- if empty, set to 0
  const worktreeCounter = Number(fs.readFileSync(counterFileDescriptor, "utf8").trim() || 0)
  fs.writeFileSync(counterPath, `${(worktreeCounter + 1) % WORKTREE_COUNTER_MAX}\n`)

  const basePort = FIRST_PORT + (worktreeCounter % BLOCK_COUNT) * PORTS_NEEDED
  const ports = {
    WORKTREE_COUNTER: worktreeCounter,
    DATABASE: basePort,
    BACKEND: basePort + 1,
    FRONTEND: basePort + 2,
  }
  console.log(`✅ Base port for this worktree: ${basePort}\n`)
  return ports
}

/**
 * Updates this worktree .env with the assigned ports
 */
function updateEnv(ports: AssignedPorts): void {
  try {
    console.log("🔧 Updating .env")
    let envFileContents = fs.readFileSync(DOT_ENV, "utf8")
    const env = parseEnv(envFileContents)

    const updates = {
      POSTGRES_PORT: ports.DATABASE.toString(),
      COMPOSE_PROJECT_NAME: `cosmic-empires-worktree-${ports.WORKTREE_COUNTER}`,
      PORT: ports.BACKEND.toString(),
      DATABASE_URL: createUrlString(env, "DATABASE_URL", ports.DATABASE),
      VITE_DEV_PORT: ports.FRONTEND.toString(),
      VITE_BACKEND_HOST: createUrlString(env, "VITE_BACKEND_HOST", ports.BACKEND),
      AUTO_CLEANUP: "true",
      RESTART_POLICY: "no",
    }
    console.log(JSON.stringify(updates, null, 2))

    for (const [name, value] of Object.entries(updates)) {
      envFileContents = updateEnvField(name, value, envFileContents)
    }

    fs.writeFileSync(DOT_ENV, envFileContents)
    console.log("✅ .env updated\n")
  } catch (e) {
    console.log("❌ Could not update .env")
    throw e
  }
}

/**
 * Updates a .env content (as a string) with a new or existing key=value pair
 */
function updateEnvField(name: string, value: string, envFileContents: string): string {
  const assignment = new RegExp(`^([\\t ]*(?:export[\\t ]+)?${name}[\\t ]*=)[^\\r\\n]*`, "gm")
  const quotedValue = JSON.stringify(value)

  if (assignment.test(envFileContents)) {
    return envFileContents.replace(assignment, (_match, prefix: string) => `${prefix}${quotedValue}`)
  } else {
    const newline = envFileContents.includes("\r\n") ? "\r\n" : "\n"
    const separator = envFileContents.length > 0 && !envFileContents.endsWith("\n") ? newline : ""
    return envFileContents + `${separator}${name}=${quotedValue}${newline}`
  }
}

function createUrlString(env: NodeJS.Dict<string>, name: string, port: number): string {
  try {
    const url = new URL(env[name] ?? "")
    url.port = port.toString()
    return url.toString()
  } catch {
    throw new Error(`The copied .env must contain a valid ${name}`)
  }
}
