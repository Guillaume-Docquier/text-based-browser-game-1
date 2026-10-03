import { stat } from "node:fs/promises"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { TestInfo } from "@playwright/test"
import { expect, test as applicationTest } from "../fixtures.ts"

type FailureEvidence = Pick<TestInfo, "status" | "errors" | "attachments">

const test = applicationTest.extend<
  { captureFailureEvidence: undefined; expectedDiagnosticsFailure: boolean },
  { failureEvidence: Map<string, FailureEvidence> }
>({
  expectedDiagnosticsFailure: [false, { option: true }],
  failureEvidence: [
    // oxlint-disable-next-line no-empty-pattern -- Worker fixtures do not need other dependencies here.
    async ({}, use): Promise<void> => {
      await use(new Map())
    },
    { scope: "worker" },
  ],
  captureFailureEvidence: async ({ failureEvidence, expectedDiagnosticsFailure }, use, testInfo) => {
    await use(undefined)
    failureEvidence.set(testInfo.title, {
      status: testInfo.status,
      errors: [...testInfo.errors],
      attachments: [...testInfo.attachments],
    })
    // Mark expected failures only after teardown: an early test.fail() changes retention decisions while status is "passed".
    test.fail(expectedDiagnosticsFailure, "This test deliberately emits an unexpected browser diagnostic.")
  },
  // Make the observer an outer fixture so it sees the diagnostics assertion and attachments after context teardown.
  context: async ({ captureFailureEvidence: _captureFailureEvidence, context }, use) => {
    await use(context)
  },
})

const diagnosticFailureTest = test.extend({ expectedDiagnosticsFailure: true })

const lateDiagnosticTest = diagnosticFailureTest.extend({
  alice: async ({ alice }, use) => {
    await use(alice)
    await alice.page.evaluate(() => {
      // oxlint-disable-next-line no-console -- This warning reproduces a diagnostic emitted during fixture teardown.
      console.warn("late Alice teardown warning")
    })
  },
})

test.describe("browser diagnostic fixtures", () => {
  // Expected failures keep this worker alive; the final passing test validates their recorded failure evidence.
  test.describe.configure({ mode: "serial" })

  diagnosticFailureTest("Alice's additional page warning fails during diagnostics teardown", async ({ alice, bob }) => {
    await test.step("Emit a warning from Alice's additional page", async () => {
      void bob
      const additionalPage = await alice.page.context().newPage()
      await additionalPage.evaluate(() => {
        // oxlint-disable-next-line no-console -- The emitted browser warning is the behavior under test.
        console.warn("Alice additional page warning")
      })
      await additionalPage.close()
    })
  })

  diagnosticFailureTest("Bob's additional page uncaught error fails during diagnostics teardown", async ({ alice, bob }) => {
    await test.step("Emit an uncaught error from Bob's additional page", async () => {
      void alice
      const additionalPage = await bob.page.context().newPage()
      const error = additionalPage.waitForEvent("pageerror")
      await additionalPage.evaluate(() => {
        setTimeout(() => {
          throw new Error("Bob additional page uncaught error")
        }, 0)
      })
      await error
      await additionalPage.close()
    })
  })

  lateDiagnosticTest("a late Alice warning retains Bob's already-closed context video", async ({ alice, bob }) => {
    await test.step("Use both contexts before Bob closes and Alice emits a teardown warning", async () => {
      await alice.page.title()
      await bob.page.title()
    })
  })

  test("diagnostics failures retain all authenticated videos with correct attribution", async ({ failureEvidence }) => {
    const cases = [
      {
        title: "Alice's additional page warning fails during diagnostics teardown",
        diagnostic: "[alice, page 2, about:blank] console warning: Alice additional page warning",
        videoNames: ["alice page 1", "alice page 2", "bob page 1"],
      },
      {
        title: "Bob's additional page uncaught error fails during diagnostics teardown",
        diagnostic: "[bob, page 2, about:blank] page error: Error: Bob additional page uncaught error",
        videoNames: ["alice page 1", "bob page 1", "bob page 2"],
      },
      {
        title: "a late Alice warning retains Bob's already-closed context video",
        diagnostic: "[alice, page 1, about:blank] console warning: late Alice teardown warning",
        videoNames: ["alice page 1", "bob page 1"],
      },
    ]

    for (const scenario of cases) {
      await test.step(`Verify failure evidence: ${scenario.title}`, async () => {
        const evidence = failureEvidence.get(scenario.title)
        Assert.isDefined(evidence)
        expect(evidence.status).toBe("failed")
        expect(evidence.errors).toHaveLength(1)
        expect(evidence.errors[0]?.message).toContain("Unexpected browser diagnostics")
        expect(evidence.errors[0]?.message).toContain(scenario.diagnostic)

        const videos = evidence.attachments.filter((attachment) => attachment.contentType === "video/webm")
        expect(videos).toHaveLength(scenario.videoNames.length)
        expect(videos.map((video) => video.name)).toEqual(expect.arrayContaining(scenario.videoNames))
        for (const video of videos) {
          Assert.isDefined(video.path)
          expect((await stat(video.path)).size).toBeGreaterThan(0)
        }
      })
    }
  })
})
