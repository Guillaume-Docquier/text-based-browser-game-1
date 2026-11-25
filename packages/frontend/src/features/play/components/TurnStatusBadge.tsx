import type { ReactElement } from "react"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { Badge } from "@/components/badge.tsx"
import { formatTurnStatus } from "@/lib/formatTurnStatus.ts"

export function TurnStatusBadge({ status }: { status: TurnStatus }): ReactElement {
  const turnStatus = formatTurnStatus(status)
  switch (status) {
    case TurnStatus.COLLECTING_ACTIONS:
      return <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">{turnStatus}</Badge>
    case TurnStatus.AWAITING_PROCESSING:
      return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">{turnStatus}</Badge>
    case TurnStatus.PROCESSING:
      return <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-100">{turnStatus}</Badge>
    case TurnStatus.COMPLETED:
      return <Badge className="border-slate-400/30 bg-slate-500/15 text-slate-200">{turnStatus}</Badge>
  }
}
