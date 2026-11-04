import { greenBand, RPM_MAX, type RaceOutcome, type ShiftGrade } from '@gt/sim';
import type { RaceRun, RaceSnapshot } from '../race/raceRun';
import { h } from './dom';
import { S } from './strings';
import { TACH_DIAL, tachArc, tachAngle } from './tach';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string>) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/**
 * The race overlay: start lights, a big tachometer with the green band, gear and speed, the
 * go/shift and nitro buttons, the grade pop-ups and the result panel.
 */
export function createRaceHud(
  root: HTMLElement,
  run: RaceRun,
  grip: number,
  on: { quit(): void; again(): void; back(): void },
) {
  const lamps = [0, 1, 2].map((i) => h('span', { class: 'gt-lamp', 'data-lamp': String(i) }));
  const lights = h(
    'div',
    { class: 'gt-lights', 'data-testid': 'race-lights' },
    h('img', { src: 'race/lights.png', alt: '', draggable: 'false' }),
    ...lamps,
  );

  // tachometer: dial, green band, perfect band, needle
  const band = greenBand(grip);
  const { w: dialW, h: dialH, cx, cy, r } = TACH_DIAL;
  const dial = svg('svg', { viewBox: `0 0 ${dialW} ${dialH}`, class: 'gt-tach', 'aria-hidden': 'true' });
  dial.append(
    svg('path', { d: tachArc(cx, cy, r, 1000, RPM_MAX), class: 'gt-tach-track' }),
    svg('path', { d: tachArc(cx, cy, r, band.lo, band.hi), class: 'gt-tach-green' }),
    svg('path', { d: tachArc(cx, cy, r, band.perfectLo, band.perfectHi), class: 'gt-tach-perfect' }),
  );
  const needle = svg('line', {
    x1: String(cx),
    y1: String(cy),
    x2: String(cx),
    y2: String(cy - r + 10),
    class: 'gt-tach-needle',
  });
  dial.append(needle, svg('circle', { cx: String(cx), cy: String(cy), r: '8', class: 'gt-tach-hub' }));

  const gear = h('b', { class: 'gt-gear', 'data-testid': 'race-gear' }, '1');
  const speed = h('span', { class: 'gt-speed', 'data-testid': 'race-speed' }, '0 km/h');
  // the keyboard works too: Space holds/shifts, N fires the nitro
  const go = h(
    'button',
    { class: 'gt-btn gt-race-go', 'data-testid': 'race-go', 'aria-keyshortcuts': 'Space' },
    S.race.hold,
  );
  const nitro = h(
    'button',
    { class: 'gt-btn gt-race-nitro', 'data-testid': 'race-nitro', 'aria-keyshortcuts': 'N' },
    S.race.nitro,
  );
  const quit = h(
    'button',
    { class: 'gt-close gt-race-quit', 'data-testid': 'race-quit', 'aria-label': S.race.quit },
    '✕',
  );
  const pop = h('div', { class: 'gt-race-pop', 'aria-live': 'polite' });

  const press = (e: Event) => {
    e.preventDefault();
    run.goDown();
  };
  const lift = (e: Event) => {
    e.preventDefault();
    run.goUp();
  };
  go.addEventListener('pointerdown', (e) => {
    // keep the finger's pointer on the button: sliding off it before letting go still launches
    try {
      go.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no live pointer */
    }
    press(e);
  });
  go.addEventListener('pointerup', lift);
  go.addEventListener('pointercancel', lift);
  nitro.addEventListener('click', () => run.nitro());
  quit.addEventListener('click', () => on.quit());
  const keyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) press(e);
    else if (e.code === 'KeyN') run.nitro();
    else if (e.code === 'Escape') on.quit();
  };
  const keyUp = (e: KeyboardEvent) => e.code === 'Space' && lift(e);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  const hud = h(
    'div',
    { class: 'gt-race-hud', 'data-testid': 'race-hud' },
    quit,
    lights,
    pop,
    h(
      'div',
      { class: 'gt-race-panel' },
      h(
        'div',
        { class: 'gt-tach-box' },
        dial,
        h(
          'div',
          { class: 'gt-tach-read' },
          h('span', {}, h('span', { class: 'gt-sr-only' }, `${S.race.gearLabel} `), gear),
          speed,
        ),
      ),
      h('div', { class: 'gt-race-buttons' }, go, nitro),
    ),
  );
  root.append(hud);

  const popText = (text: string, kind: string) => {
    const el = h('div', { class: `gt-pop gt-pop-${kind}` }, text);
    pop.append(el);
    setTimeout(() => el.remove(), 900);
  };
  const GRADE: Record<ShiftGrade, string> = { perfect: S.race.perfect, good: S.race.good, bad: S.race.bad };

  return {
    update(s: RaceSnapshot) {
      s.lights.forEach((l, i) => lamps[i]!.setAttribute('data-on', l));
      needle.setAttribute('transform', `rotate(${tachAngle(s.rpm)} ${cx} ${cy})`);
      gear.textContent = String(s.view.gear);
      speed.textContent = `${Math.round(s.view.speed * 3.6)} km/h`;
      go.textContent = s.view.phase === 'countdown' ? S.race.hold : S.race.shift;
      nitro.toggleAttribute('disabled', s.view.nitroUsed || s.view.phase === 'countdown');
      if (s.graded) popText(GRADE[s.graded], s.graded);
      if (s.jumped) popText(S.race.jumped, 'bad');
    },
    showResult(o: RaceOutcome, trackName: string) {
      const fmt = (ms: number) => `${(ms / 1000).toFixed(3).replace('.', ',')} s`;
      const medal = (['', 'bronze', 'silver', 'gold'] as const)[o.medal];
      const title = o.won ? S.race.won : o.tie ? S.race.tie : S.race.lost;
      const again = h('button', { class: 'gt-btn', 'data-testid': 'race-again' }, S.race.again);
      const back = h('button', { class: 'gt-btn gt-btn-ghost', 'data-testid': 'race-back' }, S.race.back);
      again.addEventListener('click', () => on.again());
      back.addEventListener('click', () => on.back());
      const panel = h(
        'div',
        { class: 'gt-sheet gt-race-result gt-tone-race', role: 'dialog', 'data-testid': 'race-result' },
        h('div', { class: 'gt-sheet-head' }, h('h2', {}, `${title} · ${trackName}`)),
        h(
          'div',
          { class: 'gt-sheet-body' },
          h(
            'div',
            { class: 'gt-race-times' },
            h(
              'div',
              {},
              h('span', {}, S.race.you),
              h('b', {}, o.player.finished ? fmt(o.player.timeMs) : '—'),
            ),
            h(
              'div',
              {},
              h('span', {}, S.race.rivalTime),
              h('b', {}, o.rival.finished ? fmt(o.rival.timeMs) : '—'),
            ),
          ),
          medal
            ? h(
                'div',
                { class: 'gt-race-medal', 'data-testid': 'race-medal', 'data-medal': medal },
                h('img', { src: `ui/medal_${medal}.png`, alt: '' }),
                h('strong', {}, S.race.medalName[o.medal - 1]!),
              )
            : h(
                'p',
                { class: 'gt-muted', 'data-testid': 'race-medal', 'data-medal': 'none' },
                S.race.noMedal,
              ),
          o.stake
            ? h(
                'p',
                {},
                o.won ? S.race.stakeWon(o.coins) : o.tie ? S.race.stakeBack : S.race.stakeLost(o.stake),
              )
            : null,
          !o.stake && (o.coins || o.xp)
            ? h('p', { class: 'gt-race-prize' }, S.race.prize(o.coins, o.xp))
            : null,
          h('div', { class: 'gt-row' }, again, back),
        ),
      );
      hud.append(h('div', { class: 'gt-backdrop' }, panel));
    },
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      hud.remove();
    },
  };
}
