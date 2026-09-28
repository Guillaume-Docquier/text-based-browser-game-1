import { useAuth } from "@clerk/react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { type FormEvent, type ReactElement, type ReactNode, useState } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardHeader } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Label } from "@/components/label.tsx"
import { useOnboarding } from "@/lib/api/useOnboarding.ts"

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

function OnboardingDialog({
  finishOnboarding,
  isFinishingOnboarding,
  finishOnboardingError,
  resetFinishOnboardingError,
}: {
  finishOnboarding: ({ alias }: { alias: string }) => void
  isFinishingOnboarding: boolean
  finishOnboardingError: { message: string } | null
  resetFinishOnboardingError: () => void
}): ReactElement {
  const [alias, setAlias] = useState("")

  const submitOnboarding = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    finishOnboarding({ alias })
  }

  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2"
          onEscapeKeyDown={(event) => {
            event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault()
          }}
        >
          <Card className="border border-border/60 shadow-lg">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <DialogPrimitive.Title asChild>
                <h1 className="font-heading text-2xl font-semibold">Welcome, commander</h1>
              </DialogPrimitive.Title>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submitOnboarding}>
                <div className="space-y-2">
                  <Label htmlFor="alias">Choose your alias</Label>
                  <Input
                    id="alias"
                    autoComplete="nickname"
                    autoFocus
                    maxLength={36}
                    value={alias}
                    aria-describedby="alias-requirements"
                    aria-invalid={finishOnboardingError !== null}
                    onChange={(event) => {
                      resetFinishOnboardingError()
                      setAlias(event.target.value)
                    }}
                  />
                  <p id="alias-requirements" className="text-sm text-muted-foreground">
                    Must be 1–36 characters
                  </p>
                </div>

                {finishOnboardingError === null ? null : (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {finishOnboardingError.message}
                  </p>
                )}

                <Button type="submit" disabled={alias.trim() === "" || isFinishingOnboarding}>
                  {isFinishingOnboarding ? "Saving..." : "Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
