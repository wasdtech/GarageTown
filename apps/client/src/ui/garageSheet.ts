import type { Content } from '@gt/shared';
import { carStats, levelForXp, type GameState, type OwnedCar, type RaceTarget } from '@gt/sim';
import type { Store } from '../state/store';
import { drawCarPreview } from './carPreview';
import { h } from './dom';
import { errorText, S } from './strings';
import { garageKey } from './garageKey';
import { franchiseTab } from './franchiseTab';
import { raceTab } from './raceTab';
import { sheetHead } from './frame';
import { confetti } from './juice';
import { teamTab } from './teamTab';

/** The bottom-bar menus; only the car menu has tabs (the car's own configuration). */
export type Menu = 'car' | 'dealer' | 'team' | 'franchise' | 'race';
type Tab = 'paint' | 'finish' | 'extras' | 'parts';
const CAR_TABS: Tab[] = ['paint', 'finish', 'extras', 'parts'];
let openTab: Tab = 'paint';

/**
 * One of the bottom-bar menus as a sheet. "car" shows the showcase car with preview, stats and
 * tabs for its looks and parts; the others (dealership, team, franchise) show their own content.
 */
export function openGarage(
  root: HTMLElement,
  c: Content,
  store: Store,
  toast: (t: string, k?: 'good' | 'bad') => void,
  opts: {
    menu?: Menu;
    tab?: Tab;
    sfx?: { hired(): void; register?(): void; menu?(): void; branch?(): void };
    /** a league track or a street race was picked in the race menu */
    onRace?: (target: RaceTarget) => void;
  } = {},
) {
  const menu = opts.menu ?? 'car';
  if (opts.tab) openTab = opts.tab;
  opts.sfx?.menu?.();
  root.querySelector('.gt-garage')?.remove();
  const panel = h('div', {
    class: `gt-sheet gt-garage-sheet gt-tone-${menu}`,
    role: 'dialog',
    'aria-label': S.menus.title[menu],
    'data-menu': menu,
  });
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
  let confirming = false;
  const run = (r: { ok: true } | { ok: false; error: string }, okText?: string) => {
    if (r.ok) {
      opts.sfx?.register?.();
      if (okText) toast(okText, 'good');
    } else toast(errorText(r.error as never), 'bad');
  };

  /** A shop tile: picture first (paint blob, icon or car), then the name and a price/state pill. */
  function option(
    label: string,
    sub: string,
    opts: {
      active?: boolean;
      disabled?: boolean;
      swatch?: string;
      art?: string;
      media?: Node;
      /** a short extra line above the price (e.g. a part's bonus) */
      note?: string;
      testid?: string;
    },
    onPick: () => void,
  ) {
    const media = opts.media
      ? h('span', { class: 'gt-opt-media' }, opts.media)
      : opts.swatch
        ? h(
            'span',
            { class: 'gt-opt-media' },
            h('span', { class: 'gt-blob', style: `background:${opts.swatch}` }),
          )
        : opts.art
          ? h('span', { class: 'gt-opt-media' }, h('img', { src: opts.art, alt: '', draggable: 'false' }))
          : null;
    const priced = sub.includes('🪙');
    const b = h(
      'button',
      {
        class: `gt-opt${opts.active ? ' gt-opt-active' : ''}${media ? '' : ' gt-opt-plain'}`,
        ...(opts.disabled ? { disabled: '' } : {}),
        ...(opts.testid ? { 'data-testid': opts.testid } : {}),
      },
      media,
      h('strong', {}, label),
      opts.note ? h('span', { class: 'gt-opt-sub' }, opts.note) : null,
      h('span', { class: priced ? 'gt-pill-price' : 'gt-opt-sub' }, sub),
      opts.active ? h('span', { class: 'gt-badge-ok', 'aria-hidden': 'true' }, '✓') : null,
      opts.disabled ? h('span', { class: 'gt-badge-lock', 'aria-hidden': 'true' }, '🔒') : null,
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
            { active: car.look.sticker === st.key, art: 'icons/stickers.png', testid: `sticker-${st.key}` },
            () => run(store.applyLook(car.id, { sticker: st.key })),
          ),
        ),
      ];
    }
    // parts
    {
      return c.parts.map((p) => {
        const tier = car.parts[p.key] ?? 0;
        const next = p.tiers[tier];
        const sub = !next ? S.garage.maxed : level < next.level ? S.lockedAt(next.level) : `${next.cost} 🪙`;
        return option(
          `${p.name} ${'●'.repeat(tier)}${'○'.repeat(p.tiers.length - tier)}`,
          sub,
          {
            disabled: !next || level < next.level,
            art: `icons/${p.key}.png`,
            note: next ? `+${next.bonus} ${S.garage.stat[p.stat]}` : undefined,
            testid: `part-${p.key}`,
          },
          () => run(store.buyPart(car.id, p.key), S.garage.installed(p.name)),
        );
      });
    }
  }

  /** The dealership: buy new cars and pick which one stands on the showcase. */
  function dealerContent(s: GameState): Node[] {
    const level = levelForXp(c, s.xp);
    // a small drawing of each car: yours in its own paint, the ones for sale in the first paint
    const thumb = (sprite: string, look: OwnedCar['look']) => {
      const cv = h('canvas', { class: 'gt-car-thumb', width: '480', height: '300' });
      const hex = c.looks.paints.find((p) => p.key === look.paint)?.hex ?? '#e63946';
      void drawCarPreview(cv, sprite, look, hex).catch(() => undefined);
      return cv;
    };
    const showroom: OwnedCar['look'] = {
      paint: c.looks.paints[0]!.key,
      finish: c.looks.finishes[0]!.key,
      neon: false,
      sticker: null,
    };
    return c.cars.map((m) => {
      const mine = s.collection.cars.find((x) => x.model === m.key);
      if (mine) {
        return option(
          m.name,
          mine.id === s.collection.activeCarId ? S.garage.showing : S.garage.show,
          {
            active: mine.id === s.collection.activeCarId,
            media: thumb(m.sprite, mine.look),
            testid: `car-${m.key}`,
          },
          () => run(store.setActiveCar(mine.id)),
        );
      }
      const locked = level < m.unlockLevel;
      return option(
        m.name,
        locked ? S.lockedAt(m.unlockLevel) : `${m.price} 🪙`,
        { disabled: locked, media: thumb(m.sprite, showroom), testid: `car-${m.key}` },
        () => run(store.buyCar(m.key), S.garage.bought(m.name)),
      );
    });
  }

  /** Content of the menus without a car preview. */
  function menuContent(s: GameState): Node[] {
    if (menu === 'dealer') return dealerContent(s);
    if (menu === 'team') return teamTab(c, s, store, toast, opts.sfx);
    if (menu === 'race')
      return raceTab(c, s, store.now(), (target) => {
        close();
        opts.onRace?.(target);
      });
    return franchiseTab(c, s, store, toast, {
      confirming,
      setConfirming(v) {
        confirming = v;
        render();
      },
      onOpened(branch, seals) {
        close();
        confetti(root);
        opts.sfx?.branch?.();
        toast(S.franchise.opened(branch, seals), 'good');
      },
    });
  }

  function render() {
    const s = store.state;
    lastKey = keyOf(s);
    if (menu !== 'car') {
      panel.replaceChildren(
        sheetHead(S.menus.title[menu], `ui/${menu}.png`, close),
        h('div', { class: 'gt-sheet-body' }, h('div', { class: 'gt-opts' }, ...menuContent(s))),
      );
      return;
    }
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
    const tabs = CAR_TABS.map((t) => {
      const b = h(
        'button',
        { class: `gt-tab${openTab === t ? ' gt-tab-active' : ''}`, 'data-tab': t, 'data-testid': `tab-${t}` },
        S.garage.tabs[t],
      );
      b.addEventListener('click', () => {
        openTab = t;
        confirming = false;
        render();
      });
      return b;
    });
    panel.replaceChildren(
      sheetHead(
        model.name,
        'ui/car.png',
        close,
        h('span', { class: 'gt-class', 'data-testid': 'car-class' }, st.cls),
        h('span', { class: 'gt-pi', 'data-testid': 'car-pi' }, `PI ${st.pi}`),
      ),
      h(
        'div',
        { class: 'gt-sheet-body' },
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
      ),
    );
  }
  render();
}
