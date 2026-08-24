import type { ReactElement } from "react"

export type Filter<TItem> = {
  readonly element: ReactElement | null
  readonly predicate: ((item: TItem) => boolean) | undefined
}
