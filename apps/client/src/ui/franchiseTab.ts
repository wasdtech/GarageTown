import type { Content } from '@gt/shared';
import type { GameState } from '@gt/sim';
import type { Store } from '../state/store';
import { h } from './dom';
import { icon } from './icon';
import { branchPreview, perkLine } from './franchise';
import { errorText, S } from './strings';

/**
 * "Franquia" tab of the garage sheet: open a new branch (two-step confirm) and buy permanent perks.
 * `confirming` is owned by the sheet so a re-render keeps the confirm step.
 */
export function franchiseTab(
  c: Content,
  s: GameState,
  store: Store,
  toast: (t: string, k?: 'good' | 'bad') => void,
  ui: { confirming: boolean; setConfirming(v: boolean): void; onOpened(branch: number, seals: number): void },
): Node[] {
  const p = branchPreview(c, s);
  const head = h(
    'div',
    { class: 'gt-team-card gt-wide' },
    h(
      'div',
      { class: 'gt-team-head' },
      h('span', { class: 'gt-team-face' }, icon('franchise')),
      h('strong', {}, S.franchise.title(s.prestige.branch)),
      h(
        'span',
        { class: 'gt-seals' },
        icon('seal'),
        h('span', { 'data-testid': 'seals' }, S.franchise.seals(s.prestige.seals)),
      ),
    ),
    h('span', { class: 'gt-muted' }, S.franchise.runCoins(s.prestige.runCoins.toLocaleString('pt-BR'))),
  );

  const actions: Node[] = [];
  if (!ui.confirming) {
    const open = h(
      'button',
      { class: 'gt-btn', 'data-testid': 'open-branch', ...(p.canOpen ? {} : { disabled: '' }) },
      p.reason === 'level'
        ? S.franchise.lockedLevel
        : p.reason === 'no_seals'
          ? S.franchise.noSeals
          : S.franchise.open,
    );
    open.addEventListener('click', () => ui.setConfirming(true));
    actions.push(open);
  } else {
    const yes = h(
      'button',
      { class: 'gt-btn gt-btn-danger', 'data-testid': 'confirm-branch' },
      S.franchise.open,
    );
    yes.addEventListener('click', () => {
      ui.setConfirming(false);
      const r = store.openBranch();
      if (r.ok) ui.onOpened(store.state.prestige.branch, r.value.seals);
      else toast(errorText(r.error), 'bad');
    });
    const no = h(
      'button',
      { class: 'gt-btn gt-btn-ghost', 'data-testid': 'cancel-branch' },
      S.franchise.cancel,
    );
    no.addEventListener('click', () => ui.setConfirming(false));
    actions.push(h('strong', {}, S.franchise.confirm), h('div', { class: 'gt-row' }, yes, no));
  }
  const branch = h(
    'div',
    { class: 'gt-team-card gt-wide' },
    h('strong', {}, S.franchise.preview(p.seals)),
    p.reason === 'level'
      ? null
      : h('span', { class: 'gt-muted' }, S.franchise.nextSeal(p.coinsToNext.toLocaleString('pt-BR'))),
    h('span', { class: 'gt-muted' }, S.franchise.keeps),
    ...actions,
  );

  const perks = c.prestige.perks.map((def) => {
    const line = perkLine(c, s, def.key);
    const level = s.prestige.perks[def.key] ?? 0;
    const can = line.cost !== null && s.prestige.seals >= line.cost;
    const buy = h(
      'button',
      { class: 'gt-btn', 'data-testid': `perk-${def.key}`, ...(can ? {} : { disabled: '' }) },
      ...(line.cost === null ? [S.franchise.max] : [S.franchise.buy(line.cost), icon('seal')]),
    );
    buy.addEventListener('click', () => {
      const r = store.buyPerk(def.key);
      if (!r.ok) toast(errorText(r.error), 'bad');
    });
    return h(
      'div',
      { class: 'gt-team-card' },
      h(
        'div',
        { class: 'gt-team-head' },
        h('img', { class: 'gt-perk-icon', src: `ui/perk_${def.key}.png`, alt: '', draggable: 'false' }),
        h(
          'div',
          { class: 'gt-team-name' },
          h('strong', {}, def.name),
          // level as a short meter (some perks have 10 levels: too many pips for a card)
          h(
            'span',
            { class: 'gt-meter', 'aria-hidden': 'true' },
            h('span', { style: `width:${Math.round((level / def.max) * 100)}%` }),
          ),
          h('span', { class: 'gt-level-count' }, `${level}/${def.max}`),
        ),
      ),
      h(
        'div',
        { class: 'gt-chips' },
        h('span', { class: 'gt-chip' }, line.now),
        line.next ? h('span', { class: 'gt-chip gt-chip-next' }, `→ ${line.next}`) : null,
      ),
      buy,
    );
  });
  return [head, branch, h('h3', { class: 'gt-perks-title gt-wide' }, S.franchise.perksTitle), ...perks];
}
