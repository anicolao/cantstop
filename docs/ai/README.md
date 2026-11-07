# AI handoff comparison and difficulty recommendation

Implementation decision: the playable game now offers Easy, Yolo, Standard, and
Hard. Hard uses the adjusted +80 policy proposed below as the Expert candidate;
the no-bonus candidate is omitted. See [companion setup](../GAME.md#companion-levels).
The experiment results below retain their original policy names.

The ZIP's balanced policy is a substantial upgrade over our current companion. The proposed unmodified no-bonus board-value policy is **not a reliably harder Standard**. Adding 80 gives a modest advantage against balanced, but the raw board-value policies are extremely aggressive. A cautious adjustment to their stopping rule is the best candidate for the upper levels.

This section describes the original research report and offline harness. The subsequent four-level implementation is documented above; the archived measurements are unchanged.

## Recommended personalities

| Level | Pairing strategy | Stopping strategy | Wins against current companion |
|---|---|---|---:|
| Easy | ZIP balanced | Multiply balanced's bust-loss penalty by **4** | **47.3%** |
| Yolo | ZIP balanced | Multiply balanced's bust-loss penalty by **0.35** | **54.7%** |
| Standard | ZIP balanced | Original balanced penalty, **1** | **71.9%** |
| Hard candidate | Base-1.5 exponential board value, **no bonus** | Exact next-roll EV, **double bust-loss penalty** | **66.7%** |
| Expert candidate | Same board value, **+80 per column** | Exact next-roll EV, **double bust-loss penalty** | **67.8%** |

Easy banks almost everything: it busts on 0.7% of turns and rolls 2.10 times per turn. Yolo busts on 71.0% of turns and rolls 5.94 times per turn. Standard busts on 23.9% and rolls 3.72 times. These are genuinely different failure modes rather than random mistakes. Easy and Yolo retain the archive's rule of taking at least two throws unless banking wins.

Easy is the weakest recommended setting against the existing companion and against Standard in the second seed range: Easy wins 23.9% of games against Standard; Yolo wins 45.5%. This does not prove a universal weakest policy against every possible opponent.

I would use these three lower settings now, and treat the upper two as candidates pending a broader opponent/multiplayer evaluation. A win rate against one opponent does not define a global difficulty ranking: Standard beats the current companion more often than either board-value candidate, even though those candidates beat Standard head-to-head. Preserve these matchup differences in the decision rather than sorting a single win-rate column.

A stricter alternative Easy that always banks after its first successful throw won only **0.2%** against current. That is suitable for a deliberately trivial tutorial, but too weak for the ordinary Easy setting. Risk 0.25 for Yolo won 46.7%, almost tying Easy; 0.35 separates the personalities without making Yolo as strong as Standard. Risk 0.50 won 64.4% and was too competitive for the intended reckless beginner.

## How the unmodified proposal performs

Every percentage below comes from **500 seed IDs, each played in both seat orders: 1,000 games per matchup**.

| Policy | Versus current | Versus balanced, primary range | Versus balanced, second range |
|---|---:|---:|---:|
| Balanced | 71.9% | — | — |
| Board value, 0 bonus, exact EV | 56.7% | **50.0%** | **49.5%** |
| Board value, +80, exact EV | 58.0% | **54.5%** | **54.5%** |
| Board value, 0 bonus, 16 samples | 64.0% | **53.5%** | Not rerun |
| Board value, +80, 16 samples | 65.3% | **56.5%** | Not rerun |
| Board value, 0 bonus, double bust penalty | 66.7% | **52.9%** | **51.4%** |
| Board value, +80, double bust penalty | 67.8% | **55.8%** | **56.1%** |

Unmodified +80 also won **52.2%** directly against no-bonus. Its seed-clustered approximate 95% interval is 50.4–54.0%. This is a small advantage, not a large difficulty jump. No-bonus is effectively a different Standard-strength personality in these games, rather than an established Hard tier.

Both raw exact-EV board-value policies are much more reckless than their names suggest: they bust on **65.1%** and **68.7%** of turns against current. Exact enumeration makes the next-roll probability calculation exact; it does not make the heuristic board value a correct estimate of eventual winning chances. The exponential utility strongly rewards rare large advances. The +80 bonus increases the appeal of completing columns, but does not fix this stopping behavior.

The current companion favors existing progress and adds a small preference for columns 2/12, then banks at any summit or five steps at risk. Its baseline is the unchanged `chooseBot` at commit `97e125e`. It is neither the ZIP's balanced policy nor its board-value policy.

### Proposed cautious board-value adjustment

Let `S` be bank-now value, `B` bust value, `E` the exact expected best value after one more roll, and `q` the bust probability. The original rule continues when `E > S`. The adjusted rule continues when:

```text
E - S > (risk - 1) × q × (S - B)
```

Use `risk = 2` for the upper-level candidates. Pairing selection and the base-1.5 board utility are unchanged; Hard uses no column bonus and Expert uses 80. This reduces dependence on rare large payoffs and is fully deterministic. Against current, bust rates fall to **33.1%** for no-bonus and **44.3%** for +80.

**Adjusted validation:** in the second 500-seed range, no-bonus/risk-2 won **51.4%** against Standard, +80/risk-2 won **56.1%** against Standard, and +80/risk-2 won **54.1%** directly against no-bonus/risk-2. Pooling the two separately reported ranges gives **52.15%** and **55.95%** against Standard. This supports the ordering as a provisional setup, but Hard's advantage over Standard is small and its validation interval includes 50%.

The archive's alternative 16-sample implementation also improves results, but its choices depend on an extra sampling stream. Exact enumeration with an explicit risk adjustment is easier to reason about for a production companion. These adjustments are experiments in this PR, not changes to live games.

## Other ZIP AIs

| Strategy / recovered checkpoint | Wins against current |
|---|---:|
| Central-column heuristic | 70.0% |
| Short-column heuristic | 66.1% |
| Base-10 exponential heuristic | 48.7% |
| Scratch RL, neural pairing and stopping | 5.9% |
| Early imitation, neural pairing and stopping | 27.6% |
| Same imitation pairing, exact +80 stopping | 57.5% |
| Learned value model, exact +80 stopping | 68.1% |
| Self-play checkpoint, exact +80 stopping | 68.1% |
| Retried self-play checkpoint, exact +80 stopping | 68.6% |
| Oracle-trained checkpoint, exact +80 stopping | 68.0% |

The oracle-trained network uses ordinary current-board features here; it receives no future dice. The archive's actual clairvoyant agents are excluded from fair-play recommendations. Their historical scores cannot be compared with these fair companions.

The recovered models do not establish a reason to ship neural inference. The best observed score against current is still balanced's 71.9%, and several learned checkpoints behave almost identically. This comparison is not proof that balanced defeats every learned model head-to-head. The fixed-bonus sweep from 0 through 1,000 also gives no basis for treating larger bonuses as a difficulty ladder. See [all matchups and intervals](ALL_RESULTS.md).

## Method and limits

- Worktree: `../cantstop-ai-comparison`, branch `codex/ai-handoff-comparison`, based on `97e125effd969dfc74db89cdd436f855e2bc6d67`.
- ZIP SHA-256: `1922c659ba99da17815f89d02d268fe24ea7a0f6330b8b67bfb0c750fb48c623`.
- Primary IDs: **75,000,000–75,000,499**. Second range: **53,000,000–53,000,499**. The user authorized either range or fresh seeds. The prior application comparison was not present in the repository; this is a fresh controlled rerun using the archive's benchmark stream scheme, not a claim to recover unidentified historical results.
- Python `random.Random` seeded with BLAKE2b of `cantstop-v2:{gameId}:{seat}:{ownTurn}:dice`, exactly as in `cant_stop_shared_fate.py`. Each seat/turn has its own stream. Policies use the same stream in the same seat; changing how long a player rolls cannot consume their opponent's dice. Sampled variants independently use the matching `lookahead` stream.
- Each ID is played twice, exchanging policies between physical seats; the starting seat is `gameId % 2`. Both policies therefore start once per ID. Draws are not allowed: exceeding the stream/turn cap throws an error. No games were truncated or silently dropped.
- Production `pairings` and `apply` supply legal moves, advancement, banking, closure and wins. The offline runner supplies benchmark dice and alternates the two players. It does not write synthetic events, alter replay, or connect to persistence. Opening rolls are automatic in the harness.
- Exact evaluation weights the 126 sorted dice multisets by their multiplicities, totaling 1,296 ordered throws. Fair policies only see the current state and their own hypothetical lookahead samples, never actual future draws.
- Native pairing/variant order breaks ties. The Python archive uses set iteration in some places, so this is a controlled engine-native port, not a promise of byte-for-byte historical win counts. The board is a two-player game; no multiplayer ranking has been established.
- The production engine discards saved progress in closed columns. The offline runner retains a shadow of that progress solely to reproduce archived neural feature vectors. Closed columns remain illegal. Constant contributions from already-claimed columns do not affect heuristic choices.
- Neural checkpoint weights are exported with `torch.load(weights_only=True)`; Bun performs inference. Four probe vectors per model agree with PyTorch to maximum absolute error below `4e-7`. Double-precision Bun arithmetic can still resolve very close model ties differently from PyTorch float32.
- Twenty board fixtures agree with original Python code on legal successor sets, bust probabilities, board utilities, and exact stopping decisions. The unit tests also check dice multiplicities, closed/full-runner bust rules, legal actions, immediate-win banking, and passive/aggressive thresholds.
- Reported intervals cluster both seat orders by seed; they do not pretend the 1,000 games are independent seeds. They are normal-approximation, exploratory 95% intervals without a multiple-comparison correction. Primary-range tuning results need validation. The second range tests the selected configurations and is separate from the primary calibration.
- Historical neural results in the README have different versions, opponents, seed ranges, and sampled/exact stopping. They are not substituted for fresh results here. Every available distinct `.pt` checkpoint is evaluated; duplicate `_2` files are not separate strategies. Missing historical checkpoints cannot be reconstructed from CSV summaries.

## Reproduce

Use Bun from the repository root. Python's standard library is used only to reproduce the archive's dice stream; no Python packages are needed for heuristic comparisons.

```sh
bun install --frozen-lockfile
bun scripts/ai-comparison/run.ts
AI_POLICIES=balanced,board-0,board-80 AI_ROUND_ROBIN=1 AI_OUTPUT=/tmp/ai-head-to-head bun scripts/ai-comparison/run.ts
AI_SEED=53000000 AI_POLICIES=easy,yolo-035,board-0,board-80 AI_OPPONENTS=balanced AI_OUTPUT=/tmp/ai-validation bun scripts/ai-comparison/run.ts
```

`AI_GAMES` changes the number of seed IDs (default 500); each is still played in both orders. `AI_OUTPUT` holds `results.json` and one CSV row per game. Dice files are cached in `/tmp`; game outcomes and policy decisions are never cached. Running with an existing output directory replaces its results. Preserve supplied results before using that directory for a different experiment.

To evaluate neural checkpoints, create a temporary Python environment with PyTorch, then export from the original ZIP:

```sh
python3 -m venv /tmp/cantstop-ai-python
/tmp/cantstop-ai-python/bin/pip install torch
/tmp/cantstop-ai-python/bin/python scripts/ai-comparison/export-models.py /path/to/cant_stop_ai_complete_handoff.zip /tmp/cantstop-ai-models
bun scripts/ai-comparison/verify-models.ts
AI_POLICIES=imitation,imitation-exact,rl,value,selfplay,selfplay-retry,oracle AI_OUTPUT=/tmp/ai-neural bun scripts/ai-comparison/run.ts
```

`AI_MODEL_DIR` can override the checkpoint JSON directory. Model hashes are recorded in [manifest.json](manifest.json). To verify against the Python sources, extract the ZIP and run `bun scripts/ai-comparison/verify-reference.ts /path/to/artifacts`. Regenerate the checked-in aggregate table with `bun scripts/ai-comparison/report.ts` after the checked-in experiment batches are complete.

The `calibration` batch originally called its one-throw-minimum conservative trial `easy`; this is normalized to `cautious` in the data. The first `levels` round robin uses that same `cautious` trial, whereas the baseline and validation `easy` use the recommended two-throw minimum. The `refinements` always-bank-first trial is normalized to `one-roll`. These aliases were corrected without changing any measured outcomes.

Validation: type check, 60 unit tests, 3 Firebase emulator integration tests, production build, and the phone/create-companion/settings browser scenario pass. The normal Vite bundle-size advisory remains. No rendering or screenshot tolerances were changed.
