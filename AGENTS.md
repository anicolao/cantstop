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
The approved physical DiceTower exception records the selected source and accepted
four-die observations with event/roll IDs; these external inputs are required for
replay. Observe DiceTower read-only; game history still lives only in Firestore.
New tables use protocol 2: turn-opening rolls are derived automatically, and
pairing selections replace only the current roll until Roll again or Stop & save.
Keep protocol-1 replay unchanged and reject mixed-version logs. Never write
synthetic roll events for forced opening throws. Pairing and last-pawn mesh
choices apply directly; no separate Move confirmation in the live game.
Pages previews build and deploy independently of CI verification results.

Replay derives outcomes deterministically from the begin intent's seed. Clients
are trusted; validate legal actions, attribution, revisions, and retry IDs.
Settings (60° default camera, optional overhead, Standard/Fast/Blazing motion)
are personal and local. They must never affect replay or enter the game log.

Run type checks, unit/integration tests, the build, and browser checks appropriate
to a change. Keep native canvas pointer handlers and accessible keyboard controls.
Do not weaken rendering or screenshot tolerances to pass tests.

Tabletop is the `/tt/` walk-up route: immediately show the board and six empty
places (two per long edge, one per short edge). People tap a place, choose an
available colour, and start. Never require names, manual room creation, or codes.
New game allocates a new hidden room. Protocol 3 records only sit {seat,colour},
begin, and ordinary player choices; colour labels and outcomes are derived.
Preserve protocols 1 and 2. Each colour has a separately persisted anonymous Auth
session; never impersonate UIDs or mark humans as bots. Render the shared scene
with native mesh touch controls and orient the board/dock toward the active seat.
