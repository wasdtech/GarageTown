import type { Content } from '@gt/shared';
import { type RaceInput, type RaceTarget, scriptInputs } from '@gt/sim';
import type Phaser from 'phaser';
import type { RaceScene } from '../scenes/RaceScene';
import type { Store } from '../state/store';
import { confetti } from '../ui/juice';
import { createRaceHud } from '../ui/raceHud';
import type { Sfx } from '../ui/sfx';
import { errorText, S } from '../ui/strings';
import { RaceRun, type RaceSnapshot } from './raceRun';

type Toast = (t: string, k?: 'info' | 'good' | 'bad' | 'big') => void;
const RIVAL_PAINT = 0x3a86ff;

/** Starts a race over the garage, plays it, settles it in the store and comes back to the garage. */
export function createRaceFlow(d: {
  game: Phaser.Game;
  race: RaceScene;
  content: Content;
  store: Store;
  ui: HTMLElement;
  toast: Toast;
  sfx?: Sfx;
}) {
  let current: {
    run: RaceRun;
    hud: ReturnType<typeof createRaceHud>;
    target: RaceTarget;
    settled: boolean;
  } | null = null;
  let lastLights = '';

  const nameOf = (t: RaceTarget) =>
    'track' in t ? (d.content.race.tracks.find((x) => x.key === t.track)?.name ?? '') : S.race.rachas;

  function end() {
    if (!current) return;
    current.hud.destroy();
    current = null;
    d.sfx?.revStop();
    d.game.scene.stop('race');
    d.game.scene.wake('garage');
    d.ui.classList.remove('gt-racing');
  }

  function settle() {
    if (!current || current.settled) return;
    current.settled = true;
    d.sfx?.revStop();
    const r = d.store.finishRace(current.target, current.run.inputs);
    if (!r.ok) {
      d.toast(errorText(r.error), 'bad');
      end();
      return;
    }
    current.hud.showResult(r.value, nameOf(current.target));
    if (r.value.newMedal || r.value.won) {
      confetti(d.ui);
      d.sfx?.medal();
    }
  }

  function onFrame(s: RaceSnapshot) {
    current?.hud.update(s);
    d.sfx?.rev(s.view.rpm);
    if (s.nitroFired) d.sfx?.nitro();
    const lights = s.lights.join();
    if (lights !== lastLights) {
      lastLights = lights;
      if (s.lights[2] === 'green') d.sfx?.beepGo();
      else d.sfx?.beep();
    }
  }

  function start(target: RaceTarget) {
    end();
    const r = 'track' in target ? d.store.raceSetup(target) : d.store.startRacha(target.racha);
    if (!r.ok) {
      d.toast(errorText(r.error), 'bad');
      return;
    }
    const setup = r.value;
    const run = new RaceRun(setup.seed, setup.car, setup.rival, setup.rivalInputs);
    const s = d.store.state;
    const mine = s.collection.cars.find((x) => x.id === s.collection.activeCarId) ?? s.collection.cars[0]!;
    const sprite = (key: string) =>
      d.content.cars.find((m) => m.key === key)?.sprite ?? d.content.cars[0]!.sprite;
    const hex = d.content.looks.paints.find((p) => p.key === mine.look.paint)?.hex ?? '#e63946';
    const hud = createRaceHud(d.ui, run, setup.car.grip, {
      quit: end,
      again: () => start(target),
      back: end,
    });
    current = { run, hud, target, settled: false };
    lastLights = '';
    d.ui.classList.add('gt-racing');
    d.game.scene.sleep('garage');
    d.game.scene.run('race', {
      run,
      player: { sprite: sprite(mine.model), paint: parseInt(hex.slice(1), 16) },
      rival: { sprite: sprite(setup.rival.car), paint: RIVAL_PAINT },
      onFrame,
      onFinish: settle,
    });
    d.sfx?.revStart();
  }

  /** Test-mode hooks: finish the current race at once with scripted or given taps. */
  const testHook = {
    get active() {
      return current !== null;
    },
    script(profile: 'optimal' | 'average' | 'poor'): RaceInput[] {
      if (!current) return [];
      const p = {
        optimal: { reactionMs: 120, shiftRpm: 'center' as const, nitroGear: 3 as const },
        average: { reactionMs: 300, shiftRpm: 'goodEdge' as const, nitroGear: 3 as const },
        poor: { reactionMs: 600, shiftRpm: 3000 },
      }[profile];
      return scriptInputs(current.run.seed, current.run.car, p);
    },
    run(inputs: RaceInput[]) {
      if (!current) return;
      const snap = current.run.runInstant(inputs);
      d.race.showEnd(snap);
      current.hud.update(snap);
      settle();
    },
  };

  return { start, end, testHook };
}
