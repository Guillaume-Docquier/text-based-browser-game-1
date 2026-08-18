import { Command } from "commander"
import { createPlayCommand } from "./command-play.ts"

const program = new Command().name("solo-game").description("Play Cosmic Empires solo using the in-memory rules engine.")

program.addCommand(createPlayCommand())

await program.parseAsync()
