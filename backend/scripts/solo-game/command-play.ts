import { Command } from "commander"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"
import { playSolo } from "./playSolo.ts"

/** Creates the interactive command for playing the in-memory solo game. */
export function createPlayCommand(): Command {
  return new Command("play").description(`Play solo in memory.`).action(async () => {
    await playSolo({ ruleset: StandardRuleset }) // Eventually should be parameterized so we can playtest with different rulesets
  })
}
