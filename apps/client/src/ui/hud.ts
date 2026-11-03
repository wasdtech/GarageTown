import type { Content } from '@gt/shared';
import { type GameState, levelForXp, maxLevel } from '@gt/sim';
import { h } from './dom';
import { S } from './strings';

/** Fraction of the way from the current level to the next (1 at max level). */
export function xpFraction(c: Content, xp: number): number {
  const lvl = levelForXp(c, xp);
  if (lvl >= maxLevel(c)) return 1;
  const cur = c.levels[lvl - 1]!.xp;
  const next = c.levels[lvl]!.xp;
  return (xp - cur) / (next - cur);
}

export function createHud(root: HTMLElement, c: Content) {
  const coins = h('span', { 'data-testid': 'coins' });
  const level = h('span', { class: 'gt-level', 'data-testid': 'level' });
  const xpFill = h('div', { class: 'gt-xp-fill' });
  const xpText = h('span', { class: 'gt-xp-text', 'data-testid': 'xp' });
  const rep = h('span', { 'data-testid': 'reputation' });
  const branch = h('span', { class: 'gt-branch', 'data-testid': 'branch', title: S.franchise.title(1) });
  const bar = h(
    'header',
    { class: 'gt-hud' },
    h('div', { class: 'gt-pill', title: S.coins }, '🪙 ', coins),
    h(
      'div',
      { class: 'gt-pill gt-xp', title: S.level },
      level,
      h('div', { class: 'gt-xp-bar' }, xpFill, xpText),
      branch,
    ),
    h('div', { class: 'gt-pill', title: S.reputation }, '⭐ ', rep),
  );
  root.append(bar);
  return (s: GameState) => {
    coins.textContent = String(s.coins);
    level.textContent = String(levelForXp(c, s.xp));
    xpText.textContent = `${s.xp} XP`;
    xpFill.style.width = `${Math.round(xpFraction(c, s.xp) * 100)}%`;
    rep.textContent = String(s.reputation);
    // from the second branch on, a small 🏢 N badge next to the level
    branch.hidden = s.prestige.branch < 2;
    branch.textContent = `🏢 ${s.prestige.branch}`;
    branch.title = S.franchise.title(s.prestige.branch);
  };
}
