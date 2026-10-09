import type { GameId } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useStartGameMutation() {
  const backendApiClient = useBackendApiClient()
  const navigate = useNavigate()

  return useMutation(
    backendApiClient.games.startGame.mutationOptions({
      onSuccess: async (_, { gameId }) => {
        await navigate({ to: "/games/$gameId/play", params: { gameId: branded<GameId>(gameId) } })
      },
    }),
  )
}
