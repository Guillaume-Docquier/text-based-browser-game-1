import { useQueryClient } from "@tanstack/react-query"
import { unlessProtected } from "@/lib/api/queryInvalidation.ts"

export function useRefreshClientData(): () => Promise<void> {
  const queryClient = useQueryClient()

  return async () => {
    await queryClient.invalidateQueries({ predicate: unlessProtected })
  }
}
