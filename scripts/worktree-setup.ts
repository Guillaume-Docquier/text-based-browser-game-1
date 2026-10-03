import child_process from "node:child_process"
import fs from "node:fs"
import path from "node:path"

console.log("\nSetting up this worktree\n")

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
// We take the first line and the path after the space
const mainCheckoutPath = child_process
  .execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" })
  .split("\n")[0]
  .split(" ")[1]

try {
  console.log(`🔧 Copying .env from ${mainCheckoutPath} into this worktree`)
  fs.copyFileSync(path.join(mainCheckoutPath, ".env"), ".env")
  console.log("✅ .env copied")
} catch (e) {
  console.log("❌ No .env file in the main checkout")
  throw e
}

console.log("\nUpdating ports\n")
// get and increment the worktree counter, no need to lock
const index = 1
const basePort = 10000 + (index % 3800) * 10
// check that the 3 ports are not in use
// if in use, get and increment again

console.log(`Base port for this worktree: ${basePort}`)
try {
  console.log("🔧Updating .env")
  // db:
  // POSTGRES_PORT
  // COMPOSE_PROJECT_NAME
  //
  // backend:
  // PORT
  // DATABASE_URL (depends on db.POSTGRES_PORT)
  //
  // frontend:
  // VITE_DEV_PORT
  // VITE_BACKEND_HOST (depends on backend.PORT)
  console.log("✅ .env updated")
} catch (e) {
  console.log("❌ Could not update .env")
  throw e
}
