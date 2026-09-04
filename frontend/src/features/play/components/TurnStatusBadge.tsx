import type { PlayerView } from "@api-types"
import type { ReactElement } from "react"
import { Badge } from "@/components/badge.tsx"
import { formatTurnStatus } from "@/lib/formatTurnStatus.ts"

export function TurnStatusBadge({ status }: { status: PlayerView["turnStatus"] }): ReactElement {
  if (status === "COLLECTING_ACTIONS") {
    return <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">{formatTurnStatus(status)}</Badge>
  }

  if (status === "AWAITING_PROCESSING") {
    return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">{formatTurnStatus(status)}</Badge>
  }

  if (status === "PROCESSING") {
    return <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-100">{formatTurnStatus(status)}</Badge>
  }

  return <Badge className="border-slate-400/30 bg-slate-500/15 text-slate-200">{formatTurnStatus(status)}</Badge>
}
