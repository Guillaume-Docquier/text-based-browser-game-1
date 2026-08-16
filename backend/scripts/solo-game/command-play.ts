import { Command } from "commander"
import { playSolo } from "./playSolo.ts"

/** Creates the interactive command for playing the in-memory solo game. */
export function createPlayCommand(): Command {
  return new Command("play").description("Play the Standard Ruleset solo in memory.").action(async () => {
    await playSolo()
  })
}
