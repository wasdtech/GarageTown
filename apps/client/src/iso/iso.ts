export const TILE_W = 64;
export const TILE_H = 32;

export interface Point {
  x: number;
  y: number;
}

/** Screen position of the top corner of tile (x, y). */
export function isoToScreen(x: number, y: number, origin: Point): Point {
  return { x: origin.x + (x - y) * (TILE_W / 2), y: origin.y + (x + y) * (TILE_H / 2) };
}

/** Integer tile containing the screen point. */
export function screenToIso(px: number, py: number, origin: Point): Point {
  const dx = (px - origin.x) / (TILE_W / 2);
  const dy = (py - origin.y) / (TILE_H / 2);
  return { x: Math.floor((dy + dx) / 2), y: Math.floor((dy - dx) / 2) };
}

export function depthOf(x: number, y: number): number {
  return x + y;
}
