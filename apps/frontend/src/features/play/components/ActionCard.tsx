import type { Action, ActionDefinition, Players, PlayerView, SelectedTargets, SelectedInputs, TargetId, TargetTag } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { safeTypedParse } from "@guillaume-docquier/tools-ts/schemas"
import { Check, Compass, Crosshair, Landmark, type LucideIcon } from "lucide-react"
import { type ReactElement, useState } from "react"
import { evaluateActionSelection, computeActionCommitments } from "shared/action-submission/actionEligibility.ts"
import { SelectedInputsSchema } from "shared/domain/turns/actions/SelectedInputs.ts"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { toActionEligibilityState } from "@/features/play/actionEligibilityState.ts"
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
 * Displays a selectable Action Definition using its tier, costs, and effects.
 */
export function ActionCard({
  actionDefinition,
  action,
  playerView,
  players,
  resources,
  canAfford,
  isSelected,
  disabled,
  onSelect,
}: {
  actionDefinition: ActionDefinition
  action: Action
  playerView: PlayerView
  players: Players
  resources: PlayerView["resources"]
  canAfford: boolean
  isSelected: boolean
  disabled: boolean
  onSelect: (selectedTargets: SelectedTargets, selectedInputs: SelectedInputs) => void
}): ReactElement {
  const tierStyle = ACTION_TIER_STYLES[actionDefinition.tier]
  const ActionIcon = ACTION_TYPE_ICONS[actionDefinition.type]
  const serverKey = JSON.stringify([playerView.turn, action.id, action.selectedTargets, action.selectedInputs])
  const [draft, setDraft] = useState<{
    serverKey: string
    targets: NonNullable<SelectedTargets>
    inputs: Record<string, number | undefined>
  }>({ serverKey, targets: action.selectedTargets ?? {}, inputs: action.selectedInputs ?? {} })
  const currentDraft: typeof draft =
    draft.serverKey === serverKey ? draft : { serverKey, targets: action.selectedTargets ?? {}, inputs: action.selectedInputs ?? {} }
  if (draft.serverKey !== serverKey) setDraft(currentDraft)
  const selectedTargets: Record<TargetTag, TargetId> = { ...currentDraft.targets }
  const selectedInputs: Record<string, number | undefined> = { ...currentDraft.inputs }
  const state = toActionEligibilityState(playerView)
  const identity = { ...action, playerId: playerView.player.id }
  const selection = { selectedTargets, selectedInputs }
  const targetSlots = Object.entries(actionDefinition.targets).map(([tag, targetDefinition]) => {
    const targetTag = branded<TargetTag>(tag)
    const options = getTargetOptions(targetDefinition, playerView, players, action, targetTag, selection, state)
    if (
      !targetDefinition.constraints.some((constraint) => constraint.type === "WITHIN_FLEET_RANGE") &&
      selectedTargets[targetTag] === undefined &&
      options.length === 1 &&
      options[0] !== undefined
    )
      selectedTargets[targetTag] = options[0].id
    return { tag: targetTag, targetDefinition, options }
  })
  const evaluation = evaluateActionSelection({ state, ruleset: playerView.ruleset, action: identity, selection, mode: "draft" })
  const others = state.submittedActions.filter((other) => other.id !== action.id || other.playerId !== playerView.player.id)
  const commitments = computeActionCommitments({ ruleset: playerView.ruleset, actions: others })
  const inProgress = action.status === "IN_PROGRESS"
  const changed =
    JSON.stringify(selection) !==
    JSON.stringify({ selectedTargets: action.selectedTargets ?? {}, selectedInputs: action.selectedInputs ?? {} })
  const submit = (): void => {
    const parsed = safeTypedParse(
      SelectedInputsSchema,
      Object.fromEntries(Object.entries(selectedInputs).flatMap(([tag, value]) => (value === undefined ? [] : [[tag, value]]))),
    )
    if (evaluation.eligible && parsed.success) onSelect(selectedTargets, parsed.data)
  }

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
      <UnaffordableOverlay canAfford={canAfford} />
      <CardHeader className="relative z-10 min-h-24 px-5 py-5 pl-14">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0 space-y-1", { "opacity-45": !canAfford })}>
            <CardTitle className="truncate text-xl font-semibold">{actionDefinition.name}</CardTitle>
            <CardDescription className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
              {formatRulesetTerm(actionDefinition.tier)} {formatRulesetTerm(actionDefinition.type)}
            </CardDescription>
          </div>
          <ActionCosts costs={actionDefinition.costs} resources={resources} canAfford={canAfford} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex min-h-36 flex-1 flex-col gap-4 border-t border-border/70 px-5 py-5">
        <p className={cn("leading-relaxed", canAfford ? "text-card-foreground" : "text-zinc-500")}>
          {effectDefinitionsToRulesText(actionDefinition.effects)}{" "}
          {Object.values(actionDefinition.targets)
            .flatMap((slot) => slot.constraints)
            .filter((constraint) => constraint.type === "WITHIN_FLEET_RANGE")
            .map((constraint) => `Range ${constraint.maximumDistance} light years.`)
            .join(" ")}
        </p>
        {targetSlots.map(({ tag, targetDefinition, options }) => (
          <TargetPicker
            key={tag}
            targetTag={tag}
            targetDefinition={targetDefinition}
            options={options}
            value={selectedTargets[tag]}
            disabled={disabled || inProgress}
            onChange={(targetId) => {
              const nextTargets: Record<TargetTag, TargetId> = { ...selectedTargets, [tag]: targetId }
              for (const [dependentTag, slot] of Object.entries(actionDefinition.targets))
                if (slot.constraints.some((constraint) => constraint.type === "WITHIN_FLEET_RANGE" && constraint.fleetTargetTag === tag))
                  Reflect.deleteProperty(nextTargets, dependentTag)
              setDraft({ serverKey, targets: nextTargets, inputs: selectedInputs })
            }}
          />
        ))}
        {Object.entries(actionDefinition.inputs).map(([tag, input]) => {
          const sourceId = selectedTargets[input.fleetTargetTag]
          const source = playerView.fleets.find((fleet) => fleet.id === sourceId)
          const available = source !== undefined ? source.strength - (commitments.strength[source.id] ?? 0) : 0
          return (
            <label key={tag} className="flex flex-col gap-1.5 text-sm">
              {formatRulesetTerm(tag)} (available {available})
              <Input
                aria-label={formatRulesetTerm(tag)}
                type="number"
                min={1}
                max={available}
                step={1}
                value={selectedInputs[tag] ?? ""}
                disabled={disabled || inProgress}
                onChange={(event) => {
                  setDraft({
                    serverKey,
                    targets: selectedTargets,
                    inputs: { ...selectedInputs, [tag]: event.target.value === "" ? undefined : Number(event.target.value) },
                  })
                }}
              />
            </label>
          )
        })}
        {inProgress ? (
          <p>
            In progress: {playerView.fleets.find((fleet) => fleet.id === action.inProgressFleetId)?.name} to{" "}
            {playerView.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === action.destinationPlanetId)?.name}
          </p>
        ) : (
          <>
            {evaluation.issues.map((issue) => (
              <p key={JSON.stringify([issue.path, issue.message])} role="status" className="text-sm text-muted-foreground">
                {issue.message}
              </p>
            ))}
            <Button
              type="button"
              aria-pressed={false}
              aria-disabled={disabled || !evaluation.eligible || (isSelected && !changed)}
              disabled={disabled || !evaluation.eligible || (isSelected && !changed)}
              onClick={submit}
            >
              {isSelected ? "Update action" : "Select action"}
            </Button>
            {isSelected ? (
              <Button
                type="button"
                aria-pressed
                aria-disabled={disabled}
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  onSelect(null, null)
                }}
              >
                <Check aria-hidden="true" />
                Selected
              </Button>
            ) : null}
          </>
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
