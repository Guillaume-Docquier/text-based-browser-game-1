import type { ReactElement } from "react"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { Badge } from "@/components/badge.tsx"
import { formatGameStatus } from "@/lib/formatGameStatus.ts"

export function GameStatusBadge({ status }: { status: GameStatus }): ReactElement {
  const gameStatus = formatGameStatus(status)
  switch (status) {
    case GameStatus.WAITING_FOR_PLAYERS:
      return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">{gameStatus}</Badge>
    case GameStatus.READY_TO_START:
      return <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">{gameStatus}</Badge>
    case GameStatus.IN_PROGRESS:
      return <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">{gameStatus}</Badge>
    case GameStatus.ENDED:
      return <Badge className="border-slate-400/30 bg-slate-500/15 text-slate-200">{gameStatus}</Badge>
  }
}
