import { UserButton } from "@clerk/react"
import { type FormEvent, type ReactElement, type ReactNode, useState } from "react"
import { Alert, AlertDescription } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Label } from "@/components/label.tsx"
import { useCurrentAccountQuery } from "@/lib/api/useCurrentAccountQuery.ts"
import { useSetAliasMutation } from "@/lib/api/useSetAliasMutation.ts"

export function AliasOnboardingGate({ children }: { children: ReactNode }): ReactElement {
  const accountQuery = useCurrentAccountQuery()

  if (accountQuery.isPending) {
    return <AliasPage title="Loading your account" description="Preparing your command profile." />
  }

  if (accountQuery.isError) {
    return (
      <AliasPage title="Your account could not be loaded" description="Try again before entering the game.">
        <Button
          onClick={() => {
            void accountQuery.refetch()
          }}
        >
          Try again
        </Button>
      </AliasPage>
    )
  }

  if (accountQuery.data.alias === null) {
    return <AliasForm />
  }

  return <>{children}</>
}

function AliasForm(): ReactElement {
  const [alias, setAlias] = useState("")
  const setAliasMutation = useSetAliasMutation()

  const submitAlias = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setAliasMutation.mutate({ alias })
  }

  return (
    <AliasPage title="Choose your alias" description="This is how other players will know you. It cannot be changed later.">
      <form className="space-y-5" onSubmit={submitAlias}>
        <div className="space-y-2">
          <Label htmlFor="alias">Alias</Label>
          <Input
            id="alias"
            autoComplete="nickname"
            autoFocus
            maxLength={32}
            value={alias}
            aria-describedby="alias-requirements"
            aria-invalid={setAliasMutation.isError}
            onChange={(event) => {
              setAliasMutation.reset()
              setAlias(event.target.value)
            }}
          />
          <p id="alias-requirements" className="text-sm text-muted-foreground">
            1–32 characters. Spaces and symbols are welcome.
          </p>
        </div>

        {setAliasMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{setAliasMutation.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={alias.trim() === "" || setAliasMutation.isPending}>
          {setAliasMutation.isPending ? "Saving..." : "Continue"}
        </Button>
      </form>
    </AliasPage>
  )
}

function AliasPage({ title, description, children }: { title: string; description: string; children?: ReactNode }): ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex min-h-16 items-center justify-between border-b border-border/70 px-4 sm:px-6">
        <div className="font-heading text-xl font-semibold">Cosmic Empires</div>
        <UserButton />
      </header>
      <main className="mx-auto flex w-full max-w-xl px-4 py-16 sm:px-6">
        <Card className="w-full border border-border/60">
          <CardHeader>
            <h1 className="font-heading text-2xl font-semibold">{title}</h1>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {children === undefined ? null : <CardContent>{children}</CardContent>}
        </Card>
      </main>
    </div>
  )
}
