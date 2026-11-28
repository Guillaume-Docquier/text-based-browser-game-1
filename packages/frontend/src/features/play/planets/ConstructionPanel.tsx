import type { PlayerView } from "@api-types"
import { useState, type ReactElement } from "react"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { type constructionProblem, TRADE_CENTER_COST, type ConstructionOrder } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { Button } from "@/components/button.tsx"
import { formatCredits } from "@/lib/formatCredits.ts"

export type ConstructionPlanning = {
  playerId: PlayerView["player"]["id"]
  turn: number
  available: string
  orders: PlayerView["constructionOrders"]
  open: boolean
  pending: boolean
  error: string | undefined
  submit: (site: number) => void
  cancel: (id: ConstructionOrder["id"]) => void
}

export function ConstructionPanel({
  plan,
  order,
  site,
  problem,
}: {
  plan: ConstructionPlanning
  order: ConstructionOrder | undefined
  site: number
  problem: ReturnType<typeof constructionProblem>
}): ReactElement {
  const [choosing, setChoosing] = useState(false)
  const available = plan.available
  const disabled = !plan.open || plan.pending
  return (
    <section aria-label="Command center construction" className="space-y-3 border-t border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading font-semibold">Command center construction</h3>
        <span className="text-sm tabular-nums">{formatCredits(available)} credits available</span>
      </div>
      {order === undefined ? (
        <>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            Building to construct
            <select
              value={choosing ? BuildingType.TRADE_CENTER : ""}
              disabled={disabled}
              className="rounded border border-border bg-background px-2 py-1.5"
              onChange={(event) => {
                setChoosing(event.target.value === BuildingType.TRADE_CENTER)
              }}
            >
              <option value="">Choose a building</option>
              <option value={BuildingType.TRADE_CENTER}>Trade center · {TRADE_CENTER_COST} credits</option>
            </select>
          </label>
          {choosing && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {problem !== "SITE_UNAVAILABLE"
                  ? `Trade center on Hex ${site + 1} · ${TRADE_CENTER_COST} credits`
                  : "Select an empty surface hex."}
              </span>
              {problem === "INSUFFICIENT_CREDITS" && <span>Insufficient available credits.</span>}
              <Button
                size="sm"
                disabled={disabled || problem !== undefined}
                onClick={() => {
                  plan.submit(site)
                }}
              >
                Submit construction
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <strong>Planned trade center</strong> · Hex {order.site + 1} · {order.cost} credits reserved
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              plan.cancel(order.id)
            }}
          >
            Cancel construction
          </Button>
        </div>
      )}
      {!plan.open && <p className="text-sm text-muted-foreground">Planning closed</p>}
      {plan.error !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {plan.error}
        </p>
      )}
    </section>
  )
}
