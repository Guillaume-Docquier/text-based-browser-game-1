import { expect, test } from "@playwright/test"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { HomePage } from "./pages/HomePage.ts"
import { SignInPage } from "./pages/SignInPage.ts"

test("shows the public landing page", async ({ page }) => {
  const homePage = new HomePage(page)
  await homePage.goto()

  await expect(homePage.heading).toBeVisible()
  await expect(homePage.playForFreeLink).toBeVisible()
  await expect(homePage.createAccountLink).toBeVisible()
})

test("redirects signed-out users from game creation to sign in", async ({ page }) => {
  const createGamePage = new CreateGamePage(page)
  await createGamePage.goto()

  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fgames%2Fcreate$/)
  const signInPage = new SignInPage(page)
  await expect(signInPage.heading).toBeVisible()
})
