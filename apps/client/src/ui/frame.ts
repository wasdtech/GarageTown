import { h } from './dom';
import { S } from './strings';

/** Colour family of a sheet's header ribbon. */
export type Tone = 'car' | 'dealer' | 'team' | 'franchise' | 'jobs' | 'welcome';

/** A sheet's header: coloured ribbon with the menu's drawn icon, the title and a round close button. */
export function sheetHead(title: string, art: string | null, onClose: (() => void) | null, ...extra: Node[]) {
  return h(
    'div',
    { class: 'gt-sheet-head' },
    art
      ? h('img', {
          class: 'gt-icon gt-head-icon',
          src: art,
          alt: '',
          'aria-hidden': 'true',
          draggable: 'false',
        })
      : null,
    h('h2', {}, title),
    ...extra,
    onClose
      ? h('button', { class: 'gt-close', 'aria-label': S.close, title: S.close, onclick: onClose }, '✕')
      : null,
  );
}
