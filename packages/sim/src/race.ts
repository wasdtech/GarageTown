import { nextRandom } from './state';

/** A player's tap. `t` is in ms since the countdown started. */
export type RaceInput = { kind: 'release' | 'shift' | 'nitro'; t: number };
export type ShiftGrade = 'perfect' | 'good' | 'bad';
export interface RaceCar {
  power: number;
  grip: number;
}
export interface RaceView {
  t: number;
  meters: number;
  speed: number;
  gear: 1 | 2 | 3 | 4;
  rpm: number;
  phase: 'countdown' | 'running' | 'shifting' | 'finished';
  nitroLeftMs: number;
  nitroUsed: boolean;
  lastShift: ShiftGrade | null;
}
export interface RaceResult {
  timeMs: number;
  reactionMs: number;
  falseStart: boolean;
  shifts: ShiftGrade[];
  /** metres every 50 ms from the countdown start; the last sample is the finish */
  trace: number[];
  finished: boolean;
}

export const RACE_LENGTH_M = 400;
export const RACE_STEP_MS = 10;
export const RACE_TRACE_MS = 50;
export const RACE_CAP_MS = 60_000;
export const FALSE_START_MS = 1000;
export const NO_RELEASE_MS = 2000;
const LAUNCH_MS = 500;
const GEAR_SPEED = [0.35, 0.6, 0.82, 1.0];
const GEAR_ACCEL = [9.0, 6.0, 4.0, 2.6];
const RPM_IDLE = 1000;
const RPM_SPAN = 7000;
export const RPM_MAX = RPM_IDLE + RPM_SPAN;
export const RPM_CENTER = 7000;
const SHIFT_MS: Record<ShiftGrade, number> = { perfect: 100, good: 250, bad: 600 };
const PERFECT_BOOST = 1.15;
const PERFECT_BOOST_MS = 500;
const NITRO = 1.4;
const NITRO_MS = 2000;

/** When the light turns green: 1.5 to 3 s after the countdown starts, from the seed. */
export function greenAtMs(seed: number): number {
  const [r] = nextRandom(seed >>> 0);
  return 1500 + Math.floor(r * 1501);
}

/** The tachometer's green band: total width 600 + 6·grip rpm around 7000; perfect is the middle 30%. */
export function greenBand(grip: number): { lo: number; hi: number; perfectLo: number; perfectHi: number } {
  const half = (600 + 6 * grip) / 2;
  const p = 0.3 * half;
  return {
    lo: RPM_CENTER - half,
    hi: RPM_CENTER + half,
    perfectLo: RPM_CENTER - p,
    perfectHi: RPM_CENTER + p,
  };
}

function grade(grip: number, rpm: number): ShiftGrade {
  const b = greenBand(grip);
  if (rpm >= b.perfectLo && rpm <= b.perfectHi) return 'perfect';
  if (rpm >= b.lo && rpm <= b.hi) return 'good';
  return 'bad';
}

/**
 * A race stepped in fixed 10 ms ticks. Taps are applied at the first tick at or after their time;
 * taps the rules don't allow (shift before leaving or while shifting, a second nitro, a second
 * release) are ignored, so the same taps always give the same race.
 */
export function createRace(seed: number, car: RaceCar) {
  const green = greenAtMs(seed);
  const vmax = 45 + 0.25 * car.power;
  const accel = 0.6 + car.power / 100;
  const launchGrip = Math.min(1, 0.7 + car.grip / 400);
  const pending: RaceInput[] = [];
  let t = 0;
  let departAt: number | null = null;
  let falseStart = false;
  let gear: 1 | 2 | 3 | 4 = 1;
  let v = 0;
  let m = 0;
  let shiftingUntil = -1;
  let boostUntil = -1;
  let nitroLeft = 0;
  let nitroUsed = false;
  let lastShift: ShiftGrade | null = null;
  const shifts: ShiftGrade[] = [];
  const trace: number[] = [0];
  let finishAt: number | null = null;
  let capped = false;

  const limit = () => vmax * GEAR_SPEED[gear - 1]!;
  const rpm = () => RPM_IDLE + RPM_SPAN * (v / limit());
  const departed = () => departAt !== null && t >= departAt;

  function apply(i: RaceInput) {
    if (i.kind === 'release') {
      if (departAt !== null) return;
      if (i.t < green) {
        falseStart = true;
        departAt = green;
      } else departAt = i.t;
    } else if (i.kind === 'shift') {
      if (!departed() || gear === 4 || t < shiftingUntil) return;
      const g = grade(car.grip, rpm());
      shifts.push(g);
      lastShift = g;
      gear = (gear + 1) as 1 | 2 | 3 | 4;
      shiftingUntil = t + SHIFT_MS[g];
      if (g === 'perfect') boostUntil = shiftingUntil + PERFECT_BOOST_MS;
    } else if (i.kind === 'nitro') {
      if (!departed() || nitroUsed) return;
      nitroUsed = true;
      nitroLeft = NITRO_MS;
    }
  }

  function step() {
    // taps due by now, in time order
    pending.sort((a, b) => a.t - b.t);
    while (pending.length && pending[0]!.t <= t) apply(pending.shift()!);
    if (departAt === null && t >= green + NO_RELEASE_MS) departAt = green + NO_RELEASE_MS;
    const prevM = m;
    if (departed() && t >= shiftingUntil) {
      let a = GEAR_ACCEL[gear - 1]! * accel;
      if (t - departAt! < LAUNCH_MS) a *= launchGrip;
      if (t < boostUntil) a *= PERFECT_BOOST;
      if (nitroLeft > 0) {
        a *= NITRO;
        nitroLeft = Math.max(0, nitroLeft - RACE_STEP_MS);
      }
      v = Math.min(limit(), v + (a * RACE_STEP_MS) / 1000);
    }
    m += (v * RACE_STEP_MS) / 1000;
    t += RACE_STEP_MS;
    if (m >= RACE_LENGTH_M) {
      // the exact moment the car crossed the line, between the two ticks
      finishAt = t - RACE_STEP_MS + (RACE_STEP_MS * (RACE_LENGTH_M - prevM)) / (m - prevM);
      m = RACE_LENGTH_M;
      trace.push(RACE_LENGTH_M);
    } else if (t % RACE_TRACE_MS === 0) trace.push(m);
    if (finishAt === null && t >= RACE_CAP_MS) capped = true;
  }

  const done = () => finishAt !== null || capped;

  function view(): RaceView {
    return {
      t,
      meters: m,
      speed: v,
      gear,
      rpm: rpm(),
      phase: done() ? 'finished' : !departed() ? 'countdown' : t < shiftingUntil ? 'shifting' : 'running',
      nitroLeftMs: nitroLeft,
      nitroUsed,
      lastShift,
    };
  }

  return {
    input(i: RaceInput) {
      pending.push(i);
    },
    advance(toMs: number): RaceView {
      while (!done() && t < toMs) step();
      return view();
    },
    result(): RaceResult {
      while (!done()) step();
      const reactionMs = falseStart ? 0 : departAt! - green;
      const timeMs = capped ? RACE_CAP_MS : Math.round(finishAt! - green + (falseStart ? FALSE_START_MS : 0));
      return { timeMs, reactionMs, falseStart, shifts: [...shifts], trace: [...trace], finished: !capped };
    },
  };
}

export function simulateRace(seed: number, car: RaceCar, inputs: RaceInput[]): RaceResult {
  const race = createRace(seed, car);
  for (const i of inputs) race.input(i);
  return race.result();
}

/** Drives a race like a player who taps at a target rpm, recording the taps. */
function drive(
  seed: number,
  car: RaceCar,
  p: { releaseAt: number; targetRpm: (gear: number) => number; nitroGear?: number },
): RaceInput[] {
  const inputs: RaceInput[] = [{ kind: 'release', t: p.releaseAt }];
  const race = createRace(seed, car);
  race.input(inputs[0]!);
  let nitroDone = false;
  for (let t = 0; t < RACE_CAP_MS; t += RACE_STEP_MS) {
    const v = race.advance(t);
    if (v.phase === 'finished') break;
    if (!nitroDone && p.nitroGear && v.gear === p.nitroGear && v.phase !== 'countdown') {
      const tap: RaceInput = { kind: 'nitro', t };
      inputs.push(tap);
      race.input(tap);
      nitroDone = true;
    }
    if (v.phase === 'running' && v.gear < 4 && v.rpm >= Math.min(RPM_MAX, p.targetRpm(v.gear))) {
      const tap: RaceInput = { kind: 'shift', t };
      inputs.push(tap);
      race.input(tap);
    }
  }
  return inputs;
}

/** Taps for a scripted player: release `reactionMs` after green, shift at a fixed rpm, nitro in a gear. */
export function scriptInputs(
  seed: number,
  car: RaceCar,
  p: { reactionMs: number; shiftRpm: 'center' | 'goodEdge' | number; nitroGear?: 2 | 3 | 4 },
): RaceInput[] {
  const b = greenBand(car.grip);
  const half = (b.hi - b.lo) / 2;
  const rpm =
    p.shiftRpm === 'center' ? RPM_CENTER : p.shiftRpm === 'goodEdge' ? RPM_CENTER + 0.6 * half : p.shiftRpm;
  return drive(seed, car, {
    releaseAt: greenAtMs(seed) + p.reactionMs,
    targetRpm: () => rpm,
    nitroGear: p.nitroGear,
  });
}

/** A game driver's taps: reaction 350 − 250·skill, shifts off-centre by up to (1 − skill)·1.6 half-widths. */
export function rivalInputs(seed: number, rival: RaceCar & { skill: number }): RaceInput[] {
  let r = (seed ^ 0x9e3779b9) >>> 0;
  const half = (greenBand(rival.grip).hi - greenBand(rival.grip).lo) / 2;
  const targets: number[] = [];
  for (let g = 0; g < 3; g++) {
    let x: number;
    [x, r] = nextRandom(r);
    targets.push(RPM_CENTER + (x * 2 - 1) * (1 - rival.skill) * half * 1.6);
  }
  return drive(seed, rival, {
    releaseAt: greenAtMs(seed) + Math.round(350 - 250 * rival.skill),
    targetRpm: (gear) => targets[gear - 1]!,
    nitroGear: 3,
  });
}
