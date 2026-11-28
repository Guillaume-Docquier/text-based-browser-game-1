import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { GameId } from "shared/domain/games/GameId.ts"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query infer the mutation contract.
export function useMoveShip(gameId: GameId) {
  const api = useBackendApiClient()
  const client = useQueryClient()
  return useMutation(
    api.gameplay.moveShip.mutationOptions({
      onSettled: async () => {
        await client.refetchQueries({ queryKey: api.gameplay.getPlayerView.queryKey({ gameId }), exact: true })
      },
    }),
  )
}
