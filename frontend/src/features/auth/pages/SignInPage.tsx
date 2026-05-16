import { SignIn } from "@clerk/react"
import type { ReactElement } from "react"
import { AuthPageShell } from "../../../components/app/AuthPageShell.tsx"

export function SignInPage({ redirect }: { redirect: string }): ReactElement {
  return (
    <AuthPageShell
      title="Welcome back"
      description="Sign in to manage your ongoing campaigns, review intel, and jump back into your empire before the next tick lands."
    >
      <SignIn signUpUrl={`/sign-up?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
    </AuthPageShell>
  )
}
