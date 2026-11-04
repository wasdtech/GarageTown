import type { Content } from '@gt/shared';
import { carStats, type GameState, type RaceTarget, rachasLeft, rachaStake, trackUnlocked } from '@gt/sim';
import { drawCarPreview } from './carPreview';
import { h } from './dom';
import { S } from './strings';

/** What a track card shows: open or locked, medals won, your PI against the recommended one. */
export function trackCard(
  c: Content,
  s: GameState,
  key: string,
): { unlocked: boolean; medals: [boolean, boolean, boolean]; piYours: number; piTarget: number } {
  const def = c.race.tracks.find((t) => t.key === key)!;
  const won = s.race.medals[key] ?? 0;
  const car = s.collection.cars.find((x) => x.id === s.collection.activeCarId) ?? s.collection.cars[0]!;
  return {
    unlocked: trackUnlocked(c, s, key),
    medals: [won >= 1, won >= 2, won >= 3],
    piYours: carStats(c, car).pi,
    piTarget: def.pi,
  };
}

const MEDALS = ['bronze', 'silver', 'gold'] as const;

/** The three street race bets: each open only when street races are open, left today and affordable. */
export function rachaOptions(c: Content, s: GameState, now: number): { stake: number; enabled: boolean }[] {
  const open = s.race.beaten.includes(c.race.rachas.unlockTrack) && rachasLeft(c, s, now) > 0;
  return ([0, 1, 2] as const).map((i) => {
    const stake = rachaStake(c, s, i);
    return { stake, enabled: open && s.coins >= stake };
  });
}

/** "Arrancada" menu: league tracks with medals and the rival's car, and the street race bets. */
export function raceTab(c: Content, s: GameState, now: number, onRace: (t: RaceTarget) => void): Node[] {
  const tracks = c.race.tracks.map((def) => {
    const card = trackCard(c, s, def.key);
    const model = c.cars.find((m) => m.key === def.rival.car)!;
    const thumb = h('canvas', { class: 'gt-car-thumb', width: '480', height: '300' });
    const look = {
      paint: c.looks.paints[1]?.key ?? c.looks.paints[0]!.key,
      finish: c.looks.finishes[0]!.key,
      neon: false,
      sticker: null,
    };
    const hex = c.looks.paints.find((p) => p.key === look.paint)?.hex ?? '#3a86ff';
    void drawCarPreview(thumb, model.sprite, look, hex).catch(() => undefined);
    const go = h(
      'button',
      { class: 'gt-btn', 'data-testid': `race-${def.key}`, ...(card.unlocked ? {} : { disabled: '' }) },
      card.unlocked ? S.race.go : S.race.lockedTrack,
    );
    go.addEventListener('click', () => card.unlocked && onRace({ track: def.key }));
    return h(
      'div',
      {
        class: `gt-team-card gt-track${card.unlocked ? '' : ' gt-locked'}`,
        'data-testid': `track-${def.key}`,
      },
      h('div', { class: 'gt-track-thumb' }, thumb),
      h('strong', { class: 'gt-track-name' }, def.name),
      h('span', { class: 'gt-muted' }, S.race.rival(def.rival.name)),
      h(
        'div',
        { class: 'gt-medals', 'aria-label': S.race.medalsLabel(card.medals.filter(Boolean).length) },
        ...MEDALS.map((m, i) =>
          h('img', {
            class: `gt-medal${card.medals[i] ? '' : ' gt-medal-dim'}`,
            src: `ui/medal_${m}.png`,
            alt: '',
            draggable: 'false',
          }),
        ),
      ),
      h(
        'div',
        { class: 'gt-chips' },
        h('span', { class: 'gt-chip' }, S.race.piTarget(card.piTarget)),
        h(
          'span',
          { class: `gt-chip${card.piYours >= card.piTarget ? ' gt-chip-next' : ''}` },
          S.race.piYours(card.piYours),
        ),
      ),
      go,
    );
  });

  const open = s.race.beaten.includes(c.race.rachas.unlockTrack);
  const left = rachasLeft(c, s, now);
  const stakes = rachaOptions(c, s, now).map((o, n) => {
    const i = n as 0 | 1 | 2;
    const b = h(
      'button',
      { class: 'gt-btn', 'data-testid': `racha-${i}`, ...(o.enabled ? {} : { disabled: '' }) },
      S.race.stake[i](o.stake),
    );
    b.addEventListener('click', () => o.enabled && onRace({ racha: i }));
    return b;
  });
  const unlockName = c.race.tracks.find((t) => t.key === c.race.rachas.unlockTrack)?.name ?? '';
  const rachas = h(
    'div',
    { class: `gt-team-card gt-wide${open ? '' : ' gt-locked'}` },
    h('div', { class: 'gt-team-head' }, h('strong', {}, S.race.rachas)),
    h('span', { class: 'gt-muted' }, open ? S.race.rachasPitch : S.race.rachasLocked(unlockName)),
    h(
      'span',
      { class: 'gt-chip', 'data-testid': 'rachas-left' },
      S.race.rachasLeft(left, c.race.rachas.perDay),
    ),
    h('div', { class: 'gt-row gt-stakes' }, ...stakes),
  );
  return [h('p', { class: 'gt-intro gt-wide' }, S.race.intro), ...tracks, rachas];
}
