import type { Content } from '@gt/shared';
import { isMinigameEligible, jobProgress, maxLevel, type Reward } from '@gt/sim';
import type { GarageScene } from './scenes/GarageScene';
import type { Store } from './state/store';
import { h } from './ui/dom';
import { closeSheet, openBayStatus, openJobMenu } from './ui/jobMenu';
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
}

/** Translates scene taps and menu picks into store actions and feedback. */
export function createController(d: ControllerDeps) {
  let selected: string | null = null;

  const render = () => {
    if (selected && !d.store.state.queue.some((q) => q.id === selected)) selected = null;
    d.scene.renderState(d.store.state, d.clock(), { selectedCustomerId: selected });
  };

  const celebrate = (r: Reward) => {
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
    if (r.ok) celebrate(r.value);
    else d.toast(errorText(r.error), 'bad');
  };

  d.scene.events.on('customer:tap', (id: string) => {
    selected = selected === id ? null : id;
    render();
  });

  d.scene.events.on('bay:tap', (bayId: string) => {
    const s = d.store.state;
    const bay = s.bays.find((b) => b.id === bayId);
    if (!bay) return;
    const now = d.clock();
    if (bay.job) {
      if (jobProgress(bay.job, now).done) {
        const r = d.store.collect(bayId);
        if (r.ok) celebrate(r.value);
        else d.toast(errorText(r.error), 'bad');
        return;
      }
      const job = bay.job;
      const extra =
        d.openMinigame && isMinigameEligible(d.content, job)
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
      openBayStatus(d.ui, d.content, bay, now, extra);
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
      selected = null;
      render();
    });
  });

  d.store.subscribe(render);
  return { render };
}
