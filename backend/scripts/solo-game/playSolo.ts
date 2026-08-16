import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { select } from "@inquirer/prompts"
import { createSeededRng } from "#lib/createSeededRng.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset/mechanics/Mechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { RulesetV1 } from "#lib/ruleset/v1/RulesetV1.ts"

const SOLO_PLAYER_ID = "solo-player"
const TURN_SEPARATOR = "────────────────────────────────────────"

/** A command selected from the interactive solo-game prompt. */
export type SoloGameSelection =
  | { readonly command: "ADD_ACTION"; readonly actionDefinitionId: string }
  | { readonly command: "REMOVE_ACTION"; readonly actionSubmissionId: string }
  | { readonly command: "SUBMIT_TURN" }
  | { readonly command: "QUIT" }

type SoloGameChoice = {
  readonly name: string
  readonly value: SoloGameSelection
}

type SoloGamePromptOptions = {
  readonly message: string
  readonly choices: readonly SoloGameChoice[]
}

type SoloGameSession = {
  turn: number
  readonly state: TurnState
}

type PlaySoloOptions = {
  readonly prompt?: (options: SoloGamePromptOptions) => Promise<SoloGameSelection>
  readonly rng?: Rng
  readonly writeLine?: (line: string) => void
}

type TurnResolutionError =
  | { readonly _tag: "INVALID_SUBMISSIONS"; readonly issues: ActionSubmissionIssue[] }
  | { readonly _tag: "FAILED_TO_RESOLVE_EFFECT" }

/**
 * Runs a complete in-memory solo game against RulesetV1.
 *
 * @param options - Optional CLI boundaries used to prompt, generate deterministic random values, and render output.
 * @returns The final in-memory session after the player wins or quits.
 */
export async function playSolo({
  prompt = promptWithInquirer,
  rng = createSeededRng(),
  writeLine = (line) => {
    console.log(line)
  },
}: PlaySoloOptions = {}): Promise<SoloGameSession> {
  const session = createSoloGameSession()
  let nextActionSubmissionNumber = 1
  let turnResolutionError: TurnResolutionError | undefined

  writeLine("Cosmic Empires — Solo")

  while (session.state.winnerPlayerId === undefined) {
    const selection = await prompt({
      message: formatTurnState(session, "open", turnResolutionError).join("\n"),
      choices: createChoices(session),
    })

    switch (selection.command) {
      case "ADD_ACTION":
        addAction(session, selection.actionDefinitionId, nextActionSubmissionNumber)
        nextActionSubmissionNumber += 1
        turnResolutionError = undefined
        break
      case "REMOVE_ACTION":
        removeAction(session, selection.actionSubmissionId)
        turnResolutionError = undefined
        break
      case "SUBMIT_TURN": {
        const result = resolveTurn(session.state, RulesetV1, rng)
        if (Result.isFailure(result)) {
          turnResolutionError = result.error
          break
        }

        writeResolvedTurn(session, writeLine)
        getSoloPlayer(session).actionSubmissions.length = 0
        turnResolutionError = undefined

        if (session.state.winnerPlayerId === undefined) {
          session.turn += 1
        }
        break
      }
      case "QUIT":
        writeLine("Game ended without a winner.")
        return session
      default:
        Assert.isExhausted(selection)
    }
  }

  writeLine(`You won on turn ${session.turn}.`)
  return session
}

function createSoloGameSession(): SoloGameSession {
  return {
    turn: 1,
    state: {
      players: {
        [SOLO_PLAYER_ID]: {
          id: SOLO_PLAYER_ID,
          resources: {
            [ResourceType.MONEY]: 2,
          },
          actionSubmissions: [],
        },
      },
      winnerPlayerId: undefined,
    },
  }
}

async function promptWithInquirer({ message, choices }: SoloGamePromptOptions): Promise<SoloGameSelection> {
  return await select(
    {
      message,
      choices,
      loop: false,
    },
    {
      clearPromptOnDone: true,
    },
  )
}

function createChoices(session: SoloGameSession): SoloGameChoice[] {
  const player = getSoloPlayer(session)
  const addActionChoices = Object.values(RulesetV1.actionDefinitions).map((actionDefinition) => ({
    name: `Add: ${formatActionDefinition(actionDefinition)}`,
    value: {
      command: "ADD_ACTION" as const,
      actionDefinitionId: actionDefinition.id,
    },
  }))
  const actionCounts = new Map<string, number>()
  const removeActionChoices = player.actionSubmissions.map((actionSubmission) => {
    const actionDefinition = RulesetV1.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)
    const actionCount = (actionCounts.get(actionDefinition.id) ?? 0) + 1
    actionCounts.set(actionDefinition.id, actionCount)

    return {
      name: `Remove: ${actionDefinition.name} #${actionCount}`,
      value: {
        command: "REMOVE_ACTION" as const,
        actionSubmissionId: actionSubmission.id,
      },
    }
  })

  return [
    ...addActionChoices,
    ...removeActionChoices,
    {
      name: `Submit turn (${player.actionSubmissions.length} selected)`,
      value: { command: "SUBMIT_TURN" },
    },
    {
      name: "Quit",
      value: { command: "QUIT" },
    },
  ]
}

function addAction(session: SoloGameSession, actionDefinitionId: string, actionSubmissionNumber: number): void {
  const player = getSoloPlayer(session)
  const actionDefinition = RulesetV1.actionDefinitions[actionDefinitionId]
  Assert.isDefined(actionDefinition)

  player.actionSubmissions.push({
    id: `turn-${session.turn}-${actionDefinition.id}-${actionSubmissionNumber}`,
    actionDefinitionId: actionDefinition.id,
    targets: {
      self: player.id,
    },
  })
}

function removeAction(session: SoloGameSession, actionSubmissionId: string): void {
  const actionSubmissions = getSoloPlayer(session).actionSubmissions
  const actionSubmissionIndex = actionSubmissions.findIndex((actionSubmission) => actionSubmission.id === actionSubmissionId)
  Assert.isTrue(actionSubmissionIndex >= 0)

  actionSubmissions.splice(actionSubmissionIndex, 1)
}

function getSoloPlayer(session: SoloGameSession): TurnState["players"][string] {
  const player = session.state.players[SOLO_PLAYER_ID]
  Assert.isDefined(player)
  return player
}

function formatTurnState(session: SoloGameSession, status: "open" | "resolved", turnResolutionError?: TurnResolutionError): string[] {
  const player = getSoloPlayer(session)
  const lines = [`Turn ${session.turn} — ${status}`, "Resources:"]

  for (const [resourceType, quantity] of Object.entries(player.resources)) {
    lines.push(`  ${resourceType}: ${quantity}`)
  }

  lines.push(status === "open" ? "Selected actions:" : "Submitted actions:")
  if (player.actionSubmissions.length === 0) {
    lines.push("  None")
  } else {
    for (const [index, actionSubmission] of player.actionSubmissions.entries()) {
      const actionDefinition = RulesetV1.actionDefinitions[actionSubmission.actionDefinitionId]
      Assert.isDefined(actionDefinition)
      lines.push(`  ${index + 1}. ${actionDefinition.name}`)
    }
  }

  if (session.state.winnerPlayerId !== undefined) {
    lines.push(`Winner: ${session.state.winnerPlayerId}`)
  }

  if (turnResolutionError !== undefined) {
    lines.push("", ...formatTurnResolutionFailure(turnResolutionError))
  }

  return lines
}

function formatTurnResolutionFailure(error: TurnResolutionError): string[] {
  // oxlint-disable-next-line eslint/no-underscore-dangle -- _tag is the rules engine's existing error discriminant
  switch (error._tag) {
    case "INVALID_SUBMISSIONS":
      return [
        "Turn was not resolved:",
        ...error.issues.map((issue) => `  ${issue.actionDefinitionName ?? issue.actionDefinitionId}: ${issue.issue}`),
      ]
    case "FAILED_TO_RESOLVE_EFFECT":
      return ["Turn was not resolved because an Effect failed."]
    default:
      Assert.isExhausted(error)
      return []
  }
}

function writeResolvedTurn(session: SoloGameSession, writeLine: (line: string) => void): void {
  writeLine(TURN_SEPARATOR)
  for (const line of formatTurnState(session, "resolved")) {
    writeLine(line)
  }
}

function formatActionDefinition(actionDefinition: ActionDefinition): string {
  const costs = actionDefinition.costs.map((cost) => `${cost.quantity} ${cost.resourceType}`)
  const effects = actionDefinition.mechanics.map(formatMechanic)

  return `${actionDefinition.name} [${actionDefinition.tier} ${actionDefinition.type}] — costs ${costs.join(", ")}; ${effects.join(", ")}`
}

function formatMechanic(mechanic: Mechanic): string {
  switch (mechanic.type) {
    case "COST":
      return `pays ${mechanic.quantity} ${mechanic.resourceType}`
    case "INCOME":
      return `gains ${mechanic.quantity} ${mechanic.resourceType}`
    case "VICTORY":
      return "wins the game"
    default:
      Assert.isExhausted(mechanic)
      return ""
  }
}
