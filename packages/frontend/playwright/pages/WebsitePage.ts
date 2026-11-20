import type { Page } from "@playwright/test"
import { BasePage } from "./BasePage.ts"
import { NavbarComponent } from "./NavbarComponent.ts"
import { OnboardingModal } from "./OnboardingModal.ts"

export abstract class WebsitePage extends BasePage {
  public readonly navbar: NavbarComponent
  public readonly onboarding: OnboardingModal

  protected constructor(page: Page) {
    super(page)

    this.navbar = new NavbarComponent(page)
    this.onboarding = new OnboardingModal(page)
  }

  public async simulateTabFocus(): Promise<void> {
    await this.page.evaluate("document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))")
  }
}
