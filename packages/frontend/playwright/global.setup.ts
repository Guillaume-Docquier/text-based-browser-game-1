import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { z } from "zod"
import { users } from "./auth.ts"
import { expect, test } from "./fixtures.ts"
import { HomePage } from "./pages/HomePage.ts"

test.describe.configure({ mode: "serial" })

test("configure Clerk for testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const { alias, email, authFilePath } of Object.values(users)) {
  test(`authenticate ${alias} and complete onboarding`, async ({ page, isCI }) => {
    const createGamePage = await HomePage.goto(page)

    const needsOnboarding = await test.step("sign in", async () => {
      if (isCI) {
        await clerk.signIn({ page, emailAddress: email })
        return true
      }

      const [onboardingStatusResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().includes("accounts.isOnboarded")),
        clerk.signIn({ page, emailAddress: email }),
      ])
      return !isOnboarded(await onboardingStatusResponse.json())
    })

    await test.step("complete onboarding", async () => {
      if (needsOnboarding) {
        await expect(createGamePage.onboarding.heading).toBeVisible()
        await createGamePage.onboarding.chooseAlias(alias)
        await createGamePage.onboarding.finishOnboarding()
      }

      await expect(createGamePage.onboarding.heading).not.toBeVisible()
    })

    await test.step("save auth state", async () => {
      await page.context().storageState({ path: authFilePath })
    })
  })
}

function isOnboarded(responseJson: unknown): boolean {
  return isOnboardedResponseSchema.parse(responseJson)[0].result.data
}

const isOnboardedResponseSchema = z
  .array(
    z.object({
      result: z.object({
        data: z.boolean(),
      }),
    }),
  )
  .min(1)
