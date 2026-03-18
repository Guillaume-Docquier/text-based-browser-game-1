import { createContext, type FC, type PropsWithChildren, useContext } from "react"
import type { BackendApiClient } from "../api/BackendApiClient.ts"

type BackendApiClientContextInterface = BackendApiClient

const BackendApiClientContext = createContext<BackendApiClientContextInterface | undefined>(undefined)

export const useBackendApiClient = (): BackendApiClientContextInterface => {
  const context = useContext(BackendApiClientContext)
  if (context === undefined) {
    throw new Error("useBackendApiClientContext must be used within a BackendApiClientProvider")
  }
  return context
}

export const BackendApiClientProvider: FC<PropsWithChildren<{ backendApiClient: BackendApiClient }>> = ({ backendApiClient, children }) => {
  return <BackendApiClientContext.Provider value={backendApiClient}>{children}</BackendApiClientContext.Provider>
}
