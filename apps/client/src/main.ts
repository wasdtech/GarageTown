import { loadContent } from '@gt/shared';
import Phaser from 'phaser';
import { createController } from './controller';
import { openScrubMinigame } from './minigames/scrub';
import { GarageScene } from './scenes/GarageScene';
import { loadGame, saveGame } from './state/storage';
import { Store } from './state/store';
import { createHud } from './ui/hud';
import { h } from './ui/dom';
import { S } from './ui/strings';
import { createToaster } from './ui/toast';
import { createSfx } from './ui/sfx';
import { createTutorial } from './ui/tutorial';
import { coinFly, confetti } from './ui/juice';
import { presenceAction } from './ui/presence';
import { openWelcomeBack } from './ui/welcomeBack';
import './ui/theme.css';

const content = loadContent();
document.title = content.brand.name;
let clockOffset = 0;
const clock = () => Date.now() + clockOffset;
const ui = document.getElementById('ui')!;
const loaded = loadGame(content, clock());
const store = new Store(content, loaded.state, clock, saveGame);
const updateHud = createHud(ui, content);
const rawToast = createToaster(ui);
const sfx = createSfx(
  (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })(),
  globalThis.AudioContext,
);
const toast: typeof rawToast = (text, kind, ms) => {
  if (kind === 'bad') sfx.error();
  rawToast(text, kind, ms);
};
// browsers only allow audio after a user gesture: start the music on the first tap
// (touch pointerdown is not a user gesture for audio; pointerup/click/keydown are)
for (const ev of ['pointerup', 'click', 'keydown'])
  window.addEventListener(ev, () => sfx.startMusic(), { once: true });
// no music in the background (battery, and a phone switching apps should go quiet)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sfx.stopMusic();
  else sfx.startMusic();
});
store.subscribe(updateHud);
updateHud(store.state);
if (loaded.recovered === 'corrupt' || loaded.recovered === 'unknown_version') toast(S.saveReset, 'bad', 5000);

const scene = new GarageScene();
scene.onReady = () => {
  scene.onImpatient = () => sfx.horn();
  let tutorial: { emit: (e: 'select' | 'start' | 'collect' | 'garage') => void } | null = null;
  const { render, garage } = createController({
    garageOpts: { sfx: { hired: () => sfx.hired(), register: () => sfx.register(), menu: () => sfx.menu() } },
    content,
    store,
    scene,
    ui,
    clock,
    toast,
    sfx,
    onEvent: (e) => tutorial?.emit(e),
    openMinigame: (carKey) =>
      new Promise((resolve) => {
        const sprite = content.cars.find((c) => c.key === carKey)?.sprite ?? content.cars[0]!.sprite;
        openScrubMinigame(
          ui,
          sprite,
          resolve,
          () => resolve(null),
          () => sfx.scrub(),
        );
      }),
  });
  render();
  tutorial = createTutorial(ui, scene, store, clock);
  // presence: while the player looks at the game the helpers' shift keeps going; coming back
  // from a real absence (reload or a resumed background tab) shows what the team did
  let welcomeOpen = false;
  const checkPresence = () => {
    const action = presenceAction(store.state, clock(), {
      visible: document.visibilityState === 'visible',
      sheetOpen: welcomeOpen,
    });
    if (action === 'present') store.present();
    if (action !== 'welcome') return;
    welcomeOpen = true;
    const report = store.state.idleReport;
    openWelcomeBack(ui, report, clock() - store.state.lastActiveAt, (from) => {
      const coinsEl = ui.querySelector<HTMLElement>('[data-testid="coins"]')?.parentElement;
      if (coinsEl) coinFly(ui, from, coinsEl, report.coins);
      confetti(ui);
      sfx.welcome();
      welcomeOpen = false;
      store.present();
    });
  };
  checkPresence();
  setInterval(() => {
    store.tick();
    checkPresence();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    store.tick();
    checkPresence();
  });
  ui.append(
    h(
      'button',
      { class: 'gt-btn gt-garage-btn', 'data-testid': 'open-garage', onclick: garage },
      S.garage.open,
    ),
  );
  ui.append(
    h(
      'div',
      { class: 'gt-zoom' },
      musicButton(),
      muteButton(),
      h(
        'button',
        { class: 'gt-btn', 'aria-label': S.zoomIn, title: S.zoomIn, onclick: () => scene.zoomBy(1.2) },
        '+',
      ),
      h(
        'button',
        { class: 'gt-btn', 'aria-label': S.zoomOut, title: S.zoomOut, onclick: () => scene.zoomBy(1 / 1.2) },
        '−',
      ),
    ),
  );
  if (import.meta.env.MODE === 'test') {
    (window as unknown as { __gt: unknown }).__gt = {
      store,
      scene,
      clock: {
        advance(ms: number) {
          clockOffset += ms;
          store.tick();
        },
      },
    };
  }
};
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#86c96b',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  // only the canvas feeds the scene: clicks on DOM menus must not fall through to cars behind them
  input: { windowEvents: false },
  scene: [],
}).scene.add('garage', scene, true, { content });

function musicButton() {
  const b = h('button', { class: 'gt-btn', 'data-testid': 'music' });
  const paint = () => {
    b.textContent = sfx.musicOn ? '🎵' : '🎵̸';
    b.style.opacity = sfx.musicOn ? '1' : '0.55';
    b.setAttribute('aria-label', sfx.musicOn ? S.musicOff : S.musicOn);
    b.setAttribute('aria-pressed', String(!sfx.musicOn));
  };
  b.addEventListener('click', () => {
    sfx.setMusic(!sfx.musicOn);
    paint();
  });
  paint();
  return b;
}

function muteButton() {
  const b = h('button', { class: 'gt-btn', 'data-testid': 'mute' });
  const paint = () => {
    b.textContent = sfx.muted ? '🔇' : '🔊';
    b.setAttribute('aria-label', sfx.muted ? S.soundOn : S.soundOff);
    b.setAttribute('aria-pressed', String(sfx.muted));
  };
  b.addEventListener('click', () => {
    sfx.setMuted(!sfx.muted);
    paint();
    sfx.click();
  });
  paint();
  return b;
}

document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store.save());
window.addEventListener('pagehide', () => store.save());
