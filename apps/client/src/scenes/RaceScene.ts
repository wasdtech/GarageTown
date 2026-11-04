import { RACE_LENGTH_M } from '@gt/sim';
import Phaser from 'phaser';
import { depthOf, isoToScreen, type Point } from '../iso/iso';
import type { RaceRun, RaceSnapshot } from '../race/raceRun';

/** Metres per isometric tile along the strip: 400 m = 40 tiles. */
const M_PER_TILE = 10;
const TRACK_TILES = RACE_LENGTH_M / M_PER_TILE;
const LANE_PLAYER = 0.3;
const LANE_RIVAL = 2.1;
const CAR_FOOT_Y = 0.74;
const CAR_SCALE = 0.5;
const ORIGIN: Point = { x: 0, y: 0 };

export interface RaceSceneData {
  run: RaceRun;
  player: { sprite: string; paint: number };
  rival: { sprite: string; paint: number };
  onFrame(s: RaceSnapshot): void;
  onFinish(): void;
}

/** The drag strip: two lanes of street along the isometric x axis, grandstands, a finish gantry. */
export class RaceScene extends Phaser.Scene {
  private data_!: RaceSceneData;
  private you!: Phaser.GameObjects.Container;
  private rival!: Phaser.GameObjects.Container;
  private ended = false;
  private following: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('race');
  }

  init(data: RaceSceneData) {
    this.data_ = data;
    this.ended = false;
  }

  preload() {
    this.load.image('race_finish', 'race/finish.png');
    this.load.image('race_stands', 'race/stands.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#86c96b');
    // the strip: sidewalks either side of two street lanes
    for (let x = -8; x <= TRACK_TILES + 10; x++) {
      for (let y = -1; y <= 3; y++) {
        const p = isoToScreen(x, y, ORIGIN);
        const key = y === -1 || y === 3 ? 'sidewalk' : 'street';
        this.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(-1000);
      }
    }
    // start and finish lines across both lanes
    for (const x of [0, TRACK_TILES]) {
      const a = isoToScreen(x, 0, ORIGIN);
      const b = isoToScreen(x, 3, ORIGIN);
      this.add
        .line(0, 0, a.x, a.y, b.x, b.y, x === 0 ? 0xffffff : 0x1d1d2b)
        .setOrigin(0, 0)
        .setLineWidth(4)
        .setDepth(-900);
    }
    for (let x = 6; x < TRACK_TILES; x += 10) {
      const p = isoToScreen(x, -2.4, ORIGIN);
      this.add.image(p.x, p.y, 'race_stands').setOrigin(0.5, 0.85).setScale(0.45).setDepth(depthOf(x, -2.4));
    }
    const g = isoToScreen(TRACK_TILES, 1.5, ORIGIN);
    this.add
      .image(g.x, g.y + 18, 'race_finish')
      .setFlipX(true)
      .setOrigin(0.5, 0.78)
      .setScale(0.8)
      .setDepth(depthOf(TRACK_TILES, 3) + 5);

    const d = this.data_;
    this.rival = this.car(d.rival.sprite, d.rival.paint);
    this.you = this.car(d.player.sprite, d.player.paint);
    this.place(this.you, 0, LANE_PLAYER);
    this.place(this.rival, 0, LANE_RIVAL);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(1.4, Math.max(0.8, this.scale.width / 700)));
    cam.startFollow(this.you, true, 0.12, 0.12, 0, 60);
    this.following = this.you;
  }

  private car(sprite: string, paint: number) {
    const c = this.add.container(0, 0);
    for (const layer of ['shadow', 'body', 'details']) {
      const img = this.add.image(0, 0, `${sprite}_${layer}`).setOrigin(0.5, CAR_FOOT_Y).setScale(CAR_SCALE);
      if (layer === 'body') img.setTint(paint);
      c.add(img);
    }
    return c;
  }

  private place(car: Phaser.GameObjects.Container, meters: number, lane: number) {
    const x = Math.min(meters, RACE_LENGTH_M + 30) / M_PER_TILE;
    const p = isoToScreen(x, lane, ORIGIN);
    car.setPosition(p.x, p.y).setDepth(depthOf(x, lane));
  }

  update(_time: number, delta: number) {
    const d = this.data_;
    if (!d || this.ended) return;
    const s = d.run.frame(Math.min(delta, 50));
    this.place(this.you, s.view.meters, LANE_PLAYER);
    this.place(this.rival, s.rivalMeters, LANE_RIVAL);
    // the camera follows whoever is ahead
    const leader = s.rivalMeters > s.view.meters + 5 ? this.rival : this.you;
    if (this.following !== leader) {
      this.following = leader;
      this.cameras.main.startFollow(leader, true, 0.12, 0.12, 0, 60);
    }
    d.onFrame(s);
    if (s.view.phase === 'finished') {
      this.ended = true;
      d.onFinish();
    }
  }

  /** Jumps to the end state after an instant finish (tests and replays). */
  showEnd(s: RaceSnapshot) {
    this.place(this.you, s.view.meters, LANE_PLAYER);
    this.place(this.rival, s.rivalMeters, LANE_RIVAL);
    this.ended = true;
  }
}
