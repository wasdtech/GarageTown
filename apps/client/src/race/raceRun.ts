import {
  createRace,
  greenAtMs,
  type RaceCar,
  type RaceInput,
  type RaceResult,
  type RaceView,
  RACE_CAP_MS,
  RACE_TRACE_MS,
  simulateRace,
  type ShiftGrade,
} from '@gt/sim';
import { coastMeters } from './raceCamera';

export type Lights = ['off' | 'red', 'off' | 'red', 'off' | 'green'];

export interface RaceSnapshot {
  view: RaceView;
  rivalMeters: number;
  lights: Lights;
  /** set on the frame a shift was graded */
  graded: ShiftGrade | null;
  /** set on the frame a jumped start was detected */
  jumped: boolean;
  /** set on the frame the nitro kicked in */
  nitroFired: boolean;
  /** where your car is drawn: the race distance, then rolling past the line after the finish */
  youMeters: number;
  /** what the tachometer shows: the car's rpm, or the engine revved in place before the launch */
  rpm: number;
}

const IDLE_RPM = 1000;
const REV_RPM = 6000;
/** how fast the revs chase the pedal before the launch (ms to cover ~63% of the gap) */
const REV_LAG_MS = 120;

/**
 * One race being played: turns button presses into timed taps, steps the player's race in real
 * time and plays the rival from its precomputed run. The taps are what the store settles later.
 */
export class RaceRun {
  readonly greenAt: number;
  readonly inputs: RaceInput[] = [];
  private readonly race: ReturnType<typeof createRace>;
  private readonly rivalTrace: number[];
  private t = 0;
  private held = false;
  private released = false;
  private shiftsSeen = 0;
  private jumpSeen = false;
  private nitroSeen = false;
  private revs = IDLE_RPM;
  /** when and how fast each car crossed the line, for the roll-out after it */
  private youFinish: { t: number; speed: number } | null = null;
  private readonly rivalFinish: { t: number; speed: number };
  private view: RaceView;

  constructor(
    readonly seed: number,
    readonly car: RaceCar,
    rival: RaceCar,
    rivalInputs: RaceInput[],
  ) {
    this.greenAt = greenAtMs(seed);
    this.race = createRace(seed, car);
    this.rivalTrace = simulateRace(seed, rival, rivalInputs).trace;
    // the trace ends on the line; its last regular samples give the rival's speed there
    const n = this.rivalTrace.length;
    const v = n >= 3 ? (this.rivalTrace[n - 2]! - this.rivalTrace[n - 3]!) / (RACE_TRACE_MS / 1000) : 0;
    this.rivalFinish = { t: (n - 1) * RACE_TRACE_MS, speed: Math.max(0, v) };
    this.view = this.race.advance(0);
  }

  get time(): number {
    return this.t;
  }

  get finished(): boolean {
    return this.view.phase === 'finished';
  }

  private tap(kind: RaceInput['kind']) {
    const i: RaceInput = { kind, t: this.t };
    this.inputs.push(i);
    this.race.input(i);
  }

  /** The car has left: launched by the player, or on its own when they never let go. */
  private get departed(): boolean {
    return this.released || this.view.phase !== 'countdown';
  }

  /** Go button pressed: before leaving it is held; afterwards each press is a gear change. */
  goDown() {
    if (this.finished) return;
    if (!this.departed) this.held = true;
    else this.tap('shift');
  }

  /** Go button released: the launch (a jumped start if the light is not green yet). */
  goUp() {
    if (this.finished || this.departed) return;
    if (this.held || this.t >= this.greenAt) {
      this.released = true;
      this.tap('release');
    }
  }

  nitro() {
    if (this.departed && !this.finished) this.tap('nitro');
  }

  lights(): Lights {
    if (this.t >= this.greenAt) return ['off', 'off', 'green'];
    return this.t >= this.greenAt / 2 ? ['red', 'red', 'off'] : ['red', 'off', 'off'];
  }

  /** Advances the race by `dtMs` of real time. */
  frame(dtMs: number): RaceSnapshot {
    const speedBefore = this.view.speed;
    this.t = Math.min(RACE_CAP_MS, this.t + dtMs);
    this.view = this.race.advance(this.t);
    if (!this.youFinish && this.view.phase === 'finished') {
      this.youFinish = { t: this.t, speed: Math.max(speedBefore, this.view.speed) };
    }
    // before the launch, holding the button revs the engine in place (a little wobble on the limiter)
    const target = this.held ? REV_RPM + 300 * Math.sin(this.t / 45) : IDLE_RPM;
    this.revs += (target - this.revs) * Math.min(1, dtMs / REV_LAG_MS);
    return this.snapshot();
  }

  /** Finishes at once with the given taps (used to settle a race played elsewhere, and in tests). */
  runInstant(inputs: RaceInput[]): RaceSnapshot {
    for (const i of inputs) {
      this.inputs.push(i);
      this.race.input(i);
    }
    this.released = true;
    this.t = RACE_CAP_MS;
    this.view = this.race.advance(RACE_CAP_MS);
    return this.snapshot();
  }

  result(): RaceResult {
    return this.race.result();
  }

  private snapshot(): RaceSnapshot {
    let graded: ShiftGrade | null = null;
    // a new gear change was graded since the last frame
    if (this.view.shiftCount > this.shiftsSeen) {
      graded = this.view.lastShift;
      this.shiftsSeen = this.view.shiftCount;
    }
    let jumped = false;
    const release = this.inputs.find((i) => i.kind === 'release');
    if (!this.jumpSeen && release && release.t < this.greenAt) {
      jumped = true;
      this.jumpSeen = true;
    }
    const nitroFired = this.view.nitroUsed && !this.nitroSeen;
    if (nitroFired) this.nitroSeen = true;
    const idx = Math.min(this.rivalTrace.length - 1, Math.floor(this.t / RACE_TRACE_MS));
    const rf = this.rivalFinish;
    const rivalMeters =
      this.t > rf.t
        ? this.rivalTrace[this.rivalTrace.length - 1]! + coastMeters(rf.speed, this.t - rf.t)
        : this.rivalTrace[idx]!;
    const yf = this.youFinish;
    const youMeters = this.view.meters + (yf ? coastMeters(yf.speed, this.t - yf.t) : 0);
    return {
      view: this.view,
      rivalMeters,
      youMeters,
      lights: this.lights(),
      graded,
      jumped,
      nitroFired,
      rpm: this.view.phase === 'countdown' ? Math.round(this.revs) : this.view.rpm,
    };
  }
}
