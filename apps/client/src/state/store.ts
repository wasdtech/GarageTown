import type { Content, JobKey } from '@gt/shared';
import {
  collectJob,
  type CollectError,
  completeWithMinigame,
  type GameState,
  type MinigameError,
  type Result,
  type Reward,
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

  minigame(bayId: string, gestureMs: number): Result<Reward, MinigameError> {
    const r = completeWithMinigame(this.c, this.s, bayId, gestureMs, this.clock());
    if (!r.ok) return r;
    this.commit(r.value.state, true);
    return { ok: true, value: r.value.reward };
  }
}
