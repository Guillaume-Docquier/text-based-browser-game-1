import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import * as stories from "./skeleton.stories.tsx"

const { CardPlaceholder } = composeStories(stories)

describe("skeleton", () => {
  it("should give each placeholder a visible area before content loads", async () => {
    await CardPlaceholder.run()
    const blocks = document.querySelectorAll('[data-slot="skeleton"]')
    expect(blocks).toHaveLength(4)
    for (const block of blocks) {
      expect(block).toBeVisible()
      const { width, height } = block.getBoundingClientRect()
      expect(width).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
    }
  })
})
