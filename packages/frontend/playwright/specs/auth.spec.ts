import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright"
import { users } from "../auth.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameListingsPage } from "../pages/GameListingsPage.ts"
import { HomePage } from "../pages/HomePage.ts"
import { SignInPage } from "../pages/SignInPage.ts"

test("sign-in returns the player to game creation and sign-out returns them home", async ({ page, clerkConfig }) => {
  await clerkSetup(clerkConfig)
  await setupClerkTestingToken({ page })

  const signInPage = await test.step("Open the games list and request game creation while signed out", async () => {
    const homePage = await HomePage.goto(page)
    const gamesPage = await homePage.playForFree()
    await expect(page).toHaveURL(GameListingsPage.urlPattern)

    const signInPage = await gamesPage.createGameWhileSignedOut()
    await expect(page).toHaveURL(
      (url) => SignInPage.urlPattern.test(url) && url.searchParams.get("redirect") === CreateGamePage.urlPattern.pathname,
    )
    return signInPage
  })

  const createGamePage = await test.step("Sign in with an email code and resume game creation", async () => {
    await signInPage.signInWithEmailCode(users.alice.email, "424242")
    await expect(page).toHaveURL(CreateGamePage.urlPattern)
    const createGamePage = new CreateGamePage(page)
    await expect(createGamePage.heading).toBeVisible()
    return createGamePage
  })

  await test.step("Sign out and return to the public home page", async () => {
    await createGamePage.navbar.signOut()
    await expect(page).toHaveURL(HomePage.urlPattern)
    const homePage = new HomePage(page)
    await expect(homePage.navbar.signInLink).toBeVisible()
    await expect(homePage.onboarding.heading).not.toBeVisible()
  })
})
