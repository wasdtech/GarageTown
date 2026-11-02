import type { Content } from '@gt/shared';
import { carStats, levelForXp, type GameState, type OwnedCar } from '@gt/sim';
import type { Store } from '../state/store';
import { drawCarPreview } from './carPreview';
import { h } from './dom';
import { errorText, S } from './strings';
import { garageKey } from './garageKey';
import { teamTab } from './teamTab';

type Tab = 'paint' | 'finish' | 'extras' | 'parts' | 'cars' | 'team';
let openTab: Tab = 'paint';

/** Full-screen garage: preview, stats and tabs for looks, parts and the dealership. */
export function openGarage(
  root: HTMLElement,
  c: Content,
  store: Store,
  toast: (t: string, k?: 'good' | 'bad') => void,
  opts: { tab?: Tab; sfx?: { hired(): void; register?(): void; menu?(): void } } = {},
) {
  if (opts.tab) openTab = opts.tab;
  opts.sfx?.menu?.();
  root.querySelector('.gt-garage')?.remove();
  const panel = h('div', { class: 'gt-sheet gt-garage-sheet', role: 'dialog', 'aria-label': S.garage.title });
  const backdrop = h('div', { class: 'gt-backdrop gt-garage' }, panel);
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  root.append(backdrop);
  // redraw only when something the sheet shows changed (the store ticks every second)
  const keyOf = (s: GameState) => garageKey(c, s);
  let lastKey = '';
  const unsub = store.subscribe((s) => {
    // never rebuild under a select the player is using
    if (panel.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT') return;
    if (keyOf(s) !== lastKey) render();
  });
  function close() {
    unsub();
    backdrop.remove();
  }
  const run = (r: { ok: true } | { ok: false; error: string }, okText?: string) => {
    if (r.ok) {
      opts.sfx?.register?.();
      if (okText) toast(okText, 'good');
    } else toast(errorText(r.error as never), 'bad');
  };

  function option(
    label: string,
    sub: string,
    opts: { active?: boolean; disabled?: boolean; swatch?: string; testid?: string },
    onPick: () => void,
  ) {
    const b = h(
      'button',
      {
        class: `gt-opt${opts.active ? ' gt-opt-active' : ''}`,
        ...(opts.disabled ? { disabled: '' } : {}),
        ...(opts.testid ? { 'data-testid': opts.testid } : {}),
      },
      opts.swatch ? h('span', { class: 'gt-swatch', style: `background:${opts.swatch}` }) : null,
      h('strong', {}, label),
      h('span', {}, sub),
    );
    b.addEventListener('click', () => !b.hasAttribute('disabled') && onPick());
    return b;
  }

  function tabContent(s: GameState, car: OwnedCar): Node[] {
    const L = c.looks;
    const level = levelForXp(c, s.xp);
    const owned = (list: string[], key: string) => list.includes(key);
    const price = (n: number) => (n === 0 ? S.garage.free : `${n} 🪙`);
    if (openTab === 'paint') {
      return L.paints.map((p) =>
        option(
          p.name,
          owned(s.collection.paints, p.key) ? S.garage.owned : price(p.cost),
          { active: car.look.paint === p.key, swatch: p.hex, testid: `paint-${p.key}` },
          () => run(store.applyLook(car.id, { paint: p.key })),
        ),
      );
    }
    if (openTab === 'finish') {
      return L.finishes.map((f) =>
        option(
          f.name,
          owned(s.collection.finishes, f.key) ? S.garage.owned : price(f.cost),
          { active: car.look.finish === f.key, testid: `finish-${f.key}` },
          () => run(store.applyLook(car.id, { finish: f.key })),
        ),
      );
    }
    if (openTab === 'extras') {
      const neonLocked = level < L.neon.unlockLevel;
      return [
        option(
          `${L.neon.name} ${car.look.neon ? '✓' : ''}`,
          neonLocked
            ? S.lockedAt(L.neon.unlockLevel)
            : s.collection.neon
              ? S.garage.owned
              : price(L.neon.cost),
          { active: car.look.neon, disabled: neonLocked, testid: 'neon' },
          () => run(store.applyLook(car.id, { neon: !car.look.neon })),
        ),
        option(S.garage.noSticker, '', { active: car.look.sticker === null }, () =>
          run(store.applyLook(car.id, { sticker: null })),
        ),
        ...L.stickers.map((st) =>
          option(
            st.name,
            owned(s.collection.stickers, st.key) ? S.garage.owned : price(st.cost),
            { active: car.look.sticker === st.key, testid: `sticker-${st.key}` },
            () => run(store.applyLook(car.id, { sticker: st.key })),
          ),
        ),
      ];
    }
    if (openTab === 'team') return teamTab(c, s, store, toast, opts.sfx);
    if (openTab === 'parts') {
      return c.parts.map((p) => {
        const tier = car.parts[p.key] ?? 0;
        const next = p.tiers[tier];
        const sub = !next
          ? S.garage.maxed
          : level < next.level
            ? S.lockedAt(next.level)
            : `+${next.bonus} ${S.garage.stat[p.stat]} · ${next.cost} 🪙`;
        return option(
          `${p.name} ${'●'.repeat(tier)}${'○'.repeat(p.tiers.length - tier)}`,
          sub,
          { disabled: !next || level < next.level, testid: `part-${p.key}` },
          () => run(store.buyPart(car.id, p.key), S.garage.installed(p.name)),
        );
      });
    }
    return c.cars.map((m) => {
      const mine = s.collection.cars.find((x) => x.model === m.key);
      if (mine) {
        return option(
          m.name,
          mine.id === s.collection.activeCarId ? S.garage.showing : S.garage.show,
          { active: mine.id === s.collection.activeCarId, testid: `car-${m.key}` },
          () => run(store.setActiveCar(mine.id)),
        );
      }
      const locked = level < m.unlockLevel;
      return option(
        m.name,
        locked ? S.lockedAt(m.unlockLevel) : `${m.price} 🪙`,
        { disabled: locked, testid: `car-${m.key}` },
        () => run(store.buyCar(m.key), S.garage.bought(m.name)),
      );
    });
  }

  function render() {
    const s = store.state;
    lastKey = keyOf(s);
    const car = s.collection.cars.find((x) => x.id === s.collection.activeCarId)!;
    const model = c.cars.find((m) => m.key === car.model)!;
    const st = carStats(c, car);
    const canvas = h('canvas', { class: 'gt-preview', width: '480', height: '300' });
    const hex = c.looks.paints.find((p) => p.key === car.look.paint)?.hex ?? '#e63946';
    void drawCarPreview(canvas, model.sprite, car.look, hex).catch(() => undefined);
    const bar = (label: string, v: number, max: number) =>
      h(
        'div',
        { class: 'gt-stat' },
        h('span', {}, label),
        h('div', { class: 'gt-stat-bar' }, h('div', { style: `width:${Math.min(100, (v / max) * 100)}%` })),
        h('b', {}, String(v)),
      );
    const tabs = (['paint', 'finish', 'extras', 'parts', 'cars', 'team'] as Tab[]).map((t) => {
      const b = h(
        'button',
        { class: `gt-tab${openTab === t ? ' gt-tab-active' : ''}`, 'data-tab': t },
        S.garage.tabs[t],
      );
      b.addEventListener('click', () => {
        openTab = t;
        render();
      });
      return b;
    });
    panel.replaceChildren(
      h(
        'div',
        { class: 'gt-garage-head' },
        h('h2', {}, model.name),
        h('span', { class: 'gt-class', 'data-testid': 'car-class' }, st.cls),
        h('span', { class: 'gt-pi', 'data-testid': 'car-pi' }, `PI ${st.pi}`),
      ),
      canvas,
      h(
        'div',
        { class: 'gt-stats' },
        bar(S.garage.stat.power, st.power, 200),
        bar(S.garage.stat.grip, st.grip, 200),
        bar(S.garage.style, st.style, 60),
      ),
      h('div', { class: 'gt-tabs', role: 'tablist' }, ...tabs),
      h('div', { class: 'gt-opts' }, ...tabContent(s, car)),
      h('button', { class: 'gt-btn gt-btn-ghost', onclick: close }, S.close),
    );
  }
  render();
}
