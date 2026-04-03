import type { ReactElement } from "react"
import { useLogger } from "../contexts/LoggerContext.tsx"

export function ErrorMessage({ error }: { error: string }): ReactElement {
  const logger = useLogger()
  logger.error(error)

  return <div>{error}</div>
}
