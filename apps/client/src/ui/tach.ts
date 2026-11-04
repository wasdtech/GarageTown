/** Tachometer geometry: 1,000..8,000 rpm sweep from -120° to +120° (0° points straight up). */
export const TACH_MIN = 1000;
export const TACH_MAX = 8000;
export const TACH_SWEEP = 120;

/** The dial's SVG box: the arc's ends sit below the centre, so the box leaves room for them. */
export const TACH_DIAL = { w: 200, h: 150, cx: 100, cy: 96, r: 84, stroke: 14 } as const;

export function tachAngle(rpm: number): number {
  const f = Math.min(1, Math.max(0, (rpm - TACH_MIN) / (TACH_MAX - TACH_MIN)));
  return -TACH_SWEEP + f * 2 * TACH_SWEEP;
}

/** An SVG arc path on a dial of radius r centred at (cx, cy), between two rpm values. */
export function tachArc(cx: number, cy: number, r: number, fromRpm: number, toRpm: number): string {
  const pt = (rpm: number) => {
    const a = ((tachAngle(rpm) - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const large = tachAngle(toRpm) - tachAngle(fromRpm) > 180 ? 1 : 0;
  return `M ${pt(fromRpm)} A ${r} ${r} 0 ${large} 1 ${pt(toRpm)}`;
}
