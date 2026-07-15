import { useQueryClient } from "@tanstack/react-query"

export function useRefreshClientData(): () => Promise<void> {
  const queryClient = useQueryClient()

  return async (): Promise<void> => {
    await queryClient.invalidateQueries()
  }
}
