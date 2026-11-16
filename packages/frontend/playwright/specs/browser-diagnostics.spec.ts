/* oxlint-disable no-console -- These tests deliberately emit browser messages to verify diagnostics. */
import { expect, test } from "../fixtures.ts"

test.describe("explicitly expected browser diagnostics", () => {
  test.use({ expectedBrowserDiagnostics: { messages: [/^\[alice\] console error: deliberate failure$/] } })

  test("accepts exactly the expected error", async ({ alice }) => {
    await test.step("emit the expected error", async () => {
      await alice.page.evaluate(() => {
        console.error("deliberate failure")
      })
    })
  })

  test("fails when the expected error is missing", () => {
    test.fail(true, "Browser diagnostics must require the expected error")
  })

  test("fails when another user emits an extra error", async ({ alice, bob }) => {
    await test.step("emit the expected error and an unexpected error", async () => {
      await alice.page.evaluate(() => {
        console.error("deliberate failure")
      })
      await bob.page.evaluate(() => {
        console.error("unexpected failure")
      })
    })

    test.fail(true, "Expected diagnostics must not hide an extra error")
  })
})

for (const user of ["default", "alice", "bob"] as const) {
  test.describe(`${user} browser diagnostics`, () => {
    test.describe("player labels", () => {
      test.use({
        expectedBrowserDiagnostics: {
          messages: [
            new RegExp(`^\\[${user}\\] console error: deliberate error$`),
            new RegExp(`^\\[${user}\\] console warning: deliberate warning$`),
            new RegExp(`^\\[${user}\\] page error: Error: deliberate uncaught error`),
          ],
        },
      })

      test("identifies the player for each diagnostic", async ({ page, alice, bob }) => {
        const userPage = { default: page, alice: alice.page, bob: bob.page }[user]
        await test.step("emit console messages and an uncaught error", async () => {
          await userPage.evaluate(() => {
            console.error("deliberate error")
            console.warn("deliberate warning")
          })
          const errorPromise = userPage.waitForEvent("pageerror")
          await userPage.evaluate(() => {
            setTimeout(() => {
              throw new Error("deliberate uncaught error")
            }, 0)
          })
          expect((await errorPromise).message).toBe("deliberate uncaught error")
        })
      })
    })

    for (const level of ["error", "warn"] as const) {
      test(`fails on console ${level}`, async ({ page, alice, bob }) => {
        const userPage = { default: page, alice: alice.page, bob: bob.page }[user]
        await test.step(`emit a console ${level}`, async () => {
          const messagePromise = userPage.waitForEvent("console")
          await userPage.evaluate((level) => {
            console[level]("diagnostics regression")
          }, level)
          const message = await messagePromise
          expect(message.text()).toBe("diagnostics regression")
          expect(message.type()).toBe(level === "warn" ? "warning" : "error")
        })

        // Only the diagnostics fixture's teardown should fail, after the event was verified.
        test.fail(true, "Browser diagnostics must reject this console message")
      })
    }

    test("fails on an uncaught page error", async ({ page, alice, bob }) => {
      const userPage = { default: page, alice: alice.page, bob: bob.page }[user]
      await test.step("raise an uncaught error", async () => {
        const errorPromise = userPage.waitForEvent("pageerror")
        await userPage.evaluate(() => {
          setTimeout(() => {
            throw new Error("diagnostics regression")
          }, 0)
        })
        expect((await errorPromise).message).toBe("diagnostics regression")
      })

      test.fail(true, "Browser diagnostics must reject this uncaught error")
    })

    test("allows development warnings and informational messages", async ({ page, alice, bob }) => {
      const userPage = { default: page, alice: alice.page, bob: bob.page }[user]
      await test.step("emit allowed messages", async () => {
        await userPage.evaluate(() => {
          console.warn("Clerk: Clerk has been loaded with development keys.")
          console.log("diagnostics regression log")
          console.info("diagnostics regression info")
        })
      })
    })
  })
}
