import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SignInPage } from "../features/auth/SignInPage.tsx"
import type { ReactElement } from "react"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/_site/sign-in")({
  component: SignInRoute,
  validateSearch: RedirectSchema,
})

function SignInRoute(): ReactElement {
  const { redirect } = Route.useSearch()
  return <SignInPage redirect={redirect} />
}
