import type { Action, ActionDefinition, Players, PlayerView, SelectedTargets, TargetTag } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { Check, Compass, Crosshair, Landmark, type LucideIcon } from "lucide-react"
import { type ReactElement, useState } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
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
  onSelect: (selectedTargets: SelectedTargets) => void
}): ReactElement {
  const tierStyle = ACTION_TIER_STYLES[actionDefinition.tier]
  const ActionIcon = ACTION_TYPE_ICONS[actionDefinition.type]
  const [draftTargets, setDraftTargets] = useState<NonNullable<SelectedTargets>>({})
  const targetSlots = Object.entries(actionDefinition.targets).map(([tag, targetDefinition]) => ({
    tag: branded<TargetTag>(tag),
    targetDefinition,
    options: getTargetOptions(targetDefinition, playerView, players),
  }))
  const selectedTargets = { ...action.selectedTargets, ...draftTargets }
  for (const { tag, options } of targetSlots) {
    const onlyOption = options.length === 1 ? options[0] : undefined
    if (onlyOption !== undefined) {
      selectedTargets[tag] = onlyOption.id
    }
  }
  const hasAllTargets = targetSlots.every(({ tag, options }) => options.some(({ id }) => id === selectedTargets[tag]))

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
          {effectDefinitionsToRulesText(actionDefinition.effects)}
        </p>
        {targetSlots.map(({ tag, targetDefinition, options }) => (
          <TargetPicker
            key={tag}
            targetTag={tag}
            targetDefinition={targetDefinition}
            options={options}
            value={selectedTargets[tag]}
            disabled={disabled}
            onChange={(targetId) => {
              const nextTargets = { ...selectedTargets, [tag]: targetId }
              setDraftTargets(nextTargets)
              if (isSelected) {
                onSelect(nextTargets)
              }
            }}
          />
        ))}
        <ActionSelectionButton
          isSelected={isSelected}
          disabled={disabled || (!isSelected && !hasAllTargets)}
          onSelect={() => {
            onSelect(selectedTargets)
          }}
          onClear={() => {
            setDraftTargets({})
            onSelect(null)
          }}
        />
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

function ActionSelectionButton({
  isSelected,
  disabled,
  onSelect,
  onClear,
}: {
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
  onClear: () => void
}): ReactElement {
  return (
    <Button
      type="button"
      className={cn("mt-auto", {
        "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus-visible:ring-emerald-400/40": isSelected,
      })}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={isSelected ? onClear : onSelect}
    >
      {isSelected ? (
        <>
          <Check aria-hidden="true" />
          Selected
        </>
      ) : (
        "Select action"
      )}
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
