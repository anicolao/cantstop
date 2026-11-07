# Can't Stop

Use Bun. Work on `codex/` branches and use pull requests. Preserve the reviewed
animation lab at `/dev/animations` and component gallery at `/gallery`; `/` is the
playable table. The game and lab share the same TableView and motion sampler.

Use only Firestore with anonymous Firebase Auth for live games. Do not add a
relay, SQLite, SSE, or a second persistence backend. Use isolated Firebase
emulators for local development and browser tests. Every same-repository PR
must publish a GitHub Pages preview and link it from the PR. Anonymous Auth is
provisioned with `bun x firebase deploy --only auth`; do not require console
setup or switch to the billing-gated Identity Platform initialization API.

The ordered, versioned player-intent log is canonical. Record choices, never dice
outcomes, positions, turns, claims, scores, winners, or animation deadlines.
Replay derives outcomes deterministically from the begin intent's seed. Clients
are trusted; validate legal actions, attribution, revisions, and retry IDs.
Settings (60° default camera, optional overhead, Standard/Fast/Blazing motion)
are personal and local. They must never affect replay or enter the game log.

Run type checks, unit/integration tests, the build, and browser checks appropriate
to a change. Keep native canvas pointer handlers and accessible keyboard controls.
Do not weaken rendering or screenshot tolerances to pass tests.
