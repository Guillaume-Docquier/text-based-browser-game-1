import { useAuth } from "@clerk/react"
import type { ReactElement, ReactNode } from "react"
import { useOnboarding } from "@/lib/api/useOnboarding.ts"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

/**
 * The onboarding only shows when the user is signed in and confirmed to not have been onboarded.
 * This is intentionally nonintrusive to avoid screen flickers when users are already onboarded.
 */
export function Onboarding({ children }: { children: ReactNode }): ReactElement {
  const auth = useAuth()
  const onboarding = useOnboarding({ enabled: auth.isSignedIn === true })

  if (auth.isSignedIn === true && onboarding.isOnboarded === false) {
    return (
      <>
        {children}
        <OnboardingDialog
          finishOnboarding={onboarding.finishOnboarding}
          isFinishingOnboarding={onboarding.isFinishingOnboarding}
          finishOnboardingError={onboarding.finishOnboardingError}
          resetFinishOnboardingError={onboarding.resetFinishOnboardingError}
        />
      </>
    )
  }

  return <>{children}</>
}
