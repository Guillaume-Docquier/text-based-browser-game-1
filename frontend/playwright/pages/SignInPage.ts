import type { Locator, Page } from "@playwright/test"

export class SignInPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/sign-in" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly emailAddressInput: Locator
  public readonly continueButton: Locator
  public readonly useAnotherMethodLink: Locator
  public readonly verificationCodeInput: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Welcome back", level: 1 })
    this.emailAddressInput = page.getByRole("textbox", { name: "Email address", exact: true })
    this.continueButton = page.getByRole("button", { name: "Continue", exact: true })
    this.useAnotherMethodLink = page.getByRole("link", { name: "Use another method", exact: true })
    this.verificationCodeInput = page.getByRole("textbox", { name: "Enter verification code", exact: true })
  }

  public static async goto(page: Page): Promise<SignInPage> {
    const signInPage = new SignInPage(page)
    await signInPage.goto()
    return signInPage
  }

  public async goto(): Promise<void> {
    await this.page.goto(SignInPage.urlPattern.pathname)
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
