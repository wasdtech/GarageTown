import type { Content } from '@gt/shared';
import { carStats } from './cars';
import { tick } from './customers';
import { levelForXp } from './levels';
import { type RaceCar, type RaceInput, type RaceResult, rivalInputs, simulateRace } from './race';
import { err, ok, type Result } from './result';
import { type GameState, nextRandom, touch } from './state';

/** A league track, or a street race at one of the three stakes. */
export type RaceTarget = { track: string } | { racha: 0 | 1 | 2 };
export type RaceError = 'locked' | 'unknown_track' | 'no_coins' | 'rate_limited';
export type RaceRival = { name: string; car: string; power: number; grip: number; skill: number };

export interface RaceOutcome {
  player: RaceResult;
  rival: RaceResult;
  won: boolean;
  tie: boolean;
  medal: 0 | 1 | 2 | 3;
  newMedal: boolean;
  /** coins gained: medal prizes, or a street race's net win */
  coins: number;
  xp: number;
  stake: number;
}

const RACHA_RIVALS = ['Toninho Rebaixado', 'Kátia Nitro', 'Beto Escape', 'Lia Ponteira', 'Russo do Posto'];

/**
 * The seed of the next race. It only depends on how many races were run, so it stays the same
 * while the race is played (the garage's own rng keeps moving as customers arrive).
 */
export function raceSeed(s: GameState): number {
  return Math.imul(s.race.count + 1, 0x9e3779b1) >>> 0;
}

export function trackUnlocked(c: Content, s: GameState, key: string): boolean {
  const i = c.race.tracks.findIndex((t) => t.key === key);
  if (i < 0) return false;
  return i === 0 || s.race.beaten.includes(c.race.tracks[i - 1]!.key);
}

export function rachaStake(c: Content, s: GameState, i: 0 | 1 | 2): number {
  return Math.floor(c.race.rachas.stakes[i] * (1 + levelForXp(c, s.xp) / 5));
}

export function rachasLeft(c: Content, s: GameState, now: number): number {
  const recent = s.race.rachas.filter((t) => t > now - c.race.rachas.windowMs).length;
  return Math.max(0, c.race.rachas.perDay - recent);
}

export function rachaPayout(stake: number, verdict: 'win' | 'tie' | 'loss'): number {
  return verdict === 'win' ? 2 * stake : verdict === 'tie' ? stake : 0;
}

/** The showcase car's power and grip. */
function playerCar(c: Content, s: GameState): RaceCar {
  const car = s.collection.cars.find((x) => x.id === s.collection.activeCarId) ?? s.collection.cars[0]!;
  const st = carStats(c, car);
  return { power: st.power, grip: st.grip };
}

/** A street race rival drawn from the seed: PI within ±10% of yours, skill 0.4-0.8. */
function rachaRival(c: Content, seed: number, you: RaceCar): RaceRival {
  let r = (seed ^ 0x51ed270b) >>> 0;
  const draw = () => {
    let x: number;
    [x, r] = nextRandom(r);
    return x;
  };
  const sum = (you.power + you.grip) * (0.9 + 0.2 * draw());
  const share = 0.4 + 0.2 * draw();
  const skill = 0.4 + 0.4 * draw();
  const car = c.cars[Math.floor(draw() * c.cars.length)]!.key;
  const name = RACHA_RIVALS[Math.floor(draw() * RACHA_RIVALS.length)]!;
  return { name, car, power: sum * share, grip: sum * (1 - share), skill };
}

function check(c: Content, s: GameState, target: RaceTarget, now: number): RaceError | null {
  if ('track' in target) {
    if (!c.race.tracks.some((t) => t.key === target.track)) return 'unknown_track';
    if (!trackUnlocked(c, s, target.track)) return 'locked';
    return null;
  }
  if (!s.race.beaten.includes(c.race.rachas.unlockTrack)) return 'locked';
  if (rachasLeft(c, s, now) === 0) return 'rate_limited';
  if (s.coins < rachaStake(c, s, target.racha)) return 'no_coins';
  return null;
}

export function raceSetup(
  c: Content,
  state: GameState,
  target: RaceTarget,
  now: number,
): Result<{ seed: number; car: RaceCar; rival: RaceRival; rivalInputs: RaceInput[] }, RaceError> {
  const s = tick(c, state, now);
  const e = check(c, s, target, now);
  if (e) return err(e);
  const seed = raceSeed(s);
  const car = playerCar(c, s);
  const rival =
    'track' in target ? c.race.tracks.find((t) => t.key === target.track)!.rival : rachaRival(c, seed, car);
  return ok({ seed, car, rival, rivalInputs: rivalInputs(seed, rival) });
}

/** Re-runs the race from the player's taps and settles it: medals and unlocks, or the street race bet. */
export function finishRace(
  c: Content,
  state: GameState,
  target: RaceTarget,
  inputs: RaceInput[],
  now: number,
): Result<{ state: GameState; outcome: RaceOutcome }, RaceError> {
  const setup = raceSetup(c, state, target, now);
  if (!setup.ok) return setup;
  const s = tick(c, state, now);
  const { seed, car, rival, rivalInputs: rivalTaps } = setup.value;
  const player = simulateRace(seed, car, inputs);
  const rivalRun = simulateRace(seed, rival, rivalTaps);
  const pt = player.finished ? player.timeMs : Infinity;
  const rt = rivalRun.finished ? rivalRun.timeMs : Infinity;
  const won = pt < rt;
  const tie = pt === rt;
  let coins = 0;
  let xp = 0;
  let stake = 0;
  let medal: 0 | 1 | 2 | 3 = 0;
  let newMedal = false;
  let race = { ...s.race, count: s.race.count + 1 };
  let wallet = s.coins;

  if ('track' in target) {
    const def = c.race.tracks.find((t) => t.key === target.track)!;
    medal = !player.finished
      ? 0
      : pt <= def.medals.gold
        ? 3
        : pt <= def.medals.silver
          ? 2
          : pt <= def.medals.bronze
            ? 1
            : 0;
    const had = s.race.medals[def.key] ?? 0;
    // each medal tier pays once: the first time it (or a better one) is reached
    for (let tier = had + 1; tier <= medal; tier++) {
      coins += def.rewards.coins[tier - 1]!;
      xp += def.rewards.xp;
    }
    newMedal = medal > had;
    race = {
      ...race,
      medals: { ...race.medals, [def.key]: Math.max(had, medal) },
      beaten: won && !race.beaten.includes(def.key) ? [...race.beaten, def.key] : race.beaten,
    };
    wallet += coins;
  } else {
    stake = rachaStake(c, s, target.racha);
    const payout = rachaPayout(stake, won ? 'win' : tie ? 'tie' : 'loss');
    wallet += payout - stake;
    coins = Math.max(0, payout - stake);
    race = { ...race, rachas: [...race.rachas.filter((t) => t > now - c.race.rachas.windowMs), now] };
  }

  const next: GameState = {
    ...s,
    coins: wallet,
    xp: s.xp + xp,
    race,
    prestige: { ...s.prestige, runCoins: s.prestige.runCoins + coins },
  };
  return ok({
    state: touch(next, now),
    outcome: { player, rival: rivalRun, won, tie, medal, newMedal, coins, xp, stake },
  });
}
