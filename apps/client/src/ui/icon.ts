import { h } from './dom';

/** Drawn UI icons in art/src/ui (96px art shown at 48px or less). */
export type IconName =
  | 'car'
  | 'dealer'
  | 'team'
  | 'franchise'
  | 'coin'
  | 'star'
  | 'seal'
  | 'music'
  | 'sound'
  | 'sound_off'
  | 'zoom_in'
  | 'zoom_out'
  | `helper_${string}`
  | `perk_${string}`;

/** A decorative icon: the text or aria-label next to it carries the meaning. */
export function icon(name: IconName, cls = ''): HTMLImageElement {
  return h('img', {
    class: `gt-icon${cls ? ` ${cls}` : ''}`,
    src: `ui/${name}.png`,
    alt: '',
    'aria-hidden': 'true',
    draggable: 'false',
  }) as HTMLImageElement;
}
