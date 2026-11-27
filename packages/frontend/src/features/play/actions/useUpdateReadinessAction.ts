import { useUpdateReadiness } from "@/lib/api/useUpdateReadiness.ts"
import { useActionTarget } from "./useActionTarget.ts"

export function useUpdateReadinessAction(): {
  submit: (data: { isReady: boolean }) => void
  isPending: boolean
  error: { message: string } | null
} {
  const target = useActionTarget()
  const { mutate, isPending, error } = useUpdateReadiness()

  return {
    submit: ({ isReady }) => {
      mutate({ ...target, isReady })
    },
    isPending,
    error,
  }
}
