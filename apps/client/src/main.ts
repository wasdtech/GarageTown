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
import { createTutorial } from './ui/tutorial';
import './ui/theme.css';

const content = loadContent();
document.title = content.brand.name;
let clockOffset = 0;
const clock = () => Date.now() + clockOffset;
const ui = document.getElementById('ui')!;
const loaded = loadGame(content, clock());
const store = new Store(content, loaded.state, clock, saveGame);
const updateHud = createHud(ui, content);
const toast = createToaster(ui);
store.subscribe(updateHud);
updateHud(store.state);
if (loaded.recovered === 'corrupt' || loaded.recovered === 'unknown_version') toast(S.saveReset, 'bad', 5000);

const scene = new GarageScene();
scene.onReady = () => {
  let tutorial: { emit: (e: 'select' | 'start' | 'collect' | 'garage') => void } | null = null;
  const { render, garage } = createController({
    content,
    store,
    scene,
    ui,
    clock,
    toast,
    onEvent: (e) => tutorial?.emit(e),
    openMinigame: (carKey) =>
      new Promise((resolve) => {
        const sprite = content.cars.find((c) => c.key === carKey)?.sprite ?? content.cars[0]!.sprite;
        openScrubMinigame(ui, sprite, resolve, () => resolve(null));
      }),
  });
  render();
  tutorial = createTutorial(ui, scene, store, clock);
  setInterval(() => store.tick(), 1000);
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
  scene: [],
}).scene.add('garage', scene, true, { content });

document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store.save());
window.addEventListener('pagehide', () => store.save());
