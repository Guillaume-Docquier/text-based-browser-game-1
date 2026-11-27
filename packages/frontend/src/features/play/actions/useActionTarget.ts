import type { GameId } from "shared/domain/games/GameId.ts"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"

export function useActionTarget(): { gameId: GameId; turn: number } {
  const { playerView } = usePlayGameContext()
  return {
    gameId: playerView.gameId,
    turn: playerView.turn,
  }
}
