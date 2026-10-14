import type {
  TargetDefinition,
  ActionInputDefinition,
  Action,
  ActionDefinition,
  InputTag,
  Players,
  PlayerView,
  SelectedInputs,
  SelectedTargets,
  TargetId,
  TargetTag,
} from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import { Compass, Crosshair, Landmark, type LucideIcon } from "lucide-react"
import { type ReactElement, useState } from "react"
import {
  type SelectionEvaluation,
  type EligibilityIssue,
  evaluateActionSelection,
  evaluateTargetCandidate,
  type ActionSelectionDraft,
  type EligibilityState,
} from "shared/action-submission/evaluateActionSelection.ts"
import { FleetColonizeEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import type { Ruleset as SharedRuleset } from "shared/domain/ruleset/Ruleset.ts"
import { SelectedInputsSchema } from "shared/domain/turns/actions/SelectedInputs.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import type { Fleet } from "shared/domain/world/fleets/Fleet.ts"
import { FleetIdSchema } from "shared/domain/world/fleets/FleetId.ts"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { RESOURCE_ICONS, sortCostsByResource } from "@/features/play/components/resourceIcons.ts"
import { getTargetOptions, TargetPicker } from "@/features/play/components/TargetPicker.tsx"
import { formatRulesetTerm, effectDefinitionsToRulesText } from "@/features/play/effectDefinitionToRulesText.ts"
import { cn } from "@/lib/cn.ts"

const ACTION_TIER_STYLES = {
  BASIC: {
    card: "border-slate-100/70 bg-linear-to-b from-slate-100/15 via-card to-card",
    icon: "border-white bg-slate-100 text-slate-900 shadow-white/20",
  },
  STANDARD: {
    card: "border-green-400/70 bg-linear-to-b from-green-500/15 via-card to-card",
    icon: "border-green-200 bg-green-500 text-green-950 shadow-green-500/30",
  },
  IMPROVED: {
    card: "border-blue-400/70 bg-linear-to-b from-blue-500/15 via-card to-card",
    icon: "border-blue-200 bg-blue-500 text-blue-50 shadow-blue-500/30",
  },
  ADVANCED: {
    card: "border-purple-400/70 bg-linear-to-b from-purple-500/15 via-card to-card",
    icon: "border-purple-200 bg-purple-500 text-purple-50 shadow-purple-500/30",
  },
  EXCEPTIONAL: {
    card: "border-orange-400/80 bg-linear-to-b from-orange-500/20 via-card to-card",
    icon: "border-orange-200 bg-orange-500 text-orange-950 shadow-orange-500/30",
  },
} as const satisfies Record<ActionDefinition["tier"], { card: string; icon: string }>

const ACTION_TYPE_ICONS = {
  AGENDA: Compass,
  DIRECTIVE: Crosshair,
  PROGRAM: Landmark,
} as const satisfies Record<ActionDefinition["type"], LucideIcon>

/**
 * Displays a selectable Action Definition using the shared eligibility evaluator.
 */
export function ActionCard({
  actionDefinition,
  action,
  playerView,
  players,
  ruleset,
  eligibilityState,
  disabled,
  onSelect,
}: ActionCardProps): ReactElement {
  const tierStyle = ACTION_TIER_STYLES[actionDefinition.tier]
  const ActionIcon = ACTION_TYPE_ICONS[actionDefinition.type]
  const {
    targetSlots,
    inputSlots,
    selectedTargets,
    selectedInputs,
    evaluation,
    canAfford,
    isSelected,
    sourceFleet,
    fleetStrengthEffect,
    remainingSourceStrength,
    inProgressSummary,
    actionIssues,
    submitSelection,
    setDraftTargets,
    setDraftInputs,
  } = useActionCardSelection({ actionDefinition, action, playerView, players, ruleset, eligibilityState, disabled, onSelect })

  return (
    <Card
      role="group"
      aria-label={`${actionDefinition.name} action`}
      className={cn("relative w-full overflow-visible rounded-2xl border-2 py-0 text-left shadow-lg sm:w-80", tierStyle.card, {
        "opacity-80": disabled,
      })}
    >
      <div
        className={cn("absolute -top-3 -left-4 z-10 grid size-14 place-items-center rounded-xl border-2 shadow-lg", tierStyle.icon)}
        aria-hidden="true"
      >
        <ActionIcon className="size-7" strokeWidth={1.8} />
      </div>
      {action.isInProgress ? null : <UnaffordableOverlay canAfford={canAfford} />}
      <CardHeader className="relative z-10 min-h-24 px-5 py-5 pl-14">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0 space-y-1", { "opacity-45": !canAfford })}>
            <CardTitle className="truncate text-xl font-semibold">{actionDefinition.name}</CardTitle>
            <CardDescription className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
              {formatRulesetTerm(actionDefinition.tier)} {formatRulesetTerm(actionDefinition.type)}
            </CardDescription>
          </div>
          {action.isInProgress ? null : (
            <ActionCosts costs={actionDefinition.costs} resources={playerView.resources} canAfford={canAfford} />
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex min-h-36 flex-1 flex-col gap-4 border-t border-border/70 px-5 py-5">
        <p className={cn("leading-relaxed", canAfford ? "text-card-foreground" : "text-zinc-500")}>
          {effectDefinitionsToRulesText(actionDefinition)}
        </p>
        {action.isInProgress ? (
          <p
            role="status"
            aria-label="Fleet journey"
            className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-100"
          >
            {inProgressSummary}
          </p>
        ) : null}
        <ActionSelectionFields
          actionDefinition={actionDefinition}
          action={action}
          playerView={playerView}
          players={players}
          ruleset={ruleset}
          eligibilityState={eligibilityState}
          disabled={disabled}
          onSelect={onSelect}
          targetSlots={targetSlots}
          inputSlots={inputSlots}
          selectedTargets={selectedTargets}
          selectedInputs={selectedInputs}
          actionIssues={actionIssues}
          setDraftTargets={setDraftTargets}
          setDraftInputs={setDraftInputs}
        />
        {sourceFleet !== undefined && fleetStrengthEffect !== undefined ? (
          <p className="text-xs text-muted-foreground">
            {remainingSourceStrength?.toLocaleString()} of {sourceFleet.strength.toLocaleString()} strength available after this allocation
          </p>
        ) : null}
        {actionIssues.length === 0 ? null : (
          <ul aria-live="polite" className="space-y-1 text-xs text-destructive">
            {actionIssues.map((issue) => (
              <li
                key={`${issue.actionId ?? "global"}-${issue.code}-${issue.targetTag ?? issue.inputTag ?? ""}-${issue.resourceType ?? ""}-${issue.message}`}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {action.isInProgress ? null : (
          <ActionSelectionButton
            isSelected={isSelected}
            disabled={disabled}
            isEligible={evaluation?.status === "ELIGIBLE"}
            onSelect={submitSelection}
            onClear={() => {
              setDraftTargets({})
              setDraftInputs({})
              onSelect(null, null)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function UnaffordableOverlay({ canAfford }: { canAfford: boolean }): ReactElement | null {
  if (canAfford) {
    return null
  }

  return (
    <div
      data-unaffordable-overlay
      className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-[repeating-linear-gradient(135deg,rgba(82,82,91,0.28)_0px,rgba(82,82,91,0.28)_8px,rgba(24,24,27,0.48)_8px,rgba(24,24,27,0.48)_16px)]"
      aria-hidden="true"
    />
  )
}

function getOwnRecordValue<TKey extends string, TValue>(record: Readonly<Record<TKey, TValue>>, key: TKey): TValue | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

function ActionSelectionButton({
  isSelected,
  disabled,
  isEligible,
  onSelect,
  onClear,
}: {
  isSelected: boolean
  disabled: boolean
  isEligible: boolean
  onSelect: () => void
  onClear: () => void
}): ReactElement {
  if (isSelected) {
    return (
      <div className="mt-auto flex gap-2">
        <Button
          type="button"
          className="flex-1 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus-visible:ring-emerald-400/40"
          disabled={disabled || !isEligible}
          onClick={onSelect}
        >
          Update action
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={onClear}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button type="button" className="mt-auto" disabled={disabled || !isEligible} onClick={onSelect}>
      Select action
    </Button>
  )
}

function ActionCosts({
  costs,
  resources,
  canAfford,
}: {
  costs: ActionDefinition["costs"]
  resources: PlayerView["resources"]
  canAfford: boolean
}): ReactElement {
  const costsByResource = Map.groupBy(sortCostsByResource(costs.map((cost) => cost.parameters)), ({ resourceType }) => resourceType)

  return (
    <div className="flex flex-col items-end gap-1" aria-label="Costs">
      {[...costsByResource].map(([resourceType, resourceCosts]) => {
        const quantity = resourceCosts.reduce((total, cost) => total + cost.quantity, 0)
        const cannotAfford = !canAfford && quantity > resources[resourceType].uncommitted
        const ResourceIcon = RESOURCE_ICONS[resourceType]
        return (
          <div
            key={resourceType}
            className={cn("flex items-center gap-1 text-sm font-bold", { "text-red-400": cannotAfford })}
            aria-label={`${quantity} ${formatRulesetTerm(resourceType)}${cannotAfford ? ", cannot afford" : ""}`}
          >
            <span>{quantity}</span>
            <ResourceIcon className={cn("size-4", { "text-amber-300": !cannotAfford })} aria-hidden="true" />
            <span className="sr-only"> {formatRulesetTerm(resourceType)}</span>
          </div>
        )
      })}
    </div>
  )
}

type ActionCardProps = {
  actionDefinition: ActionDefinition
  action: Action
  playerView: PlayerView
  players: Players
  ruleset: SharedRuleset
  eligibilityState: EligibilityState
  disabled: boolean
  onSelect: (selectedTargets: SelectedTargets | null, selectedInputs: SelectedInputs | null) => void
}

function applySingleChoiceDefaults(
  {
    action,
    actionDefinition,
    playerView,
    players,
    ruleset,
    eligibilityState,
  }: Pick<ActionCardProps, "action" | "actionDefinition" | "playerView" | "players" | "ruleset" | "eligibilityState">,
  selectionDraft: ActionSelectionDraft,
): void {
  const selectedTargets: Record<TargetTag, TargetId | undefined> = selectionDraft.selectedTargets
  const targetDefinitions = Object.entries(actionDefinition.targets).map(([tag, targetDefinition]) => ({
    tag: branded<TargetTag>(tag),
    targetDefinition,
  }))
  // Apply single-choice defaults to the same draft used for evaluation and submission.
  for (let pass = 0; !action.isInProgress && pass < targetDefinitions.length; pass += 1) {
    for (const { tag, targetDefinition } of targetDefinitions) {
      if (getOwnRecordValue(selectedTargets, tag) !== undefined) {
        continue
      }
      const options = getTargetOptions({
        targetTag: tag,
        targetDefinition,
        playerView,
        players,
        state: eligibilityState,
        ruleset,
        draft: selectionDraft,
      })
      if (options.length === 1) {
        const onlyOption = options[0]
        if (onlyOption !== undefined) {
          selectedTargets[tag] = onlyOption.id
        }
      }
    }
  }
}

function getJourneySummary(action: Action, eligibilityState: EligibilityState, playerView: PlayerView): string {
  const inProgressFleet = Object.values(eligibilityState.fleets).find(
    (fleet) => fleet.ownerPlayerId === eligibilityState.submittingPlayerId && fleet.movement?.submission.id === action.id,
  )
  const inProgressDestination =
    inProgressFleet?.destinationPlanetId !== undefined
      ? playerView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === inProgressFleet.destinationPlanetId)
      : undefined
  return inProgressFleet === undefined
    ? "Fleet journey in progress"
    : [
        inProgressFleet.name,
        `${inProgressFleet.strength.toLocaleString()} strength`,
        inProgressDestination === undefined ? undefined : `to ${inProgressDestination.name}`,
        inProgressFleet.distanceToEnd === undefined
          ? undefined
          : `${inProgressFleet.distanceToEnd.toLocaleString(undefined, { maximumFractionDigits: 2 })} ly remaining`,
      ]
        .filter((part): part is string => part !== undefined)
        .join(" · ")
}

function getSourceStrength(
  actionDefinition: ActionDefinition,
  selectedTargets: Readonly<Record<TargetTag, TargetId | undefined>>,
  eligibilityState: EligibilityState,
  evaluation: SelectionEvaluation | undefined,
): {
  sourceFleet: Fleet | undefined
  fleetStrengthEffect: FleetMoveEffectDefinition | FleetColonizeEffectDefinition | undefined
  remainingSourceStrength: number | undefined
} {
  const fleetStrengthEffect = actionDefinition.effects.find(
    (effect): effect is FleetMoveEffectDefinition | FleetColonizeEffectDefinition =>
      effect.type === FleetMoveEffectDefinition.type || effect.type === FleetColonizeEffectDefinition.type,
  )
  const sourceFleetTargetId =
    fleetStrengthEffect === undefined ? undefined : getOwnRecordValue(selectedTargets, fleetStrengthEffect.targets.fleet.actionTargetTag)
  const sourceFleetId = sourceFleetTargetId === undefined ? undefined : safeTypedParse(FleetIdSchema, sourceFleetTargetId)
  const sourceFleet = sourceFleetId?.success === true ? eligibilityState.fleets[sourceFleetId.data] : undefined
  const remainingSourceStrength =
    sourceFleet === undefined ? undefined : (evaluation?.remainingStrength[sourceFleet.id] ?? sourceFleet.strength)
  return { sourceFleet, fleetStrengthEffect, remainingSourceStrength }
}

function replaceTarget(
  {
    actionDefinition,
    eligibilityState,
    ruleset,
    action,
  }: Pick<ActionCardProps, "actionDefinition" | "eligibilityState" | "ruleset" | "action">,
  selectedTargets: Record<TargetTag, TargetId | undefined>,
  selectedInputs: Record<InputTag, number | undefined>,
  tag: TargetTag,
  targetId: TargetId | undefined,
): Record<TargetTag, TargetId | undefined> {
  const nextTargets: Record<TargetTag, TargetId | undefined> = { ...selectedTargets, [tag]: targetId }
  for (const otherTag of Object.keys(actionDefinition.targets).map((value) => branded<TargetTag>(value))) {
    if (otherTag === tag) {
      continue
    }
    const otherTargetId = getOwnRecordValue(nextTargets, otherTag)
    if (otherTargetId === undefined) {
      continue
    }
    const candidateEvaluation = evaluateTargetCandidate({
      state: eligibilityState,
      ruleset,
      draft: { actionId: action.id, selectedTargets: nextTargets, selectedInputs },
      targetTag: otherTag,
      targetId: otherTargetId,
    })
    if (candidateEvaluation.candidateStatus === "INELIGIBLE") {
      nextTargets[otherTag] = undefined
    }
  }
  return nextTargets
}

function ActionSelectionFields({
  actionDefinition,
  action,
  ruleset,
  eligibilityState,
  disabled,
  targetSlots,
  inputSlots,
  selectedTargets,
  selectedInputs,
  actionIssues,
  setDraftTargets,
  setDraftInputs,
}: ActionCardProps & {
  targetSlots: TargetSlot[]
  inputSlots: InputSlot[]
  selectedTargets: Record<TargetTag, TargetId | undefined>
  selectedInputs: Record<InputTag, number | undefined>
  actionIssues: readonly EligibilityIssue[]
  setDraftTargets: (targets: Record<TargetTag, TargetId | undefined>) => void
  setDraftInputs: (inputs: Record<InputTag, number | undefined>) => void
}): ReactElement {
  return (
    <>
      {targetSlots.map(({ tag, targetDefinition, options }) => {
        const issue = actionIssues.find(({ targetTag }) => targetTag === tag)
        return (
          <TargetPicker
            key={tag}
            targetTag={tag}
            targetDefinition={targetDefinition}
            options={options}
            value={getOwnRecordValue(selectedTargets, tag)}
            disabled={disabled}
            issue={issue?.message}
            onChange={(targetId) => {
              const nextTargets = replaceTarget(
                { actionDefinition, eligibilityState, ruleset, action },
                selectedTargets,
                selectedInputs,
                tag,
                targetId,
              )
              setDraftTargets(nextTargets)
            }}
          />
        )
      })}
      <ActionInputFields
        inputSlots={inputSlots}
        selectedInputs={selectedInputs}
        actionIssues={actionIssues}
        setDraftInputs={setDraftInputs}
        disabled={disabled}
      />
    </>
  )
}
type TargetSlot = { tag: TargetTag; targetDefinition: TargetDefinition; options: ReturnType<typeof getTargetOptions> }
type InputSlot = { tag: InputTag; inputDefinition: ActionInputDefinition }

function useActionCardSelection({
  actionDefinition,
  action,
  playerView,
  players,
  ruleset,
  eligibilityState,
  onSelect,
}: ActionCardProps): ActionCardSelection {
  const [draftTargets, setDraftTargets] = useState<Record<TargetTag, TargetId | undefined>>({})
  const [draftInputs, setDraftInputs] = useState<Record<InputTag, number | undefined>>({})
  const selectedTargets: Record<TargetTag, TargetId | undefined> = action.isInProgress ? {} : { ...action.selectedTargets, ...draftTargets }
  const selectedInputs: Record<InputTag, number | undefined> = action.isInProgress ? {} : { ...action.selectedInputs, ...draftInputs }
  const selectionDraft: ActionSelectionDraft = { actionId: action.id, selectedTargets, selectedInputs }
  const targetDefinitions = Object.entries(actionDefinition.targets).map(([tag, targetDefinition]) => ({
    tag: branded<TargetTag>(tag),
    targetDefinition,
  }))

  applySingleChoiceDefaults({ action, actionDefinition, playerView, players, ruleset, eligibilityState }, selectionDraft)
  const evaluation = action.isInProgress ? undefined : evaluateActionSelection({ state: eligibilityState, ruleset, draft: selectionDraft })
  const canAfford = evaluation === undefined || !evaluation.issues.some(({ code }) => code === "INSUFFICIENT_RESOURCES")
  const isSelected = !action.isInProgress && action.selectedTargets !== null
  const targetSlots = action.isInProgress
    ? []
    : targetDefinitions.map(({ tag, targetDefinition }) => ({
        tag,
        targetDefinition,
        options: getTargetOptions({
          targetTag: tag,
          targetDefinition,
          playerView,
          players,
          state: eligibilityState,
          ruleset,
          draft: selectionDraft,
        }),
      }))
  const inputSlots = action.isInProgress
    ? []
    : Object.entries(actionDefinition.inputs).map(([tag, inputDefinition]) => ({
        tag: branded<InputTag>(tag),
        inputDefinition,
      }))

  const { sourceFleet, fleetStrengthEffect, remainingSourceStrength } = getSourceStrength(
    actionDefinition,
    selectedTargets,
    eligibilityState,
    evaluation,
  )
  const actionIssues = evaluation?.issues.filter((issue) => issue.actionId === action.id || issue.actionId === undefined) ?? []
  const inProgressSummary = getJourneySummary(action, eligibilityState, playerView)

  function submitSelection(): void {
    const targetEntries = Object.entries(selectedTargets).filter((entry): entry is [string, TargetId] => entry[1] !== undefined)
    const inputEntries = Object.entries(selectedInputs).filter((entry): entry is [string, number] => entry[1] !== undefined)
    const parsedTargets = safeTypedParse(SelectedTargetsSchema, Object.fromEntries(targetEntries))
    const parsedInputs = safeTypedParse(SelectedInputsSchema, Object.fromEntries(inputEntries))
    if (evaluation?.status === "ELIGIBLE" && parsedTargets.success && parsedInputs.success) {
      onSelect(parsedTargets.data, parsedInputs.data)
    }
  }

  return {
    targetSlots,
    inputSlots,
    selectedTargets,
    selectedInputs,
    evaluation,
    canAfford,
    isSelected,
    sourceFleet,
    fleetStrengthEffect,
    remainingSourceStrength,
    inProgressSummary,
    actionIssues,
    submitSelection,
    setDraftTargets,
    setDraftInputs,
  }
}

type ActionCardSelection = {
  targetSlots: TargetSlot[]
  inputSlots: InputSlot[]
  selectedTargets: Record<TargetTag, TargetId | undefined>
  selectedInputs: Record<InputTag, number | undefined>
  evaluation: SelectionEvaluation | undefined
  canAfford: boolean
  isSelected: boolean
  sourceFleet: Fleet | undefined
  fleetStrengthEffect: FleetMoveEffectDefinition | FleetColonizeEffectDefinition | undefined
  remainingSourceStrength: number | undefined
  inProgressSummary: string
  actionIssues: readonly EligibilityIssue[]
  submitSelection: () => void
  setDraftTargets: React.Dispatch<React.SetStateAction<Record<TargetTag, TargetId | undefined>>>
  setDraftInputs: React.Dispatch<React.SetStateAction<Record<InputTag, number | undefined>>>
}

function ActionInputFields({
  inputSlots,
  selectedInputs,
  actionIssues,
  setDraftInputs,
  disabled,
}: Pick<ActionCardSelection, "inputSlots" | "selectedInputs" | "actionIssues"> & {
  disabled: boolean
  setDraftInputs: (inputs: Record<InputTag, number | undefined>) => void
}): ReactElement {
  return (
    <>
      {" "}
      {inputSlots.map(({ tag, inputDefinition }) => {
        const issue = actionIssues.find(({ inputTag }) => inputTag === tag)
        return (
          <label key={tag} className="flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
            {inputDefinition.label}
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              aria-label={inputDefinition.label}
              aria-invalid={issue !== undefined}
              disabled={disabled}
              value={getOwnRecordValue(selectedInputs, tag) ?? ""}
              onChange={(event) => {
                const rawValue = event.currentTarget.value
                setDraftInputs({ ...selectedInputs, [tag]: rawValue === "" ? undefined : Number(rawValue) })
              }}
            />
            {issue === undefined ? null : (
              <span role="alert" className="text-xs text-destructive">
                {issue.message}
              </span>
            )}
          </label>
        )
      })}
    </>
  )
}
