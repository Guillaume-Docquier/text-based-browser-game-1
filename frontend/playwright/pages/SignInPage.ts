import type { Locator, Page } from "@playwright/test"
import { WebsitePage } from "./WebsitePage.ts"

export class SignInPage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/sign-in" })

  private readonly emailAddressInput: Locator
  private readonly continueButton: Locator
  private readonly useAnotherMethodLink: Locator
  private readonly verificationCodeInput: Locator

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Welcome back", level: 1 })
    this.emailAddressInput = page.getByRole("textbox", { name: "Email address", exact: true })
    this.continueButton = page.getByRole("button", { name: "Continue", exact: true })
    this.useAnotherMethodLink = page.getByRole("link", { name: "Use another method", exact: true })
    this.verificationCodeInput = page.getByRole("textbox", { name: "Enter verification code", exact: true })
  }

  public static async goto(page: Page): Promise<SignInPage> {
    return await new SignInPage(page).goto()
  }

  public async goto(): Promise<SignInPage> {
    await this.page.goto(SignInPage.urlPattern.pathname)
    return this
  }

  public async submitEmailAddress(emailAddress: string): Promise<void> {
    await this.emailAddressInput.fill(emailAddress)
    await this.continueButton.click()
  }

  public async chooseAnotherMethod(): Promise<void> {
    await this.useAnotherMethodLink.click()
  }

  public async requestEmailCode(emailAddress: string): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((response) => response.url().includes("prepare_first_factor") && response.ok()),
      this.page.getByRole("button", { name: `Email code to ${emailAddress}`, exact: true }).click(),
    ])
  }

  public async enterVerificationCode(code: string): Promise<void> {
    await this.verificationCodeInput.pressSequentially(code)
  }
}
