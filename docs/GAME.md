# Can't Stop game and replay protocol

Protocol 1 supports two, three, or four individual players. Four dice are paired
into two sums. Every usable sum must advance; doubles advance twice, capped at
the summit. There are three temporary runners. When one runner could start either
of two new columns, the player explicitly chooses. A full pairing is available
if at least one sum can advance. Closed columns, a lack of spare runners, and an
already reached summit make the relevant sums inactive.

Stopping saves every temporary position and claims reached summits, closing those
columns to all players. Reaching a summit alone does not claim it or free its
runner. A roll with no legal pairing busts and loses only provisional progress.
The first three claimed columns end the game immediately. Players take turns in
seating order; the host takes the first turn. A new game at the same table retains
seats and records another begin action with a new seed.

## Canonical history

An event has exactly `version`, `sequence`, `id`, `actor`, and `intent`.
Sequence starts at one. IDs are unique and remain stable across retries. Actors
are game-local identities; display names are not identities.

Only these actions enter history:

- `create {name}` and `join {name}`: choose a seat.
- `invite-bot {id,name}`: the host chooses an optional companion.
- `begin {seed}`: the host starts or restarts with a fresh entropy choice.
- `roll {}`: the active player chooses to roll.
- `advance {pairing,column?}`: commit a pairing (index 0–2) and, if needed, the
  final-runner destination.
- `stop {}`: the active player chooses to bank progress.

There are no events for dice results, positions, running totals, claims, busts,
turn changes, winners, animation completion, pair previews, camera settings, or
speed. `replay` validates every intent in order and derives the whole table.
Protocol 1 hashes the begin seed with FNV-1a and uses the frozen seeded dice
algorithm and roll-index derivation in `src/lib/model/game.ts`. Change the protocol
version before changing those rules or random semantics.

## Persistence and trust

Clients are trusted, following Cribbage. Both storage adapters use the same pure
reducer, optimistic expected revisions, immutable action IDs, and retry
acknowledgements. SQLite stores only event bodies keyed by table and sequence.
Firestore stores the same immutable events plus command receipts and small
membership/revision indexes for atomic writes. Those indexes are not game-state
snapshots and are never used instead of replay.

Firebase anonymous identities gate attributable writes; the host can submit only
for explicitly invited companion seats. Local relay clients are deliberately
trusted identities rather than authenticated competitive clients. Neither mode
claims concealed or adversarial randomness. A rejected stale choice is retried
only after replay catches up; an uncertain network write keeps its original ID.

Settings, local pair previews, animation clocks, and optional reduced motion live
outside history. Reconnecting samples the latest committed board immediately;
it does not replay a backlog of old animations. Live actions and the lab use the
same TableView, materials, geometry, and animation sampler.

## Verification

Unit tests finish and replay complete two-, three-, and four-player games, reject
computed event payloads, validate every action, and preserve presentation
invariants. Relay tests cover retries, racing writes, and reopening the database.
Firestore emulator tests cover independent observers, immutable logs, identities,
concurrent joins, and namespace isolation. Browser tests use native mesh clicks,
independent profiles, enabled animation, settings, reconnects, and replay export.
