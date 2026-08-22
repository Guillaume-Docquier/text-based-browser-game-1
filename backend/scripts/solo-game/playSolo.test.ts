import { stripVTControlCharacters } from "node:util"
import { Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"
import { playSolo, type SoloGameSelection } from "./playSolo.ts"

describe("playSolo", () => {
  it("should collect actions and resolve turns until the player wins", async () => {
    // Arrange
    const selections: SoloGameSelection[] = [
      { command: "ADD_ACTION", actionDefinitionId: WinTheGame.id },
      { command: "SUBMIT_TURN" },
      { command: "REMOVE_ACTION", actionSubmissionId: "turn-1-WIN_THE_GAME-1" },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainMetal.id },
      { command: "ADD_ACTION", actionDefinitionId: GainMetal.id },
      { command: "ADD_ACTION", actionDefinitionId: GainMetal.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainInfluence.id },
      { command: "ADD_ACTION", actionDefinitionId: GainFuel.id },
      { command: "ADD_ACTION", actionDefinitionId: GainFuel.id },
      { command: "ADD_ACTION", actionDefinitionId: GainFuel.id },
      { command: "ADD_ACTION", actionDefinitionId: GainEnergy.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: GainEnergy.id },
      { command: "SUBMIT_TURN" },
      { command: "ADD_ACTION", actionDefinitionId: WinTheGame.id },
      { command: "SUBMIT_TURN" },
    ]
    const output: string[] = []
    const promptMessages: string[] = []
    const promptChoices: Array<Array<{ readonly name: string; readonly description: string | undefined }>> = []
    const promptPositions: Array<{ readonly defaultIndex: number; readonly selectedIndex: number }> = []
    const terminalEvents: Array<{ readonly type: "output" | "prompt"; readonly value: string }> = []

    // Act
    const session = await playSolo({
      prompt: async ({ message, choices, default: defaultSelection }) => {
        promptMessages.push(message)
        promptChoices.push(
          choices.map((choice) => ({
            name: stripVTControlCharacters(choice.name),
            description: choice.description,
          })),
        )
        terminalEvents.push({ type: "prompt", value: stripVTControlCharacters(message) })
        const selection = selections.shift()
        Assert.isDefined(selection)
        promptPositions.push({
          defaultIndex: choices.findIndex((choice) => choice.value === defaultSelection),
          selectedIndex: choices.findIndex((choice) => JSON.stringify(choice.value) === JSON.stringify(selection)),
        })
        return selection
      },
      writeLine: (line) => {
        output.push(line)
        terminalEvents.push({ type: "output", value: stripVTControlCharacters(line) })
      },
    })

    // Assert
    const plainPromptMessages = promptMessages.map(stripVTControlCharacters)
    const plainOutput = output.map(stripVTControlCharacters)
    expect(session).toEqual({
      turn: 4,
      state: {
        actionSubmissions: [],
        players: {
          "solo-player": {
            id: "solo-player",
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 8,
              [ResourceType.METAL]: 6,
              [ResourceType.FUEL]: 9,
              [ResourceType.ENERGY]: 5,
            }),
          },
        },
        winnerPlayerId: "solo-player",
      },
    })
    expect(selections).toEqual([])
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("TURN REJECTED"))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining(`Missing 7 ${ResourceType.INFLUENCE}`))
    expect(plainPromptMessages).toContainEqual(expect.stringContaining("SELECTED ACTIONS  ·  2"))
    expect(plainPromptMessages.every((message) => message.includes("CURRENT TURN"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes(StandardRuleset.name))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("EMPIRE STATE"))).toBe(true)
    expect(plainPromptMessages.every((message) => message.includes("COMMAND"))).toBe(true)
    expect(promptChoices.flat()).toContainEqual({
      name: `+ ${GainInfluence.name}`,
      description: `${ActionTier.BASIC} ${ActionType.AGENDA}  ·  no cost  ·  gains 5 INFLUENCE`,
    })
    expect(promptChoices.flat()).toContainEqual({
      name: `− #1 ${GainInfluence.name}`,
      description: undefined,
    })
    expect(promptChoices.flat().every((choice) => !choice.name.includes("Queue") && !choice.name.includes("Remove"))).toBe(true)
    expect(promptPositions.slice(0, 2)).toEqual([
      { defaultIndex: 0, selectedIndex: 2 },
      { defaultIndex: 2, selectedIndex: 0 },
    ])
    expect(plainOutput.filter((line) => line.trim() === "━".repeat(72))).toHaveLength(3)
    expect(plainOutput.filter((line) => line.includes("RESOLVED TURN"))).toHaveLength(4)
    expect(plainOutput).toContainEqual(expect.stringContaining("STANDARD RULESET PLAYTEST"))
    expect(plainOutput).not.toContainEqual(expect.stringContaining("CURRENT TURN"))
    const firstResolvedTurnIndex = plainOutput.findIndex((line) => line.includes("RESOLVED TURN"))
    const firstResolvedTurnSeparatorIndex = plainOutput.findIndex(
      (line, index) => index > firstResolvedTurnIndex && line.trim() === "━".repeat(72),
    )
    const firstResolvedTurnOutput = plainOutput.slice(firstResolvedTurnIndex, firstResolvedTurnSeparatorIndex).join("\n")
    expect(firstResolvedTurnOutput).toContain("SUBMITTED ACTIONS  ·  6")
    expect(firstResolvedTurnOutput).toContain(`01  ${GainInfluence.name}`)
    expect(firstResolvedTurnOutput).toContain('✓ Player "solo-player" spent')
    expect(firstResolvedTurnOutput).toContain('✓ Player "solo-player" gained')
    expect(plainOutput.at(-1)).toBe("You won on turn 4.")
    const firstSeparatorIndex = terminalEvents.findIndex((event) => event.type === "output" && event.value.trim() === "━".repeat(72))
    expect(terminalEvents[firstSeparatorIndex + 1]).toMatchObject({
      type: "prompt",
      value: expect.stringContaining("TURN 02"),
    })
  })
})
