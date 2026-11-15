import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { SignUpPage } from "@/features/auth/SignUpPage.tsx"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/_site/sign-up")({
  component: SignUpRoute,
  validateSearch: RedirectSchema,
})

function SignUpRoute(): ReactElement {
  const { redirect } = Route.useSearch()
  return <SignUpPage redirect={redirect} />
}
