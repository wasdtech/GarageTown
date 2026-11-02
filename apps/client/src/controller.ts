import type { Content } from '@gt/shared';
import {
  buildProgress,
  isMinigameEligible,
  jobProgress,
  levelForXp,
  maxLevel,
  minigameUsesLeft,
  type Reward,
} from '@gt/sim';
import { fmt } from './ui/format';
import type { GarageScene } from './scenes/GarageScene';
import type { Store } from './state/store';
import { h } from './ui/dom';
import { openGarage } from './ui/garageSheet';
import { coinFly, confetti, floatText } from './ui/juice';
import type { Sfx } from './ui/sfx';
import { closeSheet, openBayStatus, openBuildMenu, openJobMenu } from './ui/jobMenu';
import { errorText, S } from './ui/strings';
import { showBanner } from './ui/toast';

export interface ControllerDeps {
  content: Content;
  store: Store;
  scene: GarageScene;
  ui: HTMLElement;
  clock: () => number;
  toast: (text: string, kind?: 'info' | 'good' | 'bad' | 'big') => void;
  /** Opens the hand-wash minigame; resolves with the gesture time, or null if cancelled. */
  openMinigame?: (carKey: string) => Promise<number | null>;
  sfx?: Sfx;
  garageOpts?: Parameters<typeof openGarage>[4];
  /** Notified of player milestones (used by the tutorial). */
  onEvent?: (e: 'select' | 'start' | 'collect' | 'garage') => void;
}

/** Translates scene taps and menu picks into store actions and feedback. */
export function createController(d: ControllerDeps) {
  let selected: string | null = null;
  // ignore taps on a bay right after collecting it, so a double tap doesn't land on the empty pad
  const COLLECT_GUARD_MS = 500;
  const collectedAt = new Map<string, number>();

  const render = () => {
    if (selected && !d.store.state.queue.some((q) => q.id === selected)) selected = null;
    d.scene.renderState(d.store.state, d.clock(), { selectedCustomerId: selected });
  };

  const celebrate = (r: Reward, bayId?: string) => {
    const from = bayId ? d.scene.screenOf(bayId) : null;
    const coinsEl = d.ui.querySelector<HTMLElement>('[data-testid="coins"]')?.parentElement;
    if (from && coinsEl) {
      coinFly(d.ui, from, coinsEl, r.coins);
      floatText(d.ui, { x: from.x, y: from.y - 30 }, `+${r.xp} XP`);
    }
    d.sfx?.coin();
    if (r.levelAfter > r.levelBefore) {
      confetti(d.ui);
      setTimeout(() => d.sfx?.levelUp(), 250);
    }
    const extras = [r.tip ? S.tip(r.tip) : '', r.timelyBonus ? S.timely(r.timelyBonus) : ''].filter(Boolean);
    d.toast(`${S.reward(r.coins, r.xp)}${extras.length ? `  (${extras.join(', ')})` : ''}`, 'good');
    if (r.levelAfter > r.levelBefore) d.toast(S.levelUp(r.levelAfter), 'big');
    if (r.levelAfter >= maxLevel(d.content) && r.levelBefore < r.levelAfter)
      showBanner(d.ui, S.endOfPrototype);
  };

  const runMinigame = async (bayId: string, carKey: string) => {
    if (!d.openMinigame) return;
    closeSheet();
    const gestureMs = await d.openMinigame(carKey);
    if (gestureMs === null) return;
    const r = d.store.minigame(bayId, gestureMs);
    if (r.ok) d.onEvent?.('collect');
    if (r.ok) celebrate(r.value, bayId);
    else d.toast(errorText(r.error), 'bad');
  };

  d.scene.events.on('customer:tap', (id: string) => {
    selected = selected === id ? null : id;
    if (selected) d.onEvent?.('select');
    render();
  });

  const garage = () => {
    d.onEvent?.('garage');
    openGarage(d.ui, d.content, d.store, d.toast, d.garageOpts);
  };
  d.scene.events.on('showcase:tap', garage);

  d.scene.events.on('slot:tap', (slot: number) => {
    const s = d.store.state;
    const build = s.builds.find((b) => b.slot === slot);
    if (build) {
      d.toast(S.buildInProgress(fmt(Math.ceil(buildProgress(build, d.clock()).remainingMs / 1000))));
      return;
    }
    const def = d.content.garage.bays.find((b) => b.slot === slot);
    if (!def) return;
    openBuildMenu(
      d.ui,
      {
        level: levelForXp(d.content, s.xp),
        coins: s.coins,
        slotLevel: def.level ?? 1,
        cost: def.cost ?? 0,
        buildS: def.buildS ?? 0,
      },
      (type) => {
        const r = d.store.build(slot, type);
        if (r.ok) d.sfx?.build();
        if (r.ok) d.toast(S.buildStarted(fmt(def.buildS ?? 0)), 'good');
        else d.toast(errorText(r.error), 'bad');
      },
    );
  });

  d.scene.events.on('bay:tap', (bayId: string) => {
    if (performance.now() - (collectedAt.get(bayId) ?? -Infinity) < COLLECT_GUARD_MS) return;
    const s = d.store.state;
    const bay = s.bays.find((b) => b.id === bayId);
    if (!bay) return;
    const now = d.clock();
    if (bay.job) {
      if (jobProgress(bay.job, now).done) {
        const r = d.store.collect(bayId);
        if (r.ok) collectedAt.set(bayId, performance.now());
        if (r.ok) d.onEvent?.('collect');
        if (r.ok) celebrate(r.value, bayId);
        else d.toast(errorText(r.error), 'bad');
        return;
      }
      const job = bay.job;
      const extra =
        d.openMinigame && isMinigameEligible(d.content, job) && minigameUsesLeft(s, now) > 0
          ? [
              h(
                'button',
                {
                  class: 'gt-btn',
                  'data-testid': 'by-hand',
                  onclick: () => void runMinigame(bayId, job.carKey),
                },
                S.doByHand,
              ),
            ]
          : [];
      openBayStatus(d.ui, d.content, () => d.store.state.bays.find((b) => b.id === bayId), d.clock, extra);
      return;
    }
    const customer = s.queue.find((q) => q.id === selected);
    if (!customer) {
      d.toast(S.pickCustomerFirst);
      return;
    }
    openJobMenu(d.ui, d.content, s.xp, bay, customer, (job) => {
      const r = d.store.start({ customerId: customer.id, bayId, jobKey: job.key });
      if (!r.ok) d.toast(errorText(r.error), 'bad');
      else {
        d.sfx?.click();
        d.onEvent?.('start');
      }
      selected = null;
      render();
    });
  });

  d.store.subscribe(render);
  return { render, garage };
}
