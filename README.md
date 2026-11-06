# Can’t Stop — the workshop

A desktop and phone component gallery and animation lab, built with **Svelte 5, Threlte 8, and Three.js**. The square board rotated 45°, dice, pieces, tray, nameplates, and action plaques are rendered geometry. The concept paintings are references, not game backgrounds or clickable screenshot overlays.

## Run locally

```sh
bun install
bun run dev
```

Open **http://127.0.0.1:5199/dev/animations**.

| View | URL |
| --- | --- |
| Animation lab | `/dev/animations` |
| Component gallery | `/gallery` (also `/dev/components`) |
| Phone portrait preview | `/dev/animations?device=phone` |
| Phone landscape preview | `/dev/animations?device=phone-landscape` |
| Phone scene without workshop controls | `/dev/animations?device=phone&clean=1` |
| A particular motion | `/dev/animations?scene=bust` |
| A particular component | `/gallery?component=dice` |

The root opens the animation lab. All assets needed for rendering are local; workshop typography uses Google Fonts with a system-font fallback. A WebGL-capable browser is required.

## What to review

The gallery contains the rotated square board, ruby dice, black runners, colored saved markers, action plaques, and material samples. Orbit and zoom are available in the gallery; table, overhead, and low cameras are available throughout. Low angle shows a live Tilt slider (15–80°), including in focus mode; its setting is retained when switching views. All views use the same material library and geometry.

The lab has twelve examples: a ready table, pairing, dice rolling, a double advance, stopping, a complete turn, busting, a provisional summit, claiming, victory, a final-runner choice, and reconnection. Each has play/pause, replay, a scrubber, speed, loop, and reduced-motion controls. Space toggles playback; arrow keys seek in 0.1-second increments when focus is outside a form control. Beat markers jump to review points. The reconnection example is a presentation study, not a real network connection.

Switch between **Desktop**, **Portrait**, and **Landscape** in the toolbar. The two phone previews preserve their 390 × 844 and 844 × 390 canvas proportions. Portrait enlarges the board by a further 17% to maximize tile size, with a compact player row and closer control spacing: the empty side vertices are cropped, while all eleven tracks and their complete number labels stay visible. Player medallions move into a compact top row so they remain readable at the larger scale. On an actual narrow viewport the workshop becomes horizontally browsable; focus mode fills the screen with the game. Rotating a phone to landscape enlarges the board to nearly fill the screen height with a small border, and puts dice/actions on the right, preserving the current state and timeline. Tabletop and TV modes are intentionally deferred.

Buttons use pale maple faces on walnut bodies. Selected buttons use a warmer maple tone. The Action pieces gallery shows normal and selected buttons together, and the Materials gallery includes a large swatch of the same maple finish. Closed-column numbers are muted and struck through on the board. Pairing numbers use that same treatment whenever the model cannot use that sum: a closed column, no spare pawn, a summit, or an unchosen last-pawn destination. A partial pairing stays selectable; the move button names only usable columns. Review this in **A closed number** (`?scene=closed-column`), where 5 + 10 moves only 5, or **No spare pawns** (`?scene=no-pawn`), where 6 + 8 moves only 6.

The actual 3D pairing tabs and action plaques accept mouse and touch input. From the opening pairing scene, click **7 + 7**, then **Move 7 twice**, then **Stop & save** or **Roll again**. These actions create new review transitions from the current model state. Choosing a catalog example resets to its review fixture. The final spare runner has two explicit 3D destination choices before confirmation. Keyboard equivalents are exposed on focus; they are not transparent hitboxes over the picture.

## Approved pieces and staging

The single visual direction is **ivory tracks, polished black pawns, and deep teal, ochre, oxblood and violet player markers**. Owner medallions and claim tokens use the matching palette; pale owner engravings remain legible. The earlier comparison controls and alternative finishes have been removed.

The board is a true square rotated 45°, with equal diagonals and four right angles. Equal horizontal and vertical track spacing makes the track endpoints and number ribbon parallel to its edges. The walnut base, brass rim and lacquer face are concentric squares, sized around the complete tile-and-number bounds. Full tile sockets and number rectangles fit within the face with a consistent edge margin. The number ribbon is plain, with no decorative separators.

All board pieces use the larger common footprint: saved markers, claim markers and black pawns share the same base diameter. Pieces sit exactly at square centres. When several pieces share a position they stack vertically in stable owner order, with the pawn above the saved markers, rather than shifting sideways. Gallery runner and marker studies use equally magnified pieces on ivory track squares.

Unused black pawns wait in three slots on a round ivory disk with a walnut-and-brass base, at the lower left of the board. The opening **Ready to climb** example shows all three. Advance, save and bust motion uses those same podium slots; pawns stay full-sized and visible when they return. The gallery and every form factor share this geometry.

## Model and presentation boundary

This is a visual prototype, **not the production multiplayer game**. It has no accounts, relay, persistence, seat invitations, or hosted deployment.

- `src/lib/model/game.ts` is a pure, versioned prototype model. A starting seed and roll index reproduce dice. Intents record roll, pairing/destination choice, or stop; no animation time is part of the model. The four-seat fixtures make edge states easy to review.
- `src/lib/presentation/catalog.ts` builds examples by applying legal intents to immutable review fixtures. Every computed target is derived from its intent. Fixtures are review snapshots, not a proposed production event format.
- `src/lib/presentation/layout.ts` defines shared square centres, the common piece scale, the rotated square layers and number ribbon, and the podium slots. `finish.ts` holds the approved palette.
- `src/lib/presentation/frame.ts` is a pure time sampler. It returns the same frame at the same time, regardless of scrub history or playback speed. Reduced motion lands on the same settled state. Runner motion includes separate steps for a double.
- `src/lib/components/TableView.svelte` is the shared canvas and accessible controls. `src/lib/scene/` contains the same rendering components used by both lab and gallery. No duplicate gallery-only board or simplified test renderer exists.

The later trusted-client system should record a versioned initial seed and ordered player intents, and derive outcomes through deterministic replay, as in Pantheon and Cribbage. It should drive these same transitions and components. The prototype does not prescribe networking or storage, and its fixture snapshots should not become an event protocol.

## Visual scope

The board has eleven correctly centered tracks and **83 spaces**. Scanned walnut, cloth normal/roughness maps, and a locally bundled HDR environment provide physical surface detail and reflections. Red lacquer, ivory, token engravings, and text textures are generated locally. Dice have rounded cube geometry and all six pip faces. Pairing selection rings identify one pair; the remaining two dice form the other pair.

The first runner sculpt is a turned black pawn; detailed climbing miniatures and painted player portraits remain art work. Initial medallions use engraved owner initials and claim counts. Tumbling is a deterministic presentation track, not a physics simulation. Audio, haptics, and final decorative set dressing are not included. Material finish, readability, staging, and motion are ready for review before expanding scope.

The source design is [UX_DESIGN.md](UX_DESIGN.md); paintings and their prompts are in [docs/ux/concepts](docs/ux/concepts). The footer opens the relevant desktop/phone concept image. Source/CC0 attribution for the reused material scans is in [public/materials/SOURCES.md](public/materials/SOURCES.md).

## Verification

```sh
bun run check
bun run test:unit
bun run test:e2e
bun run build
```

Unit checks exercise classic-rule edge cases, seeded replay, catalog legality, immutable sampling, reverse seeking, double-step motion, and normal/reduced-motion equivalence. Browser tests exercise real canvas mouse and touch actions, move/save/roll handoff, the final-runner choice, every timeline, phone rotation/fit, both explicit phone previews, podium staging, uniform sizing, gallery components, and orbit controls. Captures are written to `artifacts/`; failed browser runs retain traces under `test-results/`.

For a production-build preview, run `bun run preview` and open port 4199. This remains a local prototype for review.

## License

This project is licensed under the GNU General Public License version 3 (GPL-3.0-only). See [LICENSE](LICENSE). Bundled third-party material scans and lighting retain their CC0 provenance in [public/materials/SOURCES.md](public/materials/SOURCES.md).
