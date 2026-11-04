# Arrancada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drag-race mode with a 5-track league (Bronze/Silver/Gold medals, beat the rival to unlock the next track) and daily street-race bets. The race is played with launch, shift and nitro taps on an isometric track.

**Architecture:**
- **Physics:** a pure, deterministic simulation in `packages/sim/src/race.ts`, stepped every 10 ms. It drives both the live client (stepper) and the authoritative action (full re-run from the same taps).
- **League rules:** league, street races and save v6 live in `packages/sim/src/league.ts`.
- **Client:** adds a "race" menu, a `RaceScene` (Phaser) and a DOM HUD.

**Tech Stack:** TypeScript 5.9, zod, Vitest 5, Phaser 3.90 with a DOM UI, Playwright 1.63, SpriteCook for the art.

**Spec:** `docs/superpowers/specs/2026-11-04-arrancada-design.md`

## Global Constraints

- **Track and timing:** 400 m; 10 ms integration step; the green light comes between 1,500 and 3,000 ms (from the seed). A false start costs +1,000 ms. With no `release`, the car leaves 2,000 ms after green. Race time = from green to 400 m + reaction + penalty. A race is capped at 60,000 ms (`finished: false`).
- **Launch spin:** in the first 500 ms after leaving, acceleration is multiplied by `min(1, 0.7 + grip/400)`.
- **Engine:** `vmax = 45 + 0.25·power` m/s. Gear limits are `vmax·[0.35, 0.60, 0.82, 1.00]`. Base acceleration is `[9.0, 6.0, 4.0, 2.6] m/s² · (0.6 + power/100)`. `rpm = 1000 + 7000·v/limit`. At the 8,000 rpm limiter the car stops accelerating.
- **Shift grades:**
  - The green band is centred at 7,000 rpm, with total width `600 + 6·grip`.
  - perfect: within 30% of the half-width; good: inside the band; bad: outside it.
  - Shift time: perfect 100 ms, good 250 ms, bad 600 ms. A perfect shift also gives +15% acceleration for 500 ms.
  - No acceleration while shifting. A shift in 4th gear, or before leaving, is ignored.
- **Nitro:** one use per race, +40% acceleration for 2,000 ms, only after leaving.
- **Rival inputs:**
  - reaction `350 − 250·skill` ms;
  - shift at rpm `7000 + err`, with `err` uniform in ±`(1 − skill)·halfWidth·1.6`;
  - nitro at the start of 3rd gear.
- **Street races:**
  - Unlocked after beating the rival of `bairro`.
  - Stakes `[50, 150, 400]·(1 + level/5)`, floored.
  - The rival's PI is 90–110% of the player's, with skill 0.4–0.8.
  - A win pays 2×, a tie refunds, a loss pays nothing.
  - Limit: 5 per rolling 24 h.
- **State v6:** `race: { medals: Record<string, 0|1|2|3>; beaten: string[]; rachas: number[]; count: number }`. The v5 → v6 migration starts at `{ medals: {}, beaten: [], rachas: [], count: 0 }`.
- **Errors:** `locked`, `unknown_track`, `no_coins`, `rate_limited`. Race prizes are added to `prestige.runCoins`.
- **UI copy:** Portuguese, in `strings.ts`. Coins written as 🪙 in strings (the `h()` helper draws the coin).
- **Test IDs:**
  - `menu-race`, `track-<key>`, `race-<key>`, `racha-0|1|2`, `rachas-left`;
  - `race-hud`, `race-go`, `race-nitro`, `race-result`, `race-medal`, `race-again`, `race-back`.

## Review Focus

1. **Taps outside the rules:** many fast taps, a tap during a shift, nitro before leaving, or a release tap twice. The simulation must ignore the extras and stay deterministic. Task 1 test: `ignores extra and early taps`.
2. **Leaving or reloading mid-race.** No coins are charged or paid for the league. For a street race, the stake is only taken when the race is finished, as one atomic action. Task 4 test: `a street race charges and pays in one action`.
3. **A tie with the rival** in the league counts as not beaten; in a street race it refunds the stake. Task 4 test: `a tie does not unlock and refunds a street race`.
4. **Changing the showcase car between setup and finish.** The finish action re-runs with the car in the state, and the live view is cosmetic. Task 4 test: `finish uses the showcase car in the state`.
5. **A player who keeps the button held and never releases.** The car leaves 2,000 ms after green and the race still ends. Task 1 test: `no release leaves 2 s after green`.

---

### Task 1: Race physics

**Files:**
- Create: `packages/sim/src/race.ts`
- Modify: `packages/sim/src/index.ts` (export it)
- Test: `packages/sim/test/race.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RaceInput = { kind: 'release' | 'shift' | 'nitro'; t: number }; // t: ms since countdown start
  export type ShiftGrade = 'perfect' | 'good' | 'bad';
  export interface RaceCar { power: number; grip: number }
  export interface RaceView { t: number; meters: number; speed: number; gear: 1|2|3|4; rpm: number;
    phase: 'countdown' | 'running' | 'shifting' | 'finished'; nitroLeftMs: number; nitroUsed: boolean; lastShift: ShiftGrade | null }
  export interface RaceResult { timeMs: number; reactionMs: number; falseStart: boolean; shifts: ShiftGrade[];
    trace: number[]; finished: boolean } // trace: metres every 50 ms from countdown start
  export function greenAtMs(seed: number): number
  export function greenBand(grip: number): { lo: number; hi: number; perfectLo: number; perfectHi: number }
  export function createRace(seed: number, car: RaceCar): { input(i: RaceInput): void; advance(toMs: number): RaceView; result(): RaceResult }
  export function simulateRace(seed: number, car: RaceCar, inputs: RaceInput[]): RaceResult
  export function rivalInputs(seed: number, rival: RaceCar & { skill: number }): RaceInput[]
  export function scriptInputs(seed: number, car: RaceCar, p: { reactionMs: number; shiftRpm: 'center' | 'goodEdge' | number; nitroGear?: 2|3|4 }): RaceInput[]
  ```
  - `scriptInputs` builds inputs by stepping the race and tapping at the given rpm. `goodEdge` means `center + 0.6·halfWidth`, which grades as good.
  - `simulateRace` = `createRace`, then feed the inputs in time order, then `advance` to the cap.

- [ ] **Step 1: Failing tests** in `race.test.ts`:
  - `same inputs give the same result`: two runs deep-equal.
  - `green comes between 1.5 and 3 s`: true over seeds 1..200.
  - `a false start adds 1000 ms`: release at `greenAt − 100` versus at `greenAt + 0` with the same shifts. The difference is ≈ 1000 ± 15 ms, and `falseStart` is true.
  - `no release leaves 2 s after green` (Review Focus 5): it finishes, and `reactionMs === 2000`.
  - `shift grades follow the band`: tap at center → perfect; at `center + 0.6·half` → good; at 1000 rpm above `hi` → bad.
  - `more grip widens the band`: the width at grip 120 is greater than at grip 40.
  - `more power is faster with the same taps`.
  - `perfect beats good beats bad` (scripted shifts, same car).
  - `nitro only once`: two nitro taps give the same time as one.
  - `the limiter holds the car without a shift`: with no shift taps, it does not finish under 60 s, or its 1st-gear speed ≤ the 1st limit.
  - `ignores extra and early taps` (Review Focus 1): a shift before release, nitro before release, and 3 shifts within 50 ms produce the same result as the clean inputs.
- [ ] **Step 2: Run the tests.** `pnpm exec vitest run packages/sim/test/race.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** with the Global Constraints formulas.
  - Seed draws use `nextRandom` from `state.ts`.
  - `rivalInputs` taps at the rpm with `err` drawn from the seed (rival seed = `seed ^ 0x9e3779b9`).
- [ ] **Step 4: Run the tests.** Same command → PASS; then `pnpm test`.
- [ ] **Step 5: Commit.** `feat(sim): drag race physics - launch, shift grades, nitro, deterministic replay`

### Task 2: Race content

**Files:**
- Create: `content/race.json`
- Modify: `packages/shared/src/content.ts` (`RaceSchema`, `Content.race`, `export type TrackDef`)
- Test: `packages/shared/test/content.test.ts`

**Interfaces:**
- Produces:
  ```ts
  c.race: {
    tracks: { key; name; pi; rival: { name; car; power; grip; skill }; medals: { bronze; silver; gold }; rewards: { coins: [n, n, n]; xp } }[];
    rachas: { stakes: [50, 150, 400]; perDay: 5; windowMs: 86_400_000; unlockTrack: 'bairro' };
  }
  ```

- [ ] **Step 1: Failing test** `race content has five tracks in order`. The keys are `['bairro','avenida','porto','autodromo','final']`. Each track has `bronze > silver > gold > 0`, a rival car that exists in `c.cars`, and skill in [0, 1]. Also test that the schema rejects `gold >= silver`.
- [ ] **Step 2: Run the test.** `pnpm exec vitest run packages/shared` → FAIL.
- [ ] **Step 3: Implement.**
  - Values come from spec B1: PI, rival power/grip/skill, coins `[100, 200, 400]` … `[4000, 8000, 16000]`, XP 20/40/80/150/300.
  - Rival cars: `pitoco`, `pitoco`, `brutus_v8`, `corisco_rs`, `corisco_rs`.
  - Placeholder medal times `{ bronze: 30000, silver: 28000, gold: 26000 }`, which Task 5 calibrates.
- [ ] **Step 4: Run the test.** Same command → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit.** `feat(content): drag race league tracks and street race config`

### Task 3: State v6

**Files:**
- Modify: `packages/sim/src/state.ts` (`Race` interface; `GameState.version: 6`; `createInitialState` sets the empty race)
- Modify: `packages/sim/src/save.ts` (v6 schema, v5 → v6 migration, track check)
- Modify: `packages/sim/src/prestige.ts`. `openBranch` keeps `race` (medals, beaten, count). **Ruling for the executor:** the spec is silent; a new branch resets the garage, not the trophy cabinet, so `race` is kept like `collection`.
- Test: `packages/sim/test/save.test.ts`, `packages/sim/test/prestige.test.ts`

- [ ] **Step 1: Failing tests:**
  - `a v5 save migrates to v6 with an empty race record`.
  - `a medal outside 0-3 is corrupt`.
  - `unknown tracks are dropped from medals and beaten`.
  - `opening a branch keeps medals`.
- [ ] **Step 2: Run the tests.** `pnpm exec vitest run packages/sim/test/save.test.ts packages/sim/test/prestige.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Bump every `version: 5` assertion in sim tests to 6. The e2e seeds stay v3/v4/v5 (they migrate).
- [ ] **Step 4: Run the tests.** `pnpm test` → PASS.
- [ ] **Step 5: Commit.** `feat(sim): state v6 with the race record; v5 saves migrate`

### Task 4: League and street races

**Files:**
- Create: `packages/sim/src/league.ts`
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/test/league.test.ts`

**Interfaces:**
- Consumes: Task 1 (`simulateRace`, `rivalInputs`, `greenAtMs`), Task 2 (`c.race`), Task 3 (`s.race`), and `carStats` from `cars.ts`.
- Produces:
  ```ts
  export type RaceTarget = { track: string } | { racha: 0 | 1 | 2 };
  export type RaceError = 'locked' | 'unknown_track' | 'no_coins' | 'rate_limited';
  export function raceSeed(s: GameState): number   // (s.rngState ^ Math.imul(s.race.count + 1, 0x9e3779b1)) >>> 0
  export function trackUnlocked(c: Content, s: GameState, key: string): boolean
  export function rachaStake(c: Content, s: GameState, i: 0|1|2): number
  export function rachasLeft(c: Content, s: GameState, now: number): number
  export function raceSetup(c: Content, s: GameState, target: RaceTarget, now: number):
    Result<{ seed: number; greenAt: number; car: RaceCar; rival: { name: string; car: string; power: number; grip: number; skill: number }; rivalInputs: RaceInput[] }, RaceError>
  export interface RaceOutcome { player: RaceResult; rival: RaceResult; won: boolean; tie: boolean;
    medal: 0|1|2|3; newMedal: boolean; coins: number; xp: number; stake: number }
  export function finishRace(c: Content, s: GameState, target: RaceTarget, inputs: RaceInput[], now: number):
    Result<{ state: GameState; outcome: RaceOutcome }, RaceError>
  ```
  - The street-race rival comes from the seed: power and grip chosen so that PI = `2·(power + grip)` is 90–110% of the player's PI, the car drawn from `c.cars`, and skill 0.4–0.8.
  - `finishRace` ticks first, then:
    1. re-runs the player with the showcase car's `carStats`;
    2. re-runs the rival;
    3. grades the medal against the track goals (time ≤ goal);
    4. pays the not-yet-owned medal tiers once;
    5. adds the track to `beaten` on a strict win;
    6. for a street race: checks the coins (`no_coins`) and the limit (`rate_limited`) first, charges the stake and pays `2×stake` / refunds / nothing in the same state change, and records `now` in `rachas`;
    7. increments `race.count` and adds the coins to `runCoins` through the existing reward path (or directly);
    8. calls `touch`.

- [ ] **Step 1: Failing tests** in `league.test.ts`:
  - `only the first track is open at first; beating its rival opens the next`.
  - `a medal pays once, lower tiers included`: gold first time pays bronze + silver + gold; a second gold pays 0.
  - `a tie does not unlock and refunds a street race` (Review Focus 3): build a tie by giving the player the rival's inputs and stats.
  - `street races unlock after beating bairro`.
  - `a street race charges and pays in one action` (Review Focus 2): a win gives `coins + stake`; a loss gives `coins − stake`; with no coins it fails with `no_coins` and the state is unchanged.
  - `five street races per 24 h`: the sixth fails with `rate_limited`; after 24 h it is allowed.
  - `finish uses the showcase car in the state` (Review Focus 4): a better car gives a faster time with the same inputs.
  - `race prizes count toward runCoins`.
  - `race count advances so each race gets a new seed`.
- [ ] **Step 2: Run the tests.** `pnpm exec vitest run packages/sim/test/league.test.ts` → FAIL.
- [ ] **Step 3: Implement** `league.ts` with the signatures above.
- [ ] **Step 4: Run the tests.** Same command → PASS; `pnpm test`.
- [ ] **Step 5: Commit.** `feat(sim): drag race league with medals, rival unlocks and daily street races`

### Task 5: Calibration of medal goals

**Files:**
- Modify: `content/race.json` (medal ms and rival stats only)
- Test: `packages/sim/test/raceBalance.test.ts`

**Interfaces:**
- Consumes: `simulateRace`, `scriptInputs`, `rivalInputs` and `c.race`.
- Definitions (test helpers):
  - `carOfPi(pi) = { power: pi/4, grip: pi/4 }`;
  - average player: `{ reactionMs: 300, shiftRpm: 'goodEdge', nitroGear: 3 }`;
  - optimal player: `{ reactionMs: 150, shiftRpm: 'center', nitroGear: 3 }`.
  
  Times are averaged over seeds 1..20.

- [ ] **Step 1: Failing tests:**
  - `average player with the recommended car makes bronze on every track`;
  - `optimal player with the recommended car makes silver but not gold`;
  - `optimal player with a car 15% above makes gold`;
  - `the average player with the recommended car beats the rival on bairro and avenida`;
  - `skill is worth about 40%`: (average − optimal) time on the same car is between 0.6× and 1.6× the gap between `carOfPi(pi)` and `carOfPi(pi·1.3)` with the optimal player.
- [ ] **Step 2: Run the tests.** `pnpm exec vitest run packages/sim/test/raceBalance.test.ts` → FAIL (placeholder times).
- [ ] **Step 3: Calibrate.**
  - Write a throwaway script, or a skipped report test, that prints the average/optimal times per track.
  - Set `bronze = ceil(avg_rec + 150 ms)`, `silver = ceil(opt_rec + 100 ms)` and `gold = ceil(opt_115 + 50 ms)`, all rounded up to 10 ms.
  - Adjust rival skill or stats only if the "beats the rival" test fails.
  - Ledger every number change as a Ruling.
- [ ] **Step 4: Run the tests.** Same command → PASS; `pnpm test`.
- [ ] **Step 5: Commit.** `feat(content): calibrated drag race medal times and rivals`

### Task 6: Race art

**Files:**
- Create:
  - `art/generated/race/*.png`
  - `art/src/ui/race.png`, `art/src/ui/medal_bronze.png`, `medal_silver.png`, `medal_gold.png`
  - `art/src/race/lights.png`, `art/src/race/finish.png`, `art/src/race/stands.png`
- Modify: `art/spritecook-assets.json`

- [ ] **Step 1: Generate** with SpriteCook (`generate_game_art`, `pixel: false`, `mode: 'ui'` for the icons and `'assets'` for the props).
  - Style references: `464f5b97-f922-4052-94cb-a31fe06ad380`, `5c3441e0-966f-4e3b-a5f4-6b49ae47b649`, `7c0570fe-b225-44a5-b365-ab4d11e8d159`.
  - Images:
    - the 🏁 icon (checkered flag);
    - bronze, silver and gold medals;
    - a vertical traffic light with three lamps, off;
    - an isometric checkered finish gantry;
    - a small isometric grandstand with flags.
  - Roughly 8 jobs and ≤ 100 credits. Check the balance first.
- [ ] **Step 2: Fit.** Icons with `tools/fit_ui_icon.py` (96 px). Props at 2× of their on-screen size with premultiplied downscale.
- [ ] **Step 3: Verify.** Each file opens, has a transparent background, and its sha12 is recorded in the manifest.
- [ ] **Step 4: Commit.** `art: drag race icons, medals, traffic light, finish gantry and grandstand`

### Task 7: Race menu (client)

**Files:**
- Create: `apps/client/src/ui/raceTab.ts`
- Modify:
  - `apps/client/src/ui/garageSheet.ts` (`Menu` adds `'race'`; tone `race` `#2b2d42` with white ink; `opts.onRace(target)`);
  - `apps/client/src/main.ts` (5th bar button `menu-race` with icon `race`);
  - `apps/client/src/ui/icon.ts` (`race`, `medal_bronze|silver|gold`);
  - `apps/client/src/state/store.ts` (`raceSetup(target)` and `finishRace(target, inputs)`, the second committing the state and returning the outcome);
  - `apps/client/src/ui/strings.ts` (`S.race.*`);
  - `apps/client/src/ui/theme.css`.
- Test: `apps/client/test/raceTab.test.ts` (pure helpers)

**Interfaces:**
- Produces: `trackCard(c, s, key)`, a pure function returning `{ unlocked: boolean; medals: [boolean, boolean, boolean]; piYours: number; piTarget: number }`, used by the tab and the tests.
- Copy:
  - title `Arrancada`;
  - `Correr`;
  - `PI recomendado ${n}` and `Seu PI ${n}`;
  - `Vença o rival anterior`;
  - `Rachas`;
  - `${n} de 5 hoje`;
  - `Vença a Rua do Bairro para liberar`;
  - stake buttons `Pequena · ${v} 🪙`, `Média · ${v} 🪙` and `Grande · ${v} 🪙`;
  - errors `locked` → `Pista travada`, `unknown_track` → `Pista desconhecida`, `rate_limited` → `Chega de racha por hoje — volte amanhã` (the `no_coins` text already exists).

- [ ] **Step 1: Failing test** `trackCard`: in a fresh state, `bairro` is unlocked and `avenida` is locked; with the bairro medal at 2, `medals` is `[true, true, false]`.
- [ ] **Step 2: Run the test.** `pnpm exec vitest run apps/client/test/raceTab.test.ts` → FAIL.
- [ ] **Step 3: Implement** the tab: track tiles (rival car thumbnail via `drawCarPreview`, medals, PI, the `race-<key>` button) and the street-race card (3 stake buttons, `rachas-left`). Picking a target closes the sheet and calls `opts.onRace(target)`.
- [ ] **Step 4: Run the test.** Same command → PASS; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit.** `feat(client): race menu - league tracks with medals and street race bets`

### Task 8: Race scene and HUD

**Files:**
- Create:
  - `apps/client/src/scenes/RaceScene.ts`;
  - `apps/client/src/ui/raceHud.ts` (DOM: traffic light, tachometer canvas, gear, go button, nitro button, result panel);
  - `apps/client/src/ui/tach.ts` (pure geometry).
- Modify:
  - `apps/client/src/main.ts`: register `RaceScene`; `onRace` starts it, pauses the garage scene and hides the bar and HUD. The test hook `__gt.race = { run(inputs: RaceInput[]): void }` finishes the current race instantly with scripted inputs (test mode only).
  - `apps/client/src/ui/sfx.ts`: `rev(rpm)`, `beep(go: boolean)`, `nitro()`, `medal()`.
  - `strings.ts`, `theme.css`.
- Test: `apps/client/test/tach.test.ts`

**Interfaces:**
- Consumes:
  - `createRace`, `greenAtMs` and `greenBand` (Task 1);
  - `store.raceSetup` and `store.finishRace` (Task 7);
  - the art from Task 6.
- Produces: `tachAngle(rpm: number): number`, which maps 1,000..8,000 rpm onto −120°..+120° (the `greenBand` arcs use the same mapping).
- **Behaviour:**
  - The scene steps `createRace` with real time (`advance(elapsed)`) for the player.
  - The rival's position comes from its precomputed `simulateRace` trace.
  - The camera follows the leader; the cars move along an isometric strip of `LOT_SIZE`-style tiles plus props.
  - Go button: hold before green (pointerdown) and release (pointerup) sends `release`; afterwards each press sends `shift`. Space mirrors the go button, N fires the nitro.
  - Each grade shows a float text "Perfeita!" / "Boa" / "Ruim". A false start shows "Queimou! +1 s".
  - At the finish:
    1. call `store.finishRace(target, inputs)`;
    2. show the result panel (your time vs the rival's, the medal with confetti and `sfx.medal()`, coins and XP, "Correr de novo" and "Voltar à oficina");
    3. "Voltar" stops the scene and resumes the garage.
  - Leaving mid-race (Esc or the ✕ in the HUD) charges nothing.

- [ ] **Step 1: Failing tests** `tachAngle`: 1000 → −120; 8000 → 120; 4500 → 0. It clamps outside the range.
- [ ] **Step 2: Run the tests.** `pnpm exec vitest run apps/client/test/tach.test.ts` → FAIL.
- [ ] **Step 3: Implement** the scene, HUD, sounds and test hook as described.
- [ ] **Step 4: Run the tests.** Same command → PASS; `pnpm test && pnpm typecheck && pnpm lint`. Take desktop and mobile screenshots of the countdown, mid-race and result, and fix any layout overlap with the menu bar (hidden during the race).
- [ ] **Step 5: Commit.** `feat(client): drag race scene - isometric strip, traffic light, tachometer, shifts, nitro, result`

### Task 9: E2E

**Files:**
- Create: `apps/client/e2e/race.spec.ts`

- [ ] **Step 1: Write the specs.**
  - `race the first track and win a medal`:
    - Seed a v5 save with the gift car and parts for PI ≈ 200.
    - Open `menu-race`, click `race-bairro`, and see `race-hud`.
    - Run `__gt.race.run(scriptInputs(...optimal))`. `scriptInputs` is exposed on `__gt` in test mode, along with the setup seed and car.
    - Expect `race-result` to be visible, `race-medal` to show a medal, the coins to increase, and no page errors.
    - `race-back` returns to the garage with the bar visible.
  - `the next track is locked until the rival is beaten`: `race-avenida` is disabled at first.
  - `a street race takes the stake and pays a win`: seed bairro beaten and 1,000 coins, run `racha-0` with optimal inputs against the seeded rival, and the coins change by +stake or −stake according to the outcome shown.
  - `holding and releasing the go button starts the race`: press `race-go`, wait for green, release, and the HUD phase becomes running (the speed text is > 0 after 500 ms).
- [ ] **Step 2: Run the specs.** Build in test mode, then `CI=1 pnpm exec playwright test race.spec.ts`. They fail before Tasks 7–8 are wired. If those are already done, verify by breaking `finishRace` in the store, then restore it.
- [ ] **Step 3: Run the full suite.** `CI=1 pnpm e2e` → all pass.
- [ ] **Step 4: Commit.** `test(e2e): drag race league, locked track, street race, live launch`
