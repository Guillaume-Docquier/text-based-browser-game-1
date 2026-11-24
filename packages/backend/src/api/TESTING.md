# API slice tests

- The router is the strict testing boundary for API vertical slices. Exercise each slice through the API client, covering the real router, use case, and production repository together.
- Never write repository tests or controller/use-case tests for these slices.
- Never implement test repositories, including repositories that insert or modify game state solely for test setup.
- Integration tests must set up and observe game state through the API. Create and start games with the test client, then use Readiness or advance the test clock to process turns. Use a fixed galaxy seed for deterministic scenarios.

For a suspected API bug, look for a request or sequence of requests that reaches the state and exposes the failure. If validation rejects the input, that rejection is the observable behavior to test when it matters. An input combination that the API prevents is insufficient reason for an internal regression test. Keep test scenarios within the existing API. Do not call a controller or repository to bypass it or add an endpoint solely for test setup.
