import type { Content } from '@gt/shared';
import { type GameState, levelForXp, recruitPrice, trainCost } from '@gt/sim';
import type { Store } from '../state/store';
import { h } from './dom';
import { errorText, S } from './strings';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "Equipe" tab of the garage sheet: hire, train and assign helpers, and the shift clock. */
export function teamTab(
  c: Content,
  s: GameState,
  store: Store,
  toast: (t: string, k?: 'good' | 'bad') => void,
  sfx?: { hired(): void },
): Node[] {
  const level = levelForXp(c, s.xp);
  const run = (r: { ok: true } | { ok: false; error: string }, okText?: string) => {
    if (r.ok) {
      if (okText) toast(okText, 'good');
    } else toast(errorText(r.error as never), 'bad');
  };
  const cards = c.helpers.map((def) => {
    const hired = s.helpers.find((x) => x.key === def.key);
    const lv = c.helperLevels[(hired?.level ?? 1) - 1]!;
    const head = h(
      'div',
      { class: 'gt-team-head' },
      h('span', { class: 'gt-team-face', 'aria-hidden': 'true' }, def.face),
      h('strong', {}, def.name),
    );
    if (!hired) {
      const locked = level < def.unlockLevel;
      const b = h(
        'button',
        { class: 'gt-btn', 'data-testid': `hire-${def.key}`, ...(locked ? { disabled: '' } : {}) },
        locked ? S.lockedAt(def.unlockLevel) : S.team.hire(recruitPrice(c, s, def.price)),
      );
      b.addEventListener('click', () => {
        const r = store.hireHelper(def.key);
        if (r.ok) sfx?.hired();
        run(r, S.team.hired(def.name));
      });
      return h('div', { class: 'gt-team-card' }, head, h('span', { class: 'gt-muted' }, S.team.pitch), b);
    }
    const next = c.helperLevels[hired.level];
    const train = h(
      'button',
      { class: 'gt-btn gt-btn-small', 'data-testid': `train-${def.key}`, ...(next ? {} : { disabled: '' }) },
      next ? S.team.train(trainCost(c, s, def.key, hired.level + 1)) : S.garage.maxed,
    );
    train.addEventListener('click', () => run(store.trainHelper(def.key), S.team.trained(def.name)));
    const select = h('select', {
      class: 'gt-select',
      'data-testid': `assign-${def.key}`,
      'aria-label': S.team.assignLabel(def.name),
    });
    select.append(h('option', { value: '' }, S.team.noBay));
    for (const bay of s.bays) {
      const taken = s.helpers.some((x) => x.key !== def.key && x.bayId === bay.id);
      const opt = h(
        'option',
        { value: bay.id, ...(taken ? { disabled: '' } : {}) },
        `${S.team.bay} ${bay.id.slice(3)} · ${S.bayTypes[bay.type]}`,
      );
      if (hired.bayId === bay.id) opt.setAttribute('selected', '');
      select.append(opt);
    }
    select.addEventListener('change', () => run(store.assignHelper(def.key, select.value || null)));
    return h(
      'div',
      { class: 'gt-team-card' },
      head,
      h('span', { class: 'gt-muted' }, S.team.stats(hired.level, pct(1 - lv.speed), pct(lv.share))),
      select,
      train,
    );
  });
  const nextClock = c.clockTiers[s.clockTier + 1];
  const clock = h(
    'button',
    { class: 'gt-btn', 'data-testid': 'clock', ...(nextClock ? {} : { disabled: '' }) },
    nextClock ? S.team.clockBuy(nextClock.hours, nextClock.cost) : S.garage.maxed,
  );
  clock.addEventListener('click', () => run(store.buyClock(), S.team.clockBought));
  const shift = c.clockTiers[s.clockTier]!.hours;
  return [
    ...cards,
    h(
      'div',
      { class: 'gt-team-card' },
      h(
        'div',
        { class: 'gt-team-head' },
        h('span', { class: 'gt-team-face', 'aria-hidden': 'true' }, '⏰'),
        h('strong', {}, S.team.clock),
      ),
      h('span', { class: 'gt-muted' }, S.team.shift(shift)),
      clock,
    ),
  ];
}
