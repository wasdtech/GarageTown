import { loadContent } from '@gt/shared';
import Phaser from 'phaser';
import { createController } from './controller';
import { openScrubMinigame } from './minigames/scrub';
import { GarageScene } from './scenes/GarageScene';
import { loadGame, saveGame } from './state/storage';
import { Store } from './state/store';
import { createHud } from './ui/hud';
import { createToaster } from './ui/toast';
import './ui/theme.css';

const content = loadContent();
document.title = content.brand.name;
const clock = () => Date.now();
const ui = document.getElementById('ui')!;
const store = new Store(content, loadGame(content, clock()), clock, saveGame);
const updateHud = createHud(ui, content);
const toast = createToaster(ui);
store.subscribe(updateHud);
updateHud(store.state);

const scene = new GarageScene();
scene.onReady = () => {
  const { render } = createController({
    content,
    store,
    scene,
    ui,
    clock,
    toast,
    openMinigame: (carKey) =>
      new Promise((resolve) => {
        const sprite = content.cars.find((c) => c.key === carKey)?.sprite ?? content.cars[0]!.sprite;
        openScrubMinigame(ui, sprite, resolve, () => resolve(null));
      }),
  });
  render();
  setInterval(() => store.tick(), 1000);
};
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2d42',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [],
}).scene.add('garage', scene, true, { content });

document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store.save());
window.addEventListener('pagehide', () => store.save());
