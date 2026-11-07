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
- `invite-bot {id,name,level?,colour?}`: the host chooses a companion and its level.
  Walk-up tabletop invitations also choose an unused colour.
- `begin {seed}`: the host starts or restarts with a fresh entropy choice.
- `roll {}`: the active player risks progress by choosing to roll again.
- `advance {pairing,column?}`: select a pairing (index 0–2) and, if needed, the
  final-runner destination. Selecting again replaces only this roll’s moves.
- `stop {}`: the active player chooses to bank progress.

Digital games have no events for dice results, positions, running totals, claims, busts,
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


## Protocol 3: walk-up tabletop

The `/tt/` route creates a hidden room internally. Its first and subsequent seats
are explicit `sit {seat,colour}` actions, with no name or computed snapshot fields.
Colours and physical places must be unique, with at most four colours. The first
seat establishes the owner; any seated colour may choose begin. Colour labels
are derived. Automatic opening rolls, reversible current-roll choices, saving,
busting, and victory have the same semantics as protocol 2. Existing versions
remain replayable and a log cannot mix protocol versions.


## Companion levels

New companions offer **Easy**, **Yolo**, **Standard**, and **Hard**, with Standard
selected initially. Choose the level before adding the companion in the web
lobby. On `/tt/`, a seated host opens **Table menu**, chooses **Companion level**
and an unused **Companion colour**, then touches **Add companion**. A companion
uses one of the four player slots; it does not create a local human Auth session.

- Easy uses balanced pairing with four times the bust-loss penalty and tends to
  save early.
- Yolo uses the same pairing with 0.35 times the penalty and tends to overreach.
- Standard uses the original balanced policy.
- Hard uses base-1.5 exponential board value, an 80-point completed-column bonus,
  and exact weighted enumeration of next-roll outcomes with double bust loss.
  In three- and four-player games it races the leading opponent on each column.

The level is an explicit invitation choice, retained across reloads and rematches.
It cannot be changed during play. Protocol-1 invitations retain the classic
policy; existing protocol-2 companions without a level also keep that policy.
Only protocols 2 and 3 accept the optional level. No policy consults the seed or
actual future throws. Every bot move is an ordinary attributed pairing, roll, or
banking intent submitted by the table's authenticated host.

The reducer derives a count of throws in the current turn so balanced policies
can take at least two throws unless banking wins. Replacements do not increment
it; turn ends reset it. It is reconstructed by replay and is never persisted as
an event field. Animation speed, seating preferences, and camera settings have
no effect on bot decisions. The same policies drive web and tabletop turns.

The calibrated two-player results and caveats are in [the AI report](ai/README.md).
The no-bonus board policy is not exposed as a separate difficulty tier.

## External physical input (protocols 2 and 3)

The approved exception to seeded dice is a physical DiceTower observation:

- `dice-source {tower: string | null}`: a seated human selects their source.
  Null restores digital rolls. A source is never set on a bot or another human.
- `tower-roll {tower,eventId,rollId,dice}`: the active human accepts four integer
  d6 values from their selected source. IDs distinguish duplicate events, new
  throws with identical values, and recognition changes for one physical throw.

The selected source is a game input; its local preference determines which
controlled humans submit that choice. Camera, motion, and physical seating
preferences remain outside history. A tower-controlled opening waits in ready
without any synthetic roll action. Digital and physical humans can share a game.

A new physical throw replaces the current dice and retains previously selected
progress. A correction for the current roll ID restores the board before that
throw, discards its pairing, and applies the corrected dice. It increments neither
the turn's throw count nor roll index again. Reused event IDs and completed roll
IDs are rejected; a bank, bust, or later throw ends the correction window. Busts
and legal moves use the same pure model as digital dice. Physical input advances
the roll index once per new throw; any later digital throw remains deterministic
from the original seed and that index.

Observers read DiceTower's external RTDB stream without writing to it. Only
Firestore's accepted input log is canonical for the game. Replay and imports
require no tower connection. Protocol-1 logs reject both new intent types.

The live controllers automatically submit a normal `advance` when every legal
variant produces the same actual column increments. Reversed sums, capped
doubles, and unusable sums are compared by their effective moves. Distinct
last-pawn choices remain explicit. This controller behavior leaves historical
replay and animation-lab fixtures unchanged.

DiceTower workaround: only the first occurrence of consecutive identical physical
dice values may auto-select an equivalent move. Later readings (even with new
roll IDs or reordered dice) wait for a normal pairing click; another throw may
replace that unplayed reading. A different result, a new turn, or a dice-source
change enables automatic selection again. The guard is derived from accepted
history, so reloads preserve it. Recognition corrections replace their current
throw, and digital auto-selection is unchanged.
