import type { Page } from "@playwright/test"
import { NavbarComponent } from "./NavbarComponent.ts"

/** Shared website layout available from every non-game page. */
export abstract class WebsitePage {
  protected readonly page: Page

  public readonly navbar: NavbarComponent

  protected constructor(page: Page) {
    this.page = page
    this.navbar = new NavbarComponent(page)
  }
}
