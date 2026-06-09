import type { GameSummaryStatus } from "@api-types"
import type { ReactElement } from "react"
import { Badge } from "../../../components/badge.tsx"
import { formatGameSummaryStatus } from "../../../lib/formatGameSummaryStatus.ts"

export function GameStatusBadge({ status }: { status: GameSummaryStatus }): ReactElement {
  if (status === "READY_TO_START") {
    return <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">{formatGameSummaryStatus(status)}</Badge>
  }

  if (status === "STARTED") {
    return <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">{formatGameSummaryStatus(status)}</Badge>
  }

  if (status === "ENDED") {
    return <Badge className="border-slate-400/30 bg-slate-500/15 text-slate-200">{formatGameSummaryStatus(status)}</Badge>
  }

  return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">{formatGameSummaryStatus(status)}</Badge>
}
