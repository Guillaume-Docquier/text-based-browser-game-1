import type { ReactElement, ReactNode } from "react"
import { useOnboarding } from "@/lib/api/useOnboarding.ts"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

export function Onboarding({ children, isSignedIn }: { children: ReactNode; isSignedIn: boolean }): ReactElement {
  const onboarding = useOnboarding({ enabled: isSignedIn })

  if (isSignedIn && onboarding.isOnboarded === false) {
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
