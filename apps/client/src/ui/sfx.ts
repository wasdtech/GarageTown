/** Tiny synthesized sound effects (Web Audio): no audio files, nothing to download. */
export const MUTE_KEY = 'gt.muted';
export const MUSIC_KEY = 'gt.music';

type Note = { f: number; t: number; d: number; type?: OscillatorType; vol?: number; slideTo?: number };

type SoundKey =
  | 'coin'
  | 'click'
  | 'levelUp'
  | 'build'
  | 'horn'
  | 'engine'
  | 'error'
  | 'menu'
  | 'register'
  | 'hired'
  | 'scrub'
  | 'welcome'
  | 'branch'
  | 'beep'
  | 'beepGo'
  | 'nitro'
  | 'medal';

const SOUNDS: Record<SoundKey, Note[]> = {
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
  horn: [
    { f: 415, t: 0, d: 0.16, type: 'sawtooth', vol: 0.06 },
    { f: 523, t: 0, d: 0.16, type: 'sawtooth', vol: 0.05 },
    { f: 415, t: 0.22, d: 0.22, type: 'sawtooth', vol: 0.06 },
    { f: 523, t: 0.22, d: 0.22, type: 'sawtooth', vol: 0.05 },
  ],
  engine: [{ f: 70, t: 0, d: 0.7, type: 'sawtooth', vol: 0.07, slideTo: 160 }],
  error: [
    { f: 220, t: 0, d: 0.12, type: 'square', vol: 0.07 },
    { f: 165, t: 0.13, d: 0.18, type: 'square', vol: 0.07 },
  ],
  menu: [{ f: 880, t: 0, d: 0.06, type: 'sine', vol: 0.1, slideTo: 1320 }],
  register: [
    { f: 1568, t: 0, d: 0.08, type: 'triangle', vol: 0.1 },
    { f: 2093, t: 0.08, d: 0.25, type: 'triangle', vol: 0.1 },
    { f: 120, t: 0, d: 0.12, type: 'square', vol: 0.05 },
  ],
  hired: [392, 523, 659].map((f, i) => ({ f, t: i * 0.08, d: 0.16, type: 'square' as const, vol: 0.07 })),
  scrub: [{ f: 900, t: 0, d: 0.05, type: 'sawtooth', vol: 0.025, slideTo: 1400 }],
  welcome: [392, 523, 659, 784, 659, 1047].map((f, i) => ({
    f,
    t: i * 0.1,
    d: 0.2,
    type: 'triangle' as const,
    vol: 0.12,
  })),
  // race: start-light beeps, a nitro whoosh and a medal fanfare
  beep: [{ f: 660, t: 0, d: 0.18, type: 'square', vol: 0.07 }],
  beepGo: [{ f: 1320, t: 0, d: 0.4, type: 'square', vol: 0.08 }],
  nitro: [{ f: 180, t: 0, d: 0.6, type: 'sawtooth', vol: 0.06, slideTo: 900 }],
  medal: [523, 659, 784, 1047, 1319].map((f, i) => ({
    f,
    t: i * 0.08,
    d: 0.3,
    type: 'triangle' as const,
    vol: 0.12,
  })),
  // a rising fanfare for a new branch, ending on a held chord
  branch: [
    ...[523, 659, 784, 1047].map((f, i) => ({
      f,
      t: i * 0.09,
      d: 0.18,
      type: 'triangle' as const,
      vol: 0.12,
    })),
    ...[523, 659, 784].map((f) => ({ f, t: 0.42, d: 0.6, type: 'triangle' as const, vol: 0.08 })),
  ],
};

/** A calm 4-chord loop (I–vi–IV–V in C), one bar every 2 s, played very softly. */
const MUSIC_BARS: number[][] = [
  [261.6, 329.6, 392.0],
  [220.0, 261.6, 329.6],
  [174.6, 220.0, 261.6],
  [196.0, 246.9, 293.7],
];
const BAR_S = 2;

function readFlag(storage: Storage | null, key: string, fallback: boolean): boolean {
  try {
    const v = storage?.getItem(key);
    return v === null || v === undefined ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(storage: Storage | null, key: string, v: boolean) {
  try {
    storage?.setItem(key, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function createSfx(storage: Storage | null, Ctx: typeof AudioContext | undefined) {
  let muted = readFlag(storage, MUTE_KEY, false);
  let musicOn = readFlag(storage, MUSIC_KEY, true);
  let ctx: AudioContext | null = null;
  let musicTimer: ReturnType<typeof setInterval> | null = null;
  let bar = 0;

  const play = (notes: Note[], force = false) => {
    if ((muted && !force) || !Ctx) return;
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

  const playBar = () => {
    const chord = MUSIC_BARS[bar % MUSIC_BARS.length]!;
    bar++;
    // soft pad plus a two-note bass; forced so muting effects does not stop the music
    play(
      [
        ...chord.map((f) => ({ f, t: 0, d: BAR_S * 0.95, type: 'sine' as const, vol: 0.018 })),
        { f: chord[0]! / 2, t: 0, d: BAR_S * 0.45, type: 'triangle', vol: 0.03 },
        { f: chord[0]! / 2, t: BAR_S / 2, d: BAR_S * 0.45, type: 'triangle', vol: 0.03 },
      ],
      true,
    );
  };

  const startMusic = () => {
    if (!musicOn || !Ctx) return;
    // every call (each user gesture) may unlock a context that started suspended
    try {
      if (ctx?.state === 'suspended') void ctx.resume();
    } catch {
      /* ignore */
    }
    if (musicTimer) return;
    playBar();
    musicTimer = setInterval(playBar, BAR_S * 1000);
  };
  const stopMusic = () => {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  };

  // a continuous engine note for the race, its pitch following the rpm
  let engine: { osc: OscillatorNode; gain: GainNode } | null = null;
  const revStart = () => {
    if (muted || !Ctx || engine) return;
    try {
      ctx ??= new Ctx();
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 40;
      gain.gain.value = 0.03;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      engine = { osc, gain };
    } catch {
      /* sound is optional */
    }
  };
  const rev = (rpm: number) => {
    if (!engine || !ctx) return;
    engine.osc.frequency.setTargetAtTime(30 + rpm / 60, ctx.currentTime, 0.03);
  };
  const revStop = () => {
    if (!engine) return;
    try {
      engine.osc.stop();
    } catch {
      /* already stopped */
    }
    engine = null;
  };

  const sound = (k: SoundKey) => () => play(SOUNDS[k]);
  return {
    get muted() {
      return muted;
    },
    get musicOn() {
      return musicOn;
    },
    setMuted(v: boolean) {
      muted = v;
      writeFlag(storage, MUTE_KEY, v);
    },
    setMusic(v: boolean) {
      musicOn = v;
      writeFlag(storage, MUSIC_KEY, v);
      if (v) startMusic();
      else stopMusic();
    },
    startMusic,
    stopMusic,
    coin: sound('coin'),
    click: sound('click'),
    levelUp: sound('levelUp'),
    build: sound('build'),
    horn: sound('horn'),
    engine: sound('engine'),
    error: sound('error'),
    menu: sound('menu'),
    register: sound('register'),
    hired: sound('hired'),
    scrub: sound('scrub'),
    welcome: sound('welcome'),
    branch: sound('branch'),
    beep: sound('beep'),
    beepGo: sound('beepGo'),
    nitro: sound('nitro'),
    medal: sound('medal'),
    revStart,
    rev,
    revStop,
  };
}

export type Sfx = ReturnType<typeof createSfx>;
