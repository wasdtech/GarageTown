import type { IdleReport } from '@gt/sim';
import { h } from './dom';
import { S } from './strings';

/** "While you were away" sheet; the coins are already counted, the button is the celebration. */
export function openWelcomeBack(
  root: HTMLElement,
  report: IdleReport,
  awayMs: number,
  onCollect: (from: { x: number; y: number }) => void,
) {
  const btn = h('button', { class: 'gt-btn', 'data-testid': 'welcome-collect' }, S.welcome.collect);
  const panel = h(
    'div',
    {
      class: 'gt-sheet gt-welcome',
      role: 'dialog',
      'aria-label': S.welcome.title,
      'data-testid': 'welcome-back',
    },
    h('h2', {}, S.welcome.title),
    h('p', { class: 'gt-muted' }, S.welcome.away(awayMs)),
    h(
      'div',
      { class: 'gt-welcome-stats' },
      h('div', {}, h('b', {}, String(report.jobs)), h('span', {}, S.welcome.cars)),
      h('div', {}, h('b', {}, `+${report.coins}`), h('span', {}, '🪙')),
      h('div', {}, h('b', {}, `+${report.xp}`), h('span', {}, 'XP')),
    ),
    btn,
  );
  const backdrop = h('div', { class: 'gt-backdrop' }, panel);
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    backdrop.remove();
    onCollect({ x: r.left + r.width / 2, y: r.top });
  });
  root.append(backdrop);
}
