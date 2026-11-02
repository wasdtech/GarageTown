import { h } from './dom';

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Coins that fly from a point on screen into the HUD coin counter. */
export function coinFly(root: HTMLElement, from: { x: number; y: number }, to: HTMLElement, amount: number) {
  if (reducedMotion()) return;
  const end = to.getBoundingClientRect();
  const n = Math.min(8, Math.max(1, Math.ceil(amount / 6)));
  for (let i = 0; i < n; i++) {
    const coin = h('div', { class: 'gt-coin-fly', 'aria-hidden': 'true' }, '🪙');
    coin.style.left = `${from.x + (Math.random() - 0.5) * 40}px`;
    coin.style.top = `${from.y + (Math.random() - 0.5) * 24}px`;
    root.append(coin);
    const dx = end.left + end.width / 2 - from.x;
    const dy = end.top + end.height / 2 - from.y;
    const anim = coin.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.3 - 40}px)) scale(1.2)`,
          opacity: 1,
          offset: 0.35,
        },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.6 },
      ],
      { duration: 650 + i * 60, delay: i * 45, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      coin.remove();
      to.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 160 });
    };
  }
}

/** A short label that floats up and fades (e.g. "+3 XP"). */
export function floatText(root: HTMLElement, at: { x: number; y: number }, text: string) {
  const el = h('div', { class: 'gt-float-text', 'aria-hidden': 'true' }, text);
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  root.append(el);
  const anim = el.animate(
    [
      { transform: 'translate(-50%, 0)', opacity: 1 },
      { transform: 'translate(-50%, -48px)', opacity: 0 },
    ],
    { duration: reducedMotion() ? 600 : 1100, easing: 'ease-out', fill: 'forwards' },
  );
  anim.onfinish = () => el.remove();
}

/** A burst of confetti for level-ups. */
export function confetti(root: HTMLElement) {
  if (reducedMotion()) return;
  const colours = ['#ffd166', '#06d6a0', '#3a86ff', '#ef476f', '#8338ec'];
  for (let i = 0; i < 60; i++) {
    const bit = h('div', { class: 'gt-confetti', 'aria-hidden': 'true' });
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.background = colours[i % colours.length]!;
    root.append(bit);
    const anim = bit.animate(
      [
        { transform: `translateY(-20px) rotate(0deg)`, opacity: 1 },
        {
          transform: `translateY(${60 + Math.random() * 40}vh) rotate(${360 + Math.random() * 360}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1400 + Math.random() * 900,
        delay: Math.random() * 300,
        easing: 'cubic-bezier(.2,.6,.4,1)',
        fill: 'forwards',
      },
    );
    anim.onfinish = () => bit.remove();
  }
}
