import { MINIGAME_MIN_GESTURE_MS } from '@gt/sim';
import { h } from '../ui/dom';
import { S } from '../ui/strings';

const MAX_STEP_PX = 400;
const TARGET_PX = 3000;

/** Accumulates scrubbing distance; each movement counts at most 400px so one long drag can't finish it. */
export function createScrubTracker(targetPx: number) {
  let dist = 0;
  let first: number | null = null;
  let last = 0;
  return {
    add(dxPx: number, dyPx: number, tMs: number) {
      dist += Math.min(MAX_STEP_PX, Math.hypot(dxPx, dyPx));
      if (first === null) first = tMs;
      last = tMs;
    },
    progress: () => Math.min(1, dist / targetPx),
    elapsedMs: () => (first === null ? 0 : last - first),
  };
}

function drawDirt(ctx: CanvasRenderingContext2D, w: number, hgt: number) {
  const colours = ['#7f5539', '#9c6644', '#6f4518', '#a68a64'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = colours[i % colours.length]!;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(
      w * (0.12 + rnd() * 0.76),
      hgt * (0.2 + rnd() * 0.6),
      14 + rnd() * 26,
      10 + rnd() * 18,
      rnd() * 3,
      0,
      7,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Full-screen "scrub the car" overlay. Calls onDone with the gesture time once clean and ≥ 5 s. */
export function openScrubMinigame(
  root: HTMLElement,
  carSprite: string,
  onDone: (gestureMs: number) => void,
  onCancel: () => void,
) {
  const tracker = createScrubTracker(TARGET_PX);
  const W = 320;
  const H = 200;
  const canvas = h('canvas', {
    class: 'gt-dirt',
    width: String(W),
    height: String(H),
    'data-testid': 'scrub',
  });
  const ctx = canvas.getContext('2d')!;
  drawDirt(ctx, W, H);
  const ring = h('div', { class: 'gt-ring' }, '0%');
  const hint = h('p', { class: 'gt-muted' }, S.scrubTitle);
  const car = h(
    'div',
    { class: 'gt-scrub-car' },
    ...['shadow', 'body', 'details'].map((l) => h('img', { src: `cars/${carSprite}/${l}.png`, alt: '' })),
    canvas,
  );
  let finished = false;
  let firstT: number | null = null;
  const close = () => overlay.remove();
  const cancel = h('button', { class: 'gt-btn gt-btn-ghost', 'data-testid': 'scrub-cancel' }, S.leaveAuto);
  cancel.addEventListener('click', () => {
    finished = true;
    close();
    onCancel();
  });
  const overlay = h(
    'div',
    { class: 'gt-backdrop gt-scrub' },
    h('div', { class: 'gt-sheet' }, h('h2', {}, S.scrubTitle), car, ring, hint, cancel),
  );
  root.append(overlay);

  let prev: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    prev = { x: e.offsetX, y: e.offsetY };
  });
  canvas.addEventListener('pointerup', () => (prev = null));
  canvas.addEventListener('pointermove', (e) => {
    if (!prev || finished) return;
    const t = performance.now();
    firstT ??= t;
    const scale = W / canvas.getBoundingClientRect().width;
    const x = e.offsetX * scale;
    const y = e.offsetY * scale;
    tracker.add(x - prev.x * scale, y - prev.y * scale, t);
    prev = { x: e.offsetX, y: e.offsetY };
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, 7);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const p = tracker.progress();
    ring.textContent = `${Math.round(p * 100)}%`;
    ring.style.setProperty('--p', String(p));
    if (p < 1) return;
    finished = true;
    const elapsed = t - firstT;
    const wait = Math.max(0, MINIGAME_MIN_GESTURE_MS - elapsed);
    if (wait > 0) hint.textContent = S.scrubMore;
    setTimeout(() => {
      close();
      onDone(Math.max(MINIGAME_MIN_GESTURE_MS, elapsed));
    }, wait + 150);
  });
}
