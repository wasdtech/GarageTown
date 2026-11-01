import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 600,
  backgroundColor: '#2b2d42',
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [BootScene],
});
