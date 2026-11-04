/** How far a car rolls past the finish line while braking to a stop (m). */
export const COAST_M = 30;
/** Camera lag: how long it takes to cover ~63% of the way to its target (ms). */
const CAMERA_LAG_MS = 140;
/** The rival must be this far ahead (m) before the camera leaves your car. */
const LEAD_MARGIN_M = 5;

/**
 * Metres rolled past the line `dtMs` after crossing it at `speed` m/s, braking evenly so the car
 * stops exactly COAST_M later. It leaves the line at its own speed, so there is no visible jump.
 */
export function coastMeters(speed: number, dtMs: number): number {
  if (speed <= 0 || dtMs <= 0) return 0;
  const decel = (speed * speed) / (2 * COAST_M);
  const t = Math.min(dtMs / 1000, speed / decel);
  return Math.min(COAST_M, speed * t - 0.5 * decel * t * t);
}

/** Which car the camera follows. */
export function leaderOf(youMeters: number, rivalMeters: number): 'you' | 'rival' {
  return rivalMeters > youMeters + LEAD_MARGIN_M ? 'rival' : 'you';
}

/** One frame of camera easing toward `target` (frame-rate independent, never overshoots). */
export function smoothToward(current: number, target: number, dtMs: number): number {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / CAMERA_LAG_MS);
  return current + (target - current) * k;
}
