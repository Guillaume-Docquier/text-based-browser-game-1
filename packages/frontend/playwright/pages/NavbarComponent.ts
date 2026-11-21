import type { Locator, Page } from "@playwright/test"
import type { HomePage } from "./HomePage.ts"

export class NavbarComponent {
  private readonly page: Page

  public readonly logo: Locator
  public readonly homeLink: Locator
  public readonly gamesLink: Locator

  public readonly signInLink: Locator
  public readonly signUpLink: Locator
  public readonly userMenuButton: Locator

  public constructor(page: Page) {
    this.page = page
    const websiteTopBar = page.getByRole("banner")
    const websiteNavigation = websiteTopBar.getByRole("navigation")

    this.logo = websiteTopBar.getByRole("img", { name: "Cosmic Empires logo" })
    this.homeLink = websiteNavigation.getByRole("link", { name: "Home", exact: true })
    this.gamesLink = websiteNavigation.getByRole("link", { name: "Games", exact: true })

    this.signInLink = websiteTopBar.getByRole("link", { name: "Sign in", exact: true })
    this.signUpLink = websiteTopBar.getByRole("link", { name: "Sign up", exact: true })
    this.userMenuButton = websiteTopBar.getByRole("button", { name: "Open user menu" })
  }

  public async openHome(): Promise<HomePage> {
    await this.homeLink.click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid a circular dependency through WebsitePage.
    const { HomePage } = await import("./HomePage.ts")
    return new HomePage(this.page)
  }

  public async signOut(): Promise<void> {
    await this.userMenuButton.click()
    await this.page.getByRole("group", { name: "Account actions" }).getByRole("button").last().click()
  }
}
