import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useBackendApiClient } from "./BackendApiClientContext.tsx"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC and TanStack Query inference do the work
export function useCreateGameMutation() {
  const backendApiClient = useBackendApiClient()
  const navigate = useNavigate()

  return useMutation({
    ...backendApiClient.lobbies.create.mutationOptions(),
    onSuccess: async ({ createdGameId }) => {
      await navigate({ to: "/games/$gameId", params: { gameId: createdGameId } })
    },
  })
}
