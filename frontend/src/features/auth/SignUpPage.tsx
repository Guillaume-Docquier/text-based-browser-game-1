import { SignUp } from "@clerk/react"
import type { ReactElement } from "react"
import { AuthPageShell } from "./components/AuthPageShell.tsx"

export function SignUpPage({ redirect }: { redirect: string }): ReactElement {
  return (
    <AuthPageShell
      title="Start your empire"
      description="Create your account to join a lobby, claim a faction, and start competing for long-term control of the galaxy."
    >
      <SignUp signInUrl={`/sign-in?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
    </AuthPageShell>
  )
}
