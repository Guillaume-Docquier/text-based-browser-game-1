import { stripVTControlCharacters, styleText } from "node:util"
import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { select } from "@inquirer/prompts"
import { createSeededRng } from "#lib/createSeededRng.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

const SOLO_PLAYER_ID = "solo-player"
const UI_WIDTH = 72
const PANEL_CONTENT_WIDTH = UI_WIDTH - 4
const TURN_SEPARATOR = "\n" + "━".repeat(UI_WIDTH) + "\n"

const UiStyle = {
  accent: (text: string): string => styleText(["bold", "cyan"], text),
  action: (text: string): string => styleText(["bold", "magenta"], text),
  danger: (text: string): string => styleText(["bold", "red"], text),
  history: (text: string): string => styleText("dim", text),
  muted: (text: string): string => styleText("gray", text),
  positive: (text: string): string => styleText(["bold", "green"], text),
  resource: (text: string): string => styleText(["bold", "yellow"], text),
  warning: (text: string): string => styleText(["bold", "yellow"], text),
}

/** A command selected from the interactive solo-game prompt. */
export type SoloGameSelection =
  | { readonly command: "ADD_ACTION"; readonly actionDefinitionId: string }
  | { readonly command: "REMOVE_ACTION"; readonly actionSubmissionId: string }
  | { readonly command: "SUBMIT_TURN" }
  | { readonly command: "QUIT" }

type SoloGameChoice = {
  readonly name: string
  readonly description?: string
  readonly value: SoloGameSelection
}

type SoloGamePromptOptions = {
  readonly message: string
  readonly choices: readonly SoloGameChoice[]
  readonly default: SoloGameSelection
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
 * Runs a complete in-memory solo game against StandardRuleset.
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
  let highlightedChoiceIndex = 0
  let turnResolutionError: TurnResolutionError | undefined

  writeLine("")
  writeLine(UiStyle.accent(`✦  COSMIC EMPIRES  ·  ${StandardRuleset.name.toUpperCase()} PLAYTEST  ✦`))
  writeLine(UiStyle.muted("Interactive in-memory rules-engine session"))
  writeLine("")

  while (session.state.winnerPlayerId === undefined) {
    const choices = createChoices(session)
    const highlightedChoice = choices[Math.min(highlightedChoiceIndex, choices.length - 1)]
    Assert.isDefined(highlightedChoice)
    const selection = await prompt({
      message: formatTurnDashboard(session, "open", turnResolutionError).join("\n"),
      choices,
      default: highlightedChoice.value,
    })
    const selectedChoiceIndex = choices.findIndex((choice) => getSelectionKey(choice.value) === getSelectionKey(selection))
    Assert.isTrue(selectedChoiceIndex >= 0)
    highlightedChoiceIndex = selectedChoiceIndex

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
        const submittedTurn = structuredClone(session)
        const result = resolveTurn(session.state, StandardRuleset, rng)
        if (Result.isFailure(result)) {
          turnResolutionError = result.error
          break
        }

        submittedTurn.state.winnerPlayerId = session.state.winnerPlayerId
        writeResolvedTurn(submittedTurn, writeLine)
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

async function promptWithInquirer({ message, choices, default: defaultSelection }: SoloGamePromptOptions): Promise<SoloGameSelection> {
  return await select(
    {
      message,
      choices,
      default: defaultSelection,
      loop: false,
      pageSize: 12,
      theme: {
        prefix: "",
        icon: {
          cursor: UiStyle.accent("❯"),
        },
        style: {
          description: UiStyle.muted,
          message: (text: string) => text,
        },
      },
    },
    {
      clearPromptOnDone: true,
    },
  )
}

function getSelectionKey(selection: SoloGameSelection): string {
  switch (selection.command) {
    case "ADD_ACTION":
      return `${selection.command}:${selection.actionDefinitionId}`
    case "REMOVE_ACTION":
      return `${selection.command}:${selection.actionSubmissionId}`
    case "SUBMIT_TURN":
    case "QUIT":
      return selection.command
    default:
      Assert.isExhausted(selection)
      return ""
  }
}

function createChoices(session: SoloGameSession): SoloGameChoice[] {
  const player = getSoloPlayer(session)
  const addActionChoices = Object.values(StandardRuleset.actionDefinitions).map((actionDefinition) => ({
    name: UiStyle.positive(`+ ${actionDefinition.name}`),
    description: formatActionDescription(actionDefinition),
    value: {
      command: "ADD_ACTION" as const,
      actionDefinitionId: actionDefinition.id,
    },
  }))
  const actionCounts = new Map<string, number>()
  const removeActionChoices = player.actionSubmissions.map((actionSubmission) => {
    const actionDefinition = StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)
    const actionCount = (actionCounts.get(actionDefinition.id) ?? 0) + 1
    actionCounts.set(actionDefinition.id, actionCount)

    return {
      name: UiStyle.warning(`− #${actionCount} ${actionDefinition.name}`),
      value: {
        command: "REMOVE_ACTION" as const,
        actionSubmissionId: actionSubmission.id,
      },
    }
  })

  return [
    {
      name: UiStyle.accent(`▶ Resolve Turn ${session.turn}`),
      description: `${player.actionSubmissions.length} selected ${player.actionSubmissions.length === 1 ? "action" : "actions"} will be submitted to the rules engine`,
      value: { command: "SUBMIT_TURN" },
    },
    ...addActionChoices,
    ...removeActionChoices,
    {
      name: UiStyle.muted("× Exit playtest"),
      description: "End this in-memory session without a winner",
      value: { command: "QUIT" },
    },
  ]
}

function addAction(session: SoloGameSession, actionDefinitionId: string, actionSubmissionNumber: number): void {
  const player = getSoloPlayer(session)
  const actionDefinition = StandardRuleset.actionDefinitions[actionDefinitionId]
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

function formatTurnDashboard(session: SoloGameSession, status: "open" | "resolved", turnResolutionError?: TurnResolutionError): string[] {
  const player = getSoloPlayer(session)
  const isOpen = status === "open"
  const statusBadge = isOpen ? UiStyle.warning("● OPEN") : UiStyle.positive("✓ RESOLVED")
  const lines = [
    ...createPanel(
      isOpen ? "CURRENT TURN" : "RESOLVED TURN",
      [alignSides(UiStyle.accent(`TURN ${session.turn.toString().padStart(2, "0")}`), statusBadge), UiStyle.muted(StandardRuleset.name)],
      isOpen ? "cyan" : "green",
    ),
    "",
  ]

  const resourceLines: string[] = []
  for (const [resourceType, quantity] of Object.entries(player.resources)) {
    resourceLines.push(alignSides(UiStyle.muted(resourceType), UiStyle.resource(`${quantity} available`)))
  }
  lines.push(...createPanel("EMPIRE STATE", resourceLines, "blue"), "")

  const actionLines: string[] = []
  if (player.actionSubmissions.length === 0) {
    actionLines.push(UiStyle.muted("No orders selected"))
  } else {
    for (const [index, actionSubmission] of player.actionSubmissions.entries()) {
      const actionDefinition = StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]
      Assert.isDefined(actionDefinition)
      const orderNumber = (index + 1).toString().padStart(2, "0")
      actionLines.push(`${UiStyle.action(orderNumber)}  ${styleText("bold", actionDefinition.name)}`)
    }
  }
  const actionPanelTitle = `${isOpen ? "SELECTED ACTIONS" : "SUBMITTED ACTIONS"}  ·  ${player.actionSubmissions.length}`
  lines.push(...createPanel(actionPanelTitle, actionLines, "magenta"))

  if (session.state.winnerPlayerId !== undefined) {
    lines.push("", ...createPanel("VICTORY", [UiStyle.positive(`★ ${session.state.winnerPlayerId} won the game`)], "green"))
  }

  if (turnResolutionError !== undefined) {
    lines.push("", ...formatTurnResolutionFailure(turnResolutionError))
  }

  if (isOpen) {
    lines.push(
      "",
      ...createPanel(
        "COMMAND",
        [
          styleText("bold", "Choose what your empire does next."),
          UiStyle.muted("Select actions, revise the selection, or resolve the turn."),
        ],
        "yellow",
      ),
    )
  }

  return lines
}

function formatTurnResolutionFailure(error: TurnResolutionError): string[] {
  // oxlint-disable-next-line eslint/no-underscore-dangle -- _tag is the rules engine's existing error discriminant
  switch (error._tag) {
    case "INVALID_SUBMISSIONS":
      return createPanel(
        "TURN REJECTED",
        [
          UiStyle.danger("✕ The rules engine refused these actions."),
          UiStyle.muted("Revise the selected actions, then resolve the turn again."),
          "",
          ...error.issues.flatMap((issue) => [
            styleText("bold", issue.actionDefinitionName ?? issue.actionDefinitionId),
            `  ${UiStyle.danger(issue.issue)}`,
          ]),
        ],
        "red",
      )
    case "FAILED_TO_RESOLVE_EFFECT":
      return createPanel(
        "TURN REJECTED",
        [UiStyle.danger("✕ An Effect failed during resolution."), UiStyle.muted("The turn state was not advanced.")],
        "red",
      )
    default:
      Assert.isExhausted(error)
      return []
  }
}

function writeResolvedTurn(session: SoloGameSession, writeLine: (line: string) => void): void {
  for (const line of formatTurnDashboard(session, "resolved")) {
    writeLine(UiStyle.history(line))
  }

  if (session.state.winnerPlayerId === undefined) {
    writeLine(UiStyle.muted(TURN_SEPARATOR))
  }
}

function formatActionDescription(actionDefinition: ActionDefinition): string {
  return `${actionDefinition.tier} ${actionDefinition.type}  ·  ${formatActionSummary(actionDefinition)}`
}

function formatActionSummary(actionDefinition: ActionDefinition): string {
  const costs = actionDefinition.costs.map((cost) => `${cost.quantity} ${cost.resourceType}`)
  const effects = actionDefinition.mechanics.map(formatMechanic)
  const formattedCosts = costs.length === 0 ? "no cost" : `costs ${costs.join(", ")}`

  return `${formattedCosts}  ·  ${effects.join(", ")}`
}

function formatMechanic(mechanic: Mechanic): string {
  switch (mechanic.type) {
    case "RESOURCE_LOSS":
      return `pays ${mechanic.quantity} ${mechanic.resourceType}`
    case "RESOURCE_GAIN":
      return `gains ${mechanic.quantity} ${mechanic.resourceType}`
    case "VICTORY":
      return "wins the game"
    default:
      Assert.isExhausted(mechanic)
      return ""
  }
}

type PanelTone = "blue" | "cyan" | "green" | "magenta" | "red" | "yellow"

function createPanel(title: string, lines: readonly string[], tone: PanelTone): string[] {
  const titleLabel = ` ${title} `
  const topRightBorderWidth = UI_WIDTH - titleLabel.length - 3
  Assert.isTrue(topRightBorderWidth >= 0)

  return [
    `${stylePanelBorder("╭─", tone)}${stylePanelTitle(titleLabel, tone)}${stylePanelBorder(`${"─".repeat(topRightBorderWidth)}╮`, tone)}`,
    ...lines.map((line) => `${stylePanelBorder("│", tone)} ${fitPanelLine(line)} ${stylePanelBorder("│", tone)}`),
    stylePanelBorder(`╰${"─".repeat(UI_WIDTH - 2)}╯`, tone),
  ]
}

function fitPanelLine(line: string): string {
  const visibleLine = stripVTControlCharacters(line)
  if (visibleLine.length > PANEL_CONTENT_WIDTH) {
    return `${visibleLine.slice(0, PANEL_CONTENT_WIDTH - 1)}…`
  }

  return `${line}${" ".repeat(PANEL_CONTENT_WIDTH - visibleLine.length)}`
}

function alignSides(left: string, right: string): string {
  const spacing = PANEL_CONTENT_WIDTH - stripVTControlCharacters(left).length - stripVTControlCharacters(right).length
  if (spacing <= 0) {
    return `${left} ${right}`
  }

  return `${left}${" ".repeat(spacing)}${right}`
}

function stylePanelBorder(text: string, tone: PanelTone): string {
  return styleText(tone, text)
}

function stylePanelTitle(text: string, tone: PanelTone): string {
  return styleText(["bold", tone], text)
}
