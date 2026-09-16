import { Dialog as DialogPrimitive } from "radix-ui"
import { type FormEvent, type ReactElement, type ReactNode, useState } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardHeader } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Label } from "@/components/label.tsx"
import { useIsOnboardedQuery } from "@/lib/api/useCurrentAccountQuery.ts"
import { useFinishOnboardingMutation } from "@/lib/api/useSetAliasMutation.ts"

export function Onboarding({ userId, children }: { userId: string; children: ReactNode }): ReactElement {
  const accountQuery = useIsOnboardedQuery(userId)

  return (
    <>
      {children}
      {accountQuery.data === false ? <OnboardingDialog userId={userId} /> : null}
    </>
  )
}

function OnboardingDialog({ userId }: { userId: string }): ReactElement {
  const [alias, setAlias] = useState("")
  const finishOnboardingMutation = useFinishOnboardingMutation(userId)

  const finishOnboarding = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    finishOnboardingMutation.mutate({ alias })
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
              <form className="space-y-5" onSubmit={finishOnboarding}>
                <div className="space-y-2">
                  <Label htmlFor="alias">Choose your alias</Label>
                  <Input
                    id="alias"
                    autoComplete="nickname"
                    autoFocus
                    maxLength={36}
                    value={alias}
                    aria-describedby="alias-requirements"
                    aria-invalid={finishOnboardingMutation.isError}
                    onChange={(event) => {
                      finishOnboardingMutation.reset()
                      setAlias(event.target.value)
                    }}
                  />
                  <p id="alias-requirements" className="text-sm text-muted-foreground">
                    Must be 1–36 characters
                  </p>
                </div>

                {finishOnboardingMutation.isError ? (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {finishOnboardingMutation.error.message}
                  </p>
                ) : null}

                <Button type="submit" disabled={alias.trim() === "" || finishOnboardingMutation.isPending}>
                  {finishOnboardingMutation.isPending ? "Saving..." : "Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
