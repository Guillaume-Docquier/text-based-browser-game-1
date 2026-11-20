import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import * as stories from "./separator.stories.tsx"

const { Interactive, Vertical } = composeStories(stories)

describe("separator", () => {
  it.each([
    { story: Interactive, orientation: "horizontal", long: "width", short: "height" },
    { story: Vertical, orientation: "vertical", long: "height", short: "width" },
  ] as const)(
    "should expose the $orientation orientation and draw the separator along that axis",
    async ({ story, orientation, long, short }) => {
      await story.run()
      const line = page.getByRole("separator").first()
      await expect.element(line).toHaveAttribute("aria-orientation", orientation)
      const box = line.element().getBoundingClientRect()
      expect(box[short]).toBeGreaterThan(0)
      expect(box[long]).toBeGreaterThan(box[short])
    },
  )
})
