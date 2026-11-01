import type { Content } from '@gt/shared';
import { type GameState, jobProgress, TIMELY_WINDOW_MS } from '@gt/sim';
import Phaser from 'phaser';
import { depthOf, isoToScreen, type Point } from '../iso/iso';
import { collectLabel, fmt } from '../ui/format';
import { structureKey } from './structureKey';

export const LOT_SIZE = 8;
export const STREET_ROW = 8;
const QUEUE_STEP = 2;
const QUEUE_START = -2;
// Car layers are AI-generated PNGs at 2x (see docs/art/style-guide.md); the footprint centre sits ~74% down.
const CAR_FOOT_Y = 0.74;
const CAR_TEXTURE_SCALE = 0.5;
const ORIGIN: Point = { x: 0, y: 0 };
const GRASS = '#86c96b';
const CROSS_STREET_COL = 9; // the side street along the lot's right edge
const BUILD_SLOT = { x: 2, y: 0 }; // where the next bay will go (M1)
const WALL_H = 22;
const TREES: [number, number][] = [
  [-3, 11],
  [-1, 12],
  [12, -2],
  [-6, 4],
  [14, 11],
  [6, 11],
  [-3, -3],
];

/** Deterministic scatter for grass tufts so the background never shimmers between renders. */
function tuftSpots(): [number, number][] {
  const out: [number, number][] = [];
  let h = 7;
  for (let i = 0; i < 40; i++) {
    h = (h * 16807) % 2147483647;
    const x = (h % 30) - 10;
    h = (h * 16807) % 2147483647;
    const y = (h % 28) - 10;
    const inLot = x >= -1 && x <= LOT_SIZE && y >= -1 && y <= LOT_SIZE + 1;
    const onStreet = y === STREET_ROW || x === CROSS_STREET_COL;
    if (!inLot && !onStreet) out.push([x, y]);
  }
  return out;
}

export interface SceneUi {
  selectedCustomerId: string | null;
}

/** Stable pseudo-random paint colour per id. */
export function paintFor(id: string): number {
  const palette = [0xe63946, 0x2a9d8f, 0xffb703, 0x3a86ff, 0x8338ec, 0xfb5607, 0x06d6a0, 0xf1faee];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length]!;
}

export class GarageScene extends Phaser.Scene {
  private dynamic!: Phaser.GameObjects.Container;
  private lastKey = '';
  private updaters: ((now: number) => void)[] = [];
  onReady?: () => void;
  /** World positions of tappable things from the last render (bay ids and customer ids). */
  readonly anchors = new Map<string, Point>();
  private content!: Content;

  constructor() {
    super('garage');
  }

  init(data: { content: Content }) {
    this.content = data.content;
  }

  preload() {
    for (const t of ['floor', 'street', 'sidewalk', 'grass']) this.load.svg(t, `tiles/${t}.svg`);
    this.load.svg('billboard', 'objects/billboard.svg');
    // AI-generated art ships as 2x PNGs (drawn at scale 0.5); see art/spritecook-assets.json
    for (const o of ['tree', 'shop', 'build_slot', 'bay_wash', 'bay_mechanic'])
      this.load.image(o, `objects/${o}.png`);
    for (const j of this.content.jobs) this.load.image(`icon_${j.icon}`, `icons/${j.icon}.png`);
    for (const car of this.content.cars) {
      for (const layer of ['shadow', 'body', 'details']) {
        this.load.image(`${car.sprite}_${layer}`, `cars/${car.sprite}/${layer}.png`);
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor(GRASS);
    this.buildWorld();
    this.dynamic = this.add.container(0, 0).setDepth(10);
    this.setupCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.onReady?.();
  }

  private tile(key: string, x: number, y: number, flip = false) {
    const p = isoToScreen(x, y, ORIGIN);
    return this.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(-1000).setFlipX(flip);
  }

  /** Static neighbourhood: grass, streets, sidewalks, walled lot, a neighbour shop, trees and a billboard. */
  private buildWorld() {
    for (const [x, y] of tuftSpots()) this.tile('grass', x, y);
    for (let y = 0; y < LOT_SIZE; y++) for (let x = 0; x < LOT_SIZE; x++) this.tile('floor', x, y);
    for (let x = -10; x < LOT_SIZE + 12; x++) if (x !== CROSS_STREET_COL) this.tile('street', x, STREET_ROW);
    for (let y = -10; y <= STREET_ROW; y++) this.tile('street', CROSS_STREET_COL, y, true);
    for (let x = -10; x < LOT_SIZE + 12; x++)
      if (x !== CROSS_STREET_COL) this.tile('sidewalk', x, STREET_ROW + 1);
    for (let y = -10; y < STREET_ROW; y++) this.tile('sidewalk', LOT_SIZE, y);
    for (let y = -10; y < STREET_ROW; y++) this.tile('sidewalk', CROSS_STREET_COL + 1, y);
    this.drawWalls();
    // the shop's front-bottom corner sits on its footprint's front corner (tiles x 11..14, y 2..4)
    const shopAt = isoToScreen(CROSS_STREET_COL + 5, 4, ORIGIN);
    this.add.image(shopAt.x, shopAt.y, 'shop').setOrigin(0.656, 0.99).setScale(0.5).setDepth(-100);
    for (const [x, y] of TREES) {
      const p = isoToScreen(x + 0.5, y + 0.5, ORIGIN);
      this.add
        .image(p.x, p.y, 'tree')
        .setOrigin(0.5, 0.94)
        .setScale(0.5)
        .setDepth(x + y > 12 ? 100 : -100);
    }
    const b = isoToScreen(-4, 1.5, ORIGIN);
    this.add
      .image(b.x, b.y, 'billboard')
      .setOrigin(0.5, 108 / 110)
      .setDepth(-100);
    this.add
      .text(b.x, b.y - 70, this.content.brand.name, {
        fontFamily: '"Baloo 2", system-ui, sans-serif',
        fontSize: '19px',
        fontStyle: '800',
        color: '#ffffff',
        stroke: '#1d1d2b',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setRotation(0.108)
      .setDepth(-99);
  }

  /** Low walls along the lot's two back edges. */
  private drawWalls() {
    const g = this.add.graphics().setDepth(-900);
    const P = (x: number, y: number, z = 0) => {
      const p = isoToScreen(x, y, ORIGIN);
      return new Phaser.Math.Vector2(p.x, p.y - z);
    };
    const face = (pts: Phaser.Math.Vector2[], fill: number) => {
      g.fillStyle(fill, 1).fillPoints(pts, true);
      g.lineStyle(2.5, 0x1d1d2b, 1).strokePoints(pts, true);
    };
    face([P(0, 0), P(LOT_SIZE, 0), P(LOT_SIZE, 0, WALL_H), P(0, 0, WALL_H)], 0xe6e9ee);
    face([P(0, 0), P(0, LOT_SIZE), P(0, LOT_SIZE, WALL_H), P(0, 0, WALL_H)], 0xffffff);
  }

  /** Fits the lot plus the street queue (tiles x -2..8, y 0..9) to the screen. */
  fitCamera() {
    const cam = this.cameras.main;
    const left = isoToScreen(-2, STREET_ROW + 1, ORIGIN).x - 32;
    const right = isoToScreen(LOT_SIZE, 0, ORIGIN).x + 32;
    const bottom = isoToScreen(LOT_SIZE, STREET_ROW + 1, ORIGIN).y;
    cam.centerOn((left + right) / 2, bottom / 2 + 10);
    const fit = Math.min(this.scale.width / (right - left), (this.scale.height - 120) / (bottom + 80));
    cam.setZoom(Phaser.Math.Clamp(fit, 0.5, 1.3));
  }

  zoomBy(factor: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, 0.5, 1.6));
  }

  private setupCamera() {
    const cam = this.cameras.main;
    this.fitCamera();
    this.input.addPointer(1);
    let dragging = false;
    let pinchDist = 0;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const [a, b] = [this.input.pointer1, this.input.pointer2];
      if (a.isDown && b.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (pinchDist > 0) cam.setZoom(Phaser.Math.Clamp(cam.zoom * (d / pinchDist), 0.5, 1.6));
        pinchDist = d;
        dragging = true;
        return;
      }
      pinchDist = 0;
      if (!p.isDown) return;
      if (!dragging && Phaser.Math.Distance.Between(p.downX, p.downY, p.x, p.y) < 8) return;
      dragging = true;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('pointerup', () => {
      // let tap handlers see `dragging` before resetting
      this.time.delayedCall(0, () => (dragging = false));
      pinchDist = 0;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.zoomBy(dy > 0 ? 0.9 : 1.1),
    );
    this.isDragging = () => dragging;
  }

  isDragging: () => boolean = () => false;

  /** Page coordinates of an anchor (used by end-to-end tests). */
  screenOf(id: string): Point | null {
    const a = this.anchors.get(id);
    if (!a) return null;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = (a.x - cam.worldView.x) * cam.zoom + cam.x;
    const sy = (a.y - cam.worldView.y) * cam.zoom + cam.y;
    return {
      x: rect.left + (sx * rect.width) / this.scale.width,
      y: rect.top + (sy * rect.height) / this.scale.height,
    };
  }

  private car(id: string, carKey: string, at: Point, scale: number) {
    const def = this.content.cars.find((c) => c.key === carKey) ?? this.content.cars[0]!;
    const c = this.add.container(at.x, at.y);
    for (const layer of ['shadow', 'body', 'details']) {
      const img = this.add
        .image(0, 0, `${def.sprite}_${layer}`)
        .setOrigin(0.5, CAR_FOOT_Y)
        .setScale(scale * CAR_TEXTURE_SCALE);
      if (layer === 'body') img.setTint(paintFor(id));
      c.add(img);
    }
    return c;
  }

  private label(x: number, y: number, text: string, bg: string) {
    return this.add
      .text(x, y, text, {
        fontFamily: '"Baloo 2", system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: '#1d1d2b',
        backgroundColor: bg,
        padding: { x: 7, y: 2 },
      })
      .setOrigin(0.5, 1);
  }

  renderState(s: GameState, now: number, ui: SceneUi) {
    if (!this.dynamic) return;
    const key = structureKey(s, now, ui);
    if (key === this.lastKey) {
      for (const u of this.updaters) u(now);
      return;
    }
    this.lastKey = key;
    this.updaters = [];
    this.tweens.killAll();
    this.dynamic.removeAll(true);
    this.anchors.clear();
    const jobName = (k: string) => this.content.jobs.find((j) => j.key === k)?.name ?? k;
    const jobIcon = (k: string) => this.content.jobs.find((j) => j.key === k)?.icon ?? 'wash';

    const slotAt = isoToScreen(BUILD_SLOT.x, BUILD_SLOT.y, ORIGIN);
    const slot = this.add
      .image(slotAt.x, slotAt.y, 'build_slot')
      .setOrigin(0.5, 0)
      .setScale(0.5)
      .setDepth(-500);
    slot.setInteractive({ useHandCursor: true });
    slot.on('pointerup', () => !this.isDragging() && this.events.emit('slot:tap'));
    this.dynamic.add(slot);
    const slotCentre = isoToScreen(BUILD_SLOT.x + 1, BUILD_SLOT.y + 1, ORIGIN);
    this.anchors.set('build-slot', { x: slotCentre.x, y: slotCentre.y - 4 });

    for (const bay of s.bays) {
      const pad = isoToScreen(bay.tile.x, bay.tile.y, ORIGIN);
      const padImg = this.add
        .image(pad.x, pad.y, `bay_${bay.type}`)
        .setOrigin(0.5, 0)
        .setScale(0.5)
        .setDepth(-500)
        .setInteractive({ useHandCursor: true });
      padImg.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
      this.dynamic.add(padImg);
      const centre = isoToScreen(bay.tile.x + 1, bay.tile.y + 1, ORIGIN);
      this.anchors.set(bay.id, { x: centre.x, y: centre.y - 10 });
      if (!bay.job) {
        if (ui.selectedCustomerId) this.dynamic.add(this.label(centre.x, centre.y - 6, 'Livre', '#caffbf'));
        continue;
      }
      const car = this.car(bay.job.customerId, bay.job.carKey, centre, 1);
      car.setDepth(depthOf(bay.tile.x + 1, bay.tile.y + 1));
      car.setSize(128, 80).setInteractive({ useHandCursor: true });
      car.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
      this.dynamic.add(car);
      const prog = jobProgress(bay.job, now);
      const top = centre.y - 64;
      if (prog.done) {
        const doneAt = bay.job.startedAt + bay.job.durationS * 1000;
        const timely = now <= doneAt + TIMELY_WINDOW_MS;
        const coins = this.content.jobs.find((j) => j.key === bay.job!.jobKey)?.coins ?? 0;
        const tag = this.label(centre.x, top, collectLabel(coins, timely), '#ffd166');
        tag.setDepth(2000).setInteractive({ useHandCursor: true });
        tag.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
        this.tweens.add({ targets: tag, scale: 1.08, yoyo: true, repeat: -1, duration: 450 });
        this.dynamic.add(tag);
      } else {
        const job = bay.job;
        const g = this.add.graphics().setDepth(2000);
        const t = this.label(centre.x, top - 14, '', '#ffffffdd').setDepth(2000);
        const update = (at: number) => {
          const p = jobProgress(job, at);
          g.clear();
          g.fillStyle(0x1d1d2b, 1).fillRoundedRect(centre.x - 42, top - 12, 84, 12, 6);
          g.fillStyle(0x06d6a0, 1).fillRoundedRect(
            centre.x - 40,
            top - 10,
            Math.max(1, 80 * p.fraction),
            8,
            4,
          );
          const text = `${jobName(job.jobKey)} · ${fmt(Math.ceil(p.remainingMs / 1000))}`;
          if (t.text !== text) t.setText(text);
        };
        update(now);
        this.updaters.push(update);
        this.dynamic.add([g, t]);
      }
    }

    s.queue.forEach((q, i) => {
      const at = isoToScreen(QUEUE_START + i * QUEUE_STEP + 0.5, STREET_ROW + 0.5, ORIGIN);
      const car = this.car(q.id, q.carKey, at, 0.75);
      this.anchors.set(q.id, { x: at.x, y: at.y - 12 });
      car.setDepth(depthOf(QUEUE_START + i * QUEUE_STEP, STREET_ROW) + 100);
      car.setSize(100, 64).setInteractive({ useHandCursor: true });
      car.on('pointerup', () => !this.isDragging() && this.events.emit('customer:tap', q.id));
      this.dynamic.add(car);
      const selected = ui.selectedCustomerId === q.id;
      // speech bubble with the job icon (readable at any zoom, unlike text)
      const bx = at.x + 18;
      const by = at.y - 62;
      const bubble = this.add.graphics().setDepth(3000);
      bubble.fillStyle(selected ? 0xffd166 : 0xffffff, 1).lineStyle(2.5, 0x1d1d2b, 1);
      bubble.fillRoundedRect(bx - 22, by - 20, 44, 38, 12).strokeRoundedRect(bx - 22, by - 20, 44, 38, 12);
      bubble.fillTriangle(bx - 14, by + 16, bx - 4, by + 16, bx - 18, by + 26);
      bubble.lineBetween(bx - 14, by + 17, bx - 18, by + 26).lineBetween(bx - 18, by + 26, bx - 4, by + 17);
      const icon = this.add
        .image(bx, by - 1, `icon_${jobIcon(q.need)}`)
        .setScale(0.31)
        .setDepth(3001);
      icon.setName(jobName(q.need));
      const g = this.add.graphics().setDepth(3002);
      const update = (t: number) => {
        const patience = Math.max(0, Math.min(1, (q.patienceUntil - t) / (q.patienceUntil - q.arrivedAt)));
        g.clear();
        g.fillStyle(0x1d1d2b, 1).fillRoundedRect(bx - 20, by + 22, 40, 7, 3);
        g.fillStyle(patience > 0.3 ? 0x06d6a0 : 0xe63946, 1).fillRoundedRect(
          bx - 19,
          by + 23,
          38 * patience,
          5,
          2,
        );
      };
      update(now);
      this.updaters.push(update);
      this.dynamic.add([bubble, icon, g]);
      if (selected) this.tweens.add({ targets: car, y: at.y - 6, yoyo: true, repeat: -1, duration: 300 });
    });
    // children of a Container ignore depth unless sorted explicitly
    this.dynamic.sort('depth');
  }
}
