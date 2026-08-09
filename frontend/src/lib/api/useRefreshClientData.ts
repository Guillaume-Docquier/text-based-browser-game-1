import { useQueryClient } from "@tanstack/react-query"

/**
 * Returns a function that invalidates and refetches active client queries.
 *
 * @returns A function that refreshes active client data without reloading the page.
 */
export function useRefreshClientData(): () => Promise<void> {
  const queryClient = useQueryClient()

  return async () => {
    await queryClient.invalidateQueries()
  }
}
