import { useAuth } from "@clerk/react"
import type { ReactElement, ReactNode } from "react"
import { useOnboarding } from "@/lib/api/useOnboarding.ts"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

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
