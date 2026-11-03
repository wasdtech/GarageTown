import type { BayType, Content, JobKey } from '@gt/shared';
import {
  type AssignError,
  assignHelper,
  buyClock,
  type BranchError,
  buyPerk,
  openBranch,
  type PerkError,
  clearIdleReport,
  type HireError,
  hireHelper,
  type TrainError,
  trainHelper,
  applyLook,
  type BuyCarError,
  type BuyPartError,
  buyCar,
  buyPart,
  type CarLook,
  type LookError,
  setActiveCar,
  type BuildError,
  collectJob,
  type CollectError,
  completeWithMinigame,
  type GameState,
  type MinigameError,
  type Result,
  type Reward,
  startBuild,
  touch,
  startJob,
  type StartError,
  tick,
} from '@gt/sim';

const AUTOSAVE_MS = 5_000;

/** Holds the game state; the only place the client mutates it. */
export class Store {
  private s: GameState;
  private subs = new Set<(s: GameState) => void>();
  private lastSave: number;

  constructor(
    private readonly c: Content,
    initial: GameState,
    private readonly clock: () => number,
    private readonly persist: (s: GameState) => void,
  ) {
    this.s = initial;
    this.lastSave = clock();
  }

  get state(): GameState {
    return this.s;
  }

  subscribe(fn: (s: GameState) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private commit(next: GameState, save: boolean) {
    this.s = next;
    if (save) this.save();
    for (const fn of this.subs) fn(next);
  }

  save() {
    this.lastSave = this.clock();
    this.persist(this.s);
  }

  tick(): void {
    const now = this.clock();
    this.commit(tick(this.c, this.s, now), now - this.lastSave >= AUTOSAVE_MS);
  }

  start(a: { customerId: string; bayId: string; jobKey: JobKey }): Result<GameState, StartError> {
    const r = startJob(this.c, this.s, a, this.clock());
    if (r.ok) this.commit(r.value, true);
    return r;
  }

  collect(bayId: string): Result<Reward, CollectError> {
    const r = collectJob(this.c, this.s, bayId, this.clock());
    if (!r.ok) return r;
    this.commit(r.value.state, true);
    return { ok: true, value: r.value.reward };
  }

  build(slot: number, type: BayType): Result<void, BuildError> {
    const r = startBuild(this.c, this.s, { slot, type }, this.clock());
    if (!r.ok) return r;
    this.commit(r.value, true);
    return { ok: true, value: undefined };
  }

  /** Runs a pure garage action and commits it when it succeeds. */
  private act<E extends string>(r: Result<GameState, E>): Result<void, E> {
    if (!r.ok) return r;
    this.commit(r.value, true);
    return { ok: true, value: undefined };
  }

  buyCar(model: string): Result<void, BuyCarError> {
    return this.act(buyCar(this.c, this.s, model, this.clock()));
  }

  setActiveCar(carId: string): Result<void, 'unknown_car'> {
    return this.act(setActiveCar(this.s, carId));
  }

  buyPart(carId: string, part: string): Result<void, BuyPartError> {
    return this.act(buyPart(this.c, this.s, { carId, part }, this.clock()));
  }

  applyLook(carId: string, look: Partial<CarLook>): Result<void, LookError> {
    return this.act(applyLook(this.c, this.s, { carId, ...look }, this.clock()));
  }

  hireHelper(key: string): Result<void, HireError> {
    return this.act(hireHelper(this.c, this.s, key, this.clock()));
  }

  trainHelper(key: string): Result<void, TrainError> {
    return this.act(trainHelper(this.c, this.s, key, this.clock()));
  }

  assignHelper(key: string, bayId: string | null): Result<void, AssignError> {
    return this.act(assignHelper(this.c, this.s, key, bayId, this.clock()));
  }

  buyClock(): Result<void, 'maxed' | 'no_coins'> {
    return this.act(buyClock(this.c, this.s, this.clock()));
  }

  openBranch(): Result<{ seals: number }, BranchError> {
    const r = openBranch(this.c, this.s, this.clock());
    if (!r.ok) return r;
    this.commit(r.value.state, true);
    return { ok: true, value: { seals: r.value.seals } };
  }

  buyPerk(key: string): Result<void, PerkError> {
    return this.act(buyPerk(this.c, this.s, key, this.clock()));
  }

  clearIdleReport(): void {
    this.commit(clearIdleReport(this.s), true);
  }

  /** The player is looking at the game: keep the helpers' shift going and drop in-session work from the report. */
  present(): void {
    const now = this.clock();
    this.commit(clearIdleReport(touch(tick(this.c, this.s, now), now)), false);
  }

  minigame(bayId: string, gestureMs: number): Result<Reward, MinigameError> {
    const r = completeWithMinigame(this.c, this.s, bayId, gestureMs, this.clock());
    if (!r.ok) return r;
    this.commit(r.value.state, true);
    return { ok: true, value: r.value.reward };
  }
}
