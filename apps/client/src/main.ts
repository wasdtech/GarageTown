import { loadContent } from '@gt/shared';
import { tick } from '@gt/sim';
import Phaser from 'phaser';
import { GarageScene } from './scenes/GarageScene';
import { loadGame } from './state/storage';
import './ui/theme.css';

const content = loadContent();
document.title = content.brand.name;
let state = loadGame(content, Date.now());

const scene = new GarageScene();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2d42',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [],
});
scene.onReady = () => {
  const render = () => {
    state = tick(content, state, Date.now());
    scene.renderState(state, Date.now(), { selectedCustomerId: null });
  };
  render();
  setInterval(render, 1000);
};
game.scene.add('garage', scene, true, { content });
