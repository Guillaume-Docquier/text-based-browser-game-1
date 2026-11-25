### Blind spots

- **WebSocket setup.** The ticket named the transport. We still had to authenticate socket connections outside Express middleware, get a fresh Clerk token on reconnect, and enable WebSocket upgrades in Vite.
- **Socket lifetime.** We missed how tRPC’s lazy client behaves with its default `0 ms` timeout. It kept rescheduling the timer during an active subscription. The fresh review caught it.
- **Deployment compatibility.** The old frontend reads `turnEndsAt` from `getPlayerView`. Once the new backend removes that field, tabs still running the old frontend can fail. The PR now tells players to reload after the frontend deploys.

### Did I follow the architecture guidance?

Yes. The gameplay router handles transport and validation, the repository reads the snapshot, and the turn-state use case coordinates delivery. PostgreSQL connection management lives in the database adapter. The frontend consumes named API types and keeps query and subscription wiring in `lib/api`.

### What helped, and what got in the way?

The repository boundary helped. It gave us one place to read the turn and readiness in a single SQL statement, while the API shared that result across subscribers. The testing guidance also sent us to the right places. Real PostgreSQL exercised commit-time notifications and listener recovery. Playwright exercised Clerk, the proxy, and the race between the world response and the live turn.

The HTTP-shaped procedure rules added friction. tRPC passes the whole subscription iterator to `.output()`, so we built a schema wrapper that validates each yielded snapshot. That works, but the wrapper is more elaborate than the payload contract.

### What guidance would I revisit?

The design fits the ticket. The main awkward spot is `TurnStateUseCase`. It handles a single subscription request and also owns state shared across all subscribers, including refresh ordering and retries. I’d clarify where long-lived API services belong. For this feature, that would let the route own authorization and validation while a shared service owns delivery. I’d also document how subscriptions validate each emitted value.

### What caught issues and helped me orient?

- **TypeScript and lint** caught callers still using readiness fields removed from `PlayerView`. **CodeScene** pushed me to separate snapshot registration from delivery and split loading from readiness logic.
- **Playwright** verified one world request per turn and disabled controls while the world was behind. **PostgreSQL tests** verified rollback suppression, listener reconnect, and recovery from a cancelled snapshot read.
- **Codecov** replaced its preliminary pass with a failure after processing coverage. I reported green too early in the first handoff. On the follow-up I waited for the actual patch percentage.
