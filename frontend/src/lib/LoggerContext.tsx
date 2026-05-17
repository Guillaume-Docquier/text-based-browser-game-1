import { createContext, type FC, type PropsWithChildren, useContext } from "react"
import type { Logger } from "@guillaume-docquier/tools-ts"

type LoggerContextInterface = Logger

const LoggerContext = createContext<LoggerContextInterface | undefined>(undefined)

export const useLogger = (): LoggerContextInterface => {
  const context = useContext(LoggerContext)
  if (context === undefined) {
    throw new Error("useLogger must be used within a LoggerProvider")
  }
  return context
}

export const LoggerProvider: FC<PropsWithChildren<{ logger: Logger }>> = ({ logger, children }) => {
  return <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
}
