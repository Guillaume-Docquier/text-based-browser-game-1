import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { users } from "../auth.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GamesBrowserPage } from "../pages/GamesBrowserPage.ts"
import { HomePage } from "../pages/HomePage.ts"
import { SignInPage } from "../pages/SignInPage.ts"

test("logins and logouts redirects", async ({ clerkConfig, page }) => {
  await clerkSetup(clerkConfig)

  const homePage = await HomePage.goto(page)

  await test.step("Sign in without navigating", async () => {
    await clerk.signIn({ page, emailAddress: users.alice.email })

    await expect(homePage.userMenuButton).toBeVisible()
    await expect(homePage.signInLink).not.toBeVisible()
    await expect(homePage.signUpLink).not.toBeVisible()
  })

  await test.step("Sign out without navigating", async () => {
    await clerk.signOut({ page })

    await expect(homePage.signInLink).toBeVisible()
    await expect(homePage.signUpLink).toBeVisible()
    await expect(homePage.userMenuButton).not.toBeVisible()
  })

  await test.step("Try to create a game while signed out and get redirected to login", async () => {
    await homePage.playForFreeLink.click()
    const gamesPage = new GamesBrowserPage(page)
    await expect(page).toHaveURL(GamesBrowserPage.urlPattern)
    await expect(gamesPage.heading).toBeVisible()
    await gamesPage.createGameLink.click()

    await expect(page).toHaveURL(SignInPage.urlPattern)
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/games/create")
    const signInPage = new SignInPage(page)
    await expect(signInPage.heading).toBeVisible()
  })

  await test.step("Sign in and return to game creation", async () => {
    const signInPage = new SignInPage(page)

    // We log in via verification code because the test users can't use passwords
    await signInPage.submitEmailAddress(users.alice.email)
    await signInPage.chooseAnotherMethod()
    await signInPage.requestEmailCode(users.alice.email)
    await signInPage.enterVerificationCode("424242")

    await expect(page).toHaveURL(CreateGamePage.urlPattern)
    const createGamePage = new CreateGamePage(page)
    await expect(createGamePage.heading).toBeVisible()
    await expect(createGamePage.userMenuButton).toBeVisible()
  })

  await test.step("Sign out and return home", async () => {
    const createGamePage = new CreateGamePage(page)
    await createGamePage.signOut()

    await expect(page).toHaveURL(HomePage.urlPattern)
    const signedOutHomePage = new HomePage(page)
    await expect(signedOutHomePage.heading).toBeVisible()
    await expect(signedOutHomePage.signInLink).toBeVisible()
    await expect(signedOutHomePage.signUpLink).toBeVisible()
    await expect(signedOutHomePage.userMenuButton).not.toBeVisible()
  })
})
