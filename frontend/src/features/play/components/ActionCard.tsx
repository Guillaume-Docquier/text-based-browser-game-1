import type { ActionDefinition, PlayerView } from "@api-types"
import { Compass, Crosshair, Landmark, type LucideIcon } from "lucide-react"
import type { ReactElement } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { RESOURCE_ICONS, sortResources } from "@/features/play/components/resourceIcons.ts"
import { formatRulesetTerm, mechanicsToRulesText } from "@/features/play/mechanicToRulesText.ts"
import { cn } from "@/lib/cn.ts"

const ACTION_TIER_STYLES = {
  BASIC: {
    card: "border-zinc-500/70 bg-linear-to-b from-zinc-500/15 via-card to-card",
    icon: "border-zinc-300 bg-zinc-600 text-zinc-50 shadow-zinc-950/40",
    selected: "from-zinc-500/35 shadow-[0_0_36px_-8px_rgba(113,113,122,0.8)]",
  },
  STANDARD: {
    card: "border-slate-100/70 bg-linear-to-b from-slate-100/15 via-card to-card",
    icon: "border-white bg-slate-100 text-slate-900 shadow-white/20",
    selected: "from-slate-100/30 shadow-[0_0_36px_-8px_rgba(241,245,249,0.75)]",
  },
  IMPROVED: {
    card: "border-sky-400/70 bg-linear-to-b from-sky-500/15 via-card to-card",
    icon: "border-sky-200 bg-sky-500 text-sky-950 shadow-sky-500/30",
    selected: "from-sky-500/35 shadow-[0_0_36px_-8px_rgba(14,165,233,0.8)]",
  },
  ADVANCED: {
    card: "border-yellow-400/70 bg-linear-to-b from-yellow-400/15 via-card to-card",
    icon: "border-yellow-200 bg-yellow-400 text-yellow-950 shadow-yellow-400/30",
    selected: "from-yellow-400/35 shadow-[0_0_36px_-8px_rgba(250,204,21,0.8)]",
  },
  EXCEPTIONAL: {
    card: "border-orange-400/80 bg-linear-to-b from-orange-500/20 via-card to-card",
    icon: "border-orange-200 bg-orange-500 text-orange-950 shadow-orange-500/30",
    selected: "from-orange-500/40 shadow-[0_0_36px_-8px_rgba(249,115,22,0.85)]",
  },
} as const satisfies Record<ActionDefinition["tier"], { card: string; icon: string; selected: string }>

const ACTION_TYPE_ICONS = {
  AGENDA: Compass,
  DIRECTIVE: Crosshair,
  PROGRAM: Landmark,
} as const satisfies Record<ActionDefinition["type"], LucideIcon>

/**
 * Displays a selectable Action Definition using its tier, costs, and mechanics.
 */
export function ActionCard({
  actionDefinition,
  uncommittedResources,
  canAfford,
  isSelected,
  disabled,
  onSelect,
}: {
  actionDefinition: ActionDefinition
  uncommittedResources: PlayerView["uncommittedResources"]
  canAfford: boolean
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
}): ReactElement {
  const tierStyle = ACTION_TIER_STYLES[actionDefinition.tier]
  const ActionIcon = ACTION_TYPE_ICONS[actionDefinition.type]

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      className={cn(
        "relative w-full overflow-visible rounded-2xl border-2 py-0 text-left shadow-lg transition-[transform,box-shadow,opacity] sm:w-80",
        tierStyle.card,
        {
          [tierStyle.selected]: isSelected,
          "cursor-pointer hover:-translate-y-0.5": !disabled,
          "hover:shadow-xl": !disabled && !isSelected,
          "cursor-not-allowed opacity-80": disabled,
        },
      )}
      onClick={() => {
        if (!disabled) {
          onSelect()
        }
      }}
      onKeyDown={(event) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) {
          return
        }

        event.preventDefault()
        onSelect()
      }}
    >
      <div
        className={cn("absolute -top-3 -left-4 z-10 grid size-14 place-items-center rounded-xl border-2 shadow-lg", tierStyle.icon)}
        aria-hidden="true"
      >
        <ActionIcon className="size-7" strokeWidth={1.8} />
      </div>
      {!canAfford ? (
        <div
          data-unaffordable-overlay
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-[repeating-linear-gradient(135deg,rgba(82,82,91,0.28)_0px,rgba(82,82,91,0.28)_8px,rgba(24,24,27,0.48)_8px,rgba(24,24,27,0.48)_16px)]"
          aria-hidden="true"
        />
      ) : null}
      <CardHeader className="relative z-10 min-h-24 px-5 py-5 pl-14">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0 space-y-1", { "opacity-45": !canAfford })}>
            <CardTitle className="truncate text-xl font-semibold">{actionDefinition.name}</CardTitle>
            <CardDescription className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
              {formatRulesetTerm(actionDefinition.tier)} {formatRulesetTerm(actionDefinition.type)}
            </CardDescription>
          </div>
          <ActionCosts costs={actionDefinition.costs} uncommittedResources={uncommittedResources} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex min-h-36 flex-1 flex-col gap-4 border-t border-border/70 px-5 py-5">
        <p className={cn("leading-relaxed", canAfford ? "text-card-foreground" : "text-zinc-500")}>
          {mechanicsToRulesText(actionDefinition.mechanics)}
        </p>
      </CardContent>
    </Card>
  )
}

function ActionCosts({
  costs,
  uncommittedResources,
}: {
  costs: ActionDefinition["costs"]
  uncommittedResources: PlayerView["uncommittedResources"]
}): ReactElement {
  const costsByResource = Map.groupBy(sortResources(costs), ({ resourceType }) => resourceType)

  return (
    <div className="flex flex-col items-end gap-1" aria-label="Costs">
      {[...costsByResource].map(([resourceType, resourceCosts]) => {
        const quantity = resourceCosts.reduce((total, cost) => total + cost.quantity, 0)
        const cannotAfford = quantity > uncommittedResources[resourceType]
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
