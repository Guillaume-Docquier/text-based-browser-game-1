import type { LobbyStatus } from "@api-types"
import type { ReactElement } from "react"
import { Badge } from "@/components/badge.tsx"
import { formatLobbyStatus } from "@/lib/formatLobbyStatus.ts"

export function GameStatusBadge({ status }: { status: LobbyStatus }): ReactElement {
  const formattedLobbyStatus = formatLobbyStatus(status)
  switch (status) {
    case "WAITING_FOR_PLAYERS":
      return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">{formattedLobbyStatus}</Badge>
    case "READY_TO_START":
      return <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">{formattedLobbyStatus}</Badge>
    case "COLLECTING_ACTIONS":
      return <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">{formattedLobbyStatus}</Badge>
    case "AWAITING_PROCESSING":
    case "PROCESSING_TURN":
      return <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-100">{formattedLobbyStatus}</Badge>
    case "ENDED":
      return <Badge className="border-slate-400/30 bg-slate-500/15 text-slate-200">{formattedLobbyStatus}</Badge>
  }
}
