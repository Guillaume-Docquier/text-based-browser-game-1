# API slice tests

- The router is the strict testing boundary for API vertical slices. Exercise each slice through the API client, covering the real router, use case, and production repository together.
- Never write repository tests or controller/use-case tests for these slices.
- Never implement test repositories, including repositories that insert or modify game state solely for test setup.
- Integration tests must set up and observe game state through the API. Create and start games with the test client, then use Readiness or advance the test clock to process turns. Use a fixed galaxy seed for deterministic scenarios.
