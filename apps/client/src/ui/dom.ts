type Child = Node | string | null | undefined | false;
type Props = { [attr: string]: string | undefined | ((e: Event) => void) };

/** Marks where the drawn coin goes when a text is split on the coin emoji. */
export const COIN = Symbol('coin');
const COIN_EMOJI = '🪙';

/** Splits a text on the coin emoji: plain pieces stay strings, each coin becomes COIN. */
export function splitCoins(text: string): (string | typeof COIN)[] {
  const out: (string | typeof COIN)[] = [];
  text.split(COIN_EMOJI).forEach((piece, i) => {
    if (i > 0) out.push(COIN);
    if (piece) out.push(piece);
  });
  return out;
}

/** The drawn coin (art/src/ui/coin.png), sized to the surrounding text. */
export function coinImg(): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'gt-icon gt-coin';
  img.src = 'ui/coin.png';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  return img;
}

/** Appends a text, drawing the coin wherever the text has the coin emoji. */
export function appendText(el: Element, text: string): void {
  for (const p of splitCoins(text)) el.append(p === COIN ? coinImg() : p);
}

/** Tiny DOM builder: string props become attributes, `onclick` becomes a listener. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') appendText(el, c);
    else if (c) el.append(c);
  }
  return el;
}
