/** Tiny synthesized sound effects (Web Audio): no audio files, nothing to download. */
export const MUTE_KEY = 'gt.muted';

type Note = { f: number; t: number; d: number; type?: OscillatorType; vol?: number; slideTo?: number };

const SOUNDS: Record<'coin' | 'click' | 'levelUp' | 'build', Note[]> = {
  coin: [
    { f: 1318, t: 0, d: 0.08, type: 'square', vol: 0.08 },
    { f: 1975, t: 0.07, d: 0.18, type: 'square', vol: 0.08 },
  ],
  click: [{ f: 660, t: 0, d: 0.05, type: 'triangle', vol: 0.12 }],
  levelUp: [523, 659, 784, 1047].map((f, i) => ({
    f,
    t: i * 0.11,
    d: 0.22,
    type: 'triangle' as const,
    vol: 0.14,
  })),
  build: [
    { f: 180, t: 0, d: 0.09, type: 'square', vol: 0.1, slideTo: 90 },
    { f: 180, t: 0.16, d: 0.09, type: 'square', vol: 0.1, slideTo: 90 },
  ],
};

function readMuted(storage: Storage | null): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createSfx(storage: Storage | null, Ctx: typeof AudioContext | undefined) {
  let muted = readMuted(storage);
  let ctx: AudioContext | null = null;

  const play = (notes: Note[]) => {
    if (muted || !Ctx) return;
    try {
      ctx ??= new Ctx();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type ?? 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, now + n.t + n.d);
        gain.gain.setValueAtTime(n.vol ?? 0.1, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      }
    } catch {
      /* sound is optional */
    }
  };

  return {
    get muted() {
      return muted;
    },
    setMuted(v: boolean) {
      muted = v;
      try {
        storage?.setItem(MUTE_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    coin: () => play(SOUNDS.coin),
    click: () => play(SOUNDS.click),
    levelUp: () => play(SOUNDS.levelUp),
    build: () => play(SOUNDS.build),
  };
}

export type Sfx = ReturnType<typeof createSfx>;
