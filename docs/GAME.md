# Can't Stop game and replay protocol

Protocol 2 supports two, three, or four individual players. Four dice are paired
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
- `roll {}`: the active player risks progress by choosing to roll again.
- `advance {pairing,column?}`: select a pairing (index 0–2) and, if needed, the
  final-runner destination. Selecting again replaces only this roll’s moves.
- `stop {}`: the active player chooses to bank progress.

There are no events for dice results, positions, running totals, claims, busts,
turn changes, winners, animation completion, pair previews, camera settings, or
speed. `replay` validates every intent in order and derives the whole table.
Protocols 1 and 2 hash the begin seed with FNV-1a and uses the frozen seeded dice
algorithm and roll-index derivation in `src/lib/model/game.ts`. Change the protocol
version before changing those rules or random semantics.

Protocol 2 derives the first roll of a turn from `begin`, `stop`, or a busting
`roll` action. Opening busts pass and roll for the next seat deterministically.
No extra events are written for those forced rolls. The animation queue displays
the save/bust and each following roll in sequence; its timing stays outside history.

The reducer retains a derived pre-selection board for the current dice. Every
`advance` applies to that same board, so a different pairing or last-pawn
destination restores the previous choice and applies the new one without
accumulating steps. `roll` commits the selection and starts a fresh choice;
`stop` commits it into saved progress. Reconnect and log import reconstruct the
same reversible choice from history. Saved positions and progress from earlier
rolls are never undone by a pairing change.

Existing protocol-1 logs keep their original explicit roll/advance rules. Tables
cannot change protocol mid-log. New tables use protocol 2.

## Persistence and trust

Clients are trusted, following Cribbage. Anonymous Firebase Auth and Firestore
are the sole backend. The adapter uses the pure reducer, optimistic expected
revisions, immutable action IDs, and retry acknowledgements. Firestore stores
immutable events plus command receipts and small
membership/revision indexes for atomic writes. Those indexes are not game-state
snapshots and are never used instead of replay.

Firebase anonymous identities gate attributable writes; the host can submit only
for explicitly invited companion seats. The trusted-client game does not claim
concealed or adversarial randomness. A rejected stale choice is retried
only after replay catches up; an uncertain network write keeps its original ID.

Settings, local pair previews, animation clocks, and optional reduced motion live
outside history. Reconnecting samples the latest committed board immediately;
it does not replay a backlog of old animations. Live actions and the lab use the
same TableView, materials, geometry, and animation sampler.

## Verification

Unit tests finish and replay complete two-, three-, and four-player games, reject
computed event payloads, validate every action, and preserve presentation
invariants. Firestore emulator tests cover retries, racing writes, independent
observers, immutable logs, identities,
concurrent joins, and namespace isolation. Browser tests use native mesh clicks,
independent profiles, enabled animation, settings, reconnects, and replay export.
