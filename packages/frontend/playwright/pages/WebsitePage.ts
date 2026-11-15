import type { Page } from "@playwright/test"
import { BasePage } from "./BasePage.ts"
import { NavbarComponent } from "./NavbarComponent.ts"
import { OnboardingModal } from "./OnboardingModal.ts"

/** Shared website layout available from every non-game page. */
export abstract class WebsitePage extends BasePage {
  public readonly navbar: NavbarComponent
  public readonly onboarding: OnboardingModal

  protected constructor(page: Page) {
    super(page)

    this.navbar = new NavbarComponent(page)
    this.onboarding = new OnboardingModal(page)
  }
}
