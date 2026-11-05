import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { type FormEvent, type ReactElement, useState } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardHeader } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Label } from "@/components/label.tsx"

/**
 * Collects the required alias before the account can use the application.
 */
export function OnboardingDialog({
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
    <DialogPrimitive.Root
      open
      modal
      disablePointerDismissal
      onOpenChange={(_open, details) => {
        details.cancel()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2">
          <Card className="border border-border/60 shadow-lg">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <DialogPrimitive.Title render={<h1 />} className="font-heading text-2xl font-semibold">
                Welcome, commander
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
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
