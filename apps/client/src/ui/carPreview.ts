import type { CarLook } from '@gt/sim';

const cache = new Map<string, Promise<HTMLImageElement>>();

function img(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

const STICKER_GLYPH: Record<string, string> = { number: '7', bolt: '⚡', star: '★' };

/** Draws a car with its look onto a canvas (shadow, tinted body, finish sheen, details, neon, sticker). */
export async function drawCarPreview(
  canvas: HTMLCanvasElement,
  sprite: string,
  look: CarLook,
  paintHex: string,
) {
  const [shadow, body, details] = await Promise.all(
    ['shadow', 'body', 'details'].map((l) => img(`cars/${sprite}/${l}.png`)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const s = Math.min((W * 0.85) / body!.width, (H * 0.8) / body!.height);
  const w = body!.width * s;
  const h = body!.height * s;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  if (look.neon) {
    const g = ctx.createRadialGradient(W / 2, y + h * 0.78, 4, W / 2, y + h * 0.78, w * 0.55);
    g.addColorStop(0, 'rgba(76,201,240,0.85)');
    g.addColorStop(1, 'rgba(76,201,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(shadow!, x, y, w, h);
  // tint the greyscale body: multiply with the paint, then keep only the body's pixels
  const off = document.createElement('canvas');
  off.width = Math.ceil(w);
  off.height = Math.ceil(h);
  const o = off.getContext('2d')!;
  o.drawImage(body!, 0, 0, w, h);
  o.globalCompositeOperation = 'multiply';
  o.fillStyle = paintHex;
  o.fillRect(0, 0, w, h);
  if (look.finish !== 'matte') {
    o.globalCompositeOperation = 'screen';
    const sheen = o.createLinearGradient(0, 0, w, h);
    const tint =
      look.finish === 'pearl'
        ? ['rgba(184,242,255,0.55)', 'rgba(255,196,240,0.55)']
        : ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'];
    sheen.addColorStop(0, tint[0]!);
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, tint[1]!);
    o.fillStyle = sheen;
    o.fillRect(0, 0, w, h);
  }
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(body!, 0, 0, w, h);
  ctx.drawImage(off, x, y);
  ctx.drawImage(details!, x, y, w, h);
  if (look.sticker) {
    ctx.font = `800 ${Math.round(h * 0.18)}px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1d1d2b';
    ctx.fillStyle = '#ffffff';
    const gx = x + w * 0.38;
    const gy = y + h * 0.5;
    const glyph = STICKER_GLYPH[look.sticker] ?? '★';
    ctx.strokeText(glyph, gx, gy);
    ctx.fillText(glyph, gx, gy);
  }
}
