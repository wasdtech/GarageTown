import type { Content } from '@gt/shared';
import { bayId, buildProgress, type GameState, jobProgress, TIMELY_WINDOW_MS } from '@gt/sim';
import Phaser from 'phaser';
import { depthOf, isoToScreen, type Point } from '../iso/iso';
import { collectLabel, fmt } from '../ui/format';
import { S } from '../ui/strings';
import { structureKey } from './structureKey';
import { diffTransitions, type Transition } from './transitions';
import { type Ambient, ambientFor, IMPATIENT_BELOW } from './ambient';
import { type Worker, type WorkerAction, workersFor } from './worker';

export const LOT_SIZE = 8;
export const STREET_ROW = 8;
const QUEUE_STEP = 2;
const QUEUE_START = -2;
// Car layers are AI-generated PNGs at 2x (see docs/art/style-guide.md); the footprint centre sits ~74% down.
const CAR_FOOT_Y = 0.74;
const CAR_TEXTURE_SCALE = 0.5;
// Phaser skips input on objects that won't render (alpha 0), so in-flight cars stay barely visible.
const IN_FLIGHT_ALPHA = 0.01;
const VIP_GOLD = 0xe9b949;
/** Mechanic animation strips (art/src/workers): frames per strip; each has a gray `_cloth` layer to tint. */
const WORKER_FRAMES: Record<WorkerAction, number> = { scrub: 3, wrench: 2, spray: 5 };
const WORKER_FPS = 8;
/** Where the mechanic stands, relative to the centre of the car's pad (on the car's left, facing it). */
const WORKER_OFFSET = { x: -52, y: 26 };
/** Showcase spot for the player's own car (back corner: clear of the queue and of every bay's tap area). */
const SHOWCASE = { x: 0, y: 0 };
const STICKER_GLYPH: Record<string, string> = { number: '7', bolt: '⚡', star: '★' };
const ORIGIN: Point = { x: 0, y: 0 };
const GRASS = '#86c96b';
const CROSS_STREET_COL = 9; // the side street along the lot's right edge
/** The performance pad reuses the mechanic pad with a tint until its own art is generated. */
const PAD_ART: Record<string, { key: string; tint?: number }> = {
  wash: { key: 'bay_wash' },
  mechanic: { key: 'bay_mechanic' },
  paint: { key: 'bay_paint' },
  performance: { key: 'bay_mechanic', tint: 0xff9aa8 },
};
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
  private prevState: GameState | null = null;
  /** Looping tweens owned by the current rebuild (stopped on the next one; trips keep running). */
  private dynamicTweens: Phaser.Tweens.Tween[] = [];
  /** Cars drawn by the last rebuild, by customer id. */
  private carSprites = new Map<string, Phaser.GameObjects.Container>();
  /** Customers shown as a travelling car; their resting sprite stays transparent (but tappable) until arrival. */
  private inFlight = new Set<string>();
  /** Bays whose job was already finished at the last rebuild (to celebrate newly finished ones once). */
  private doneBays = new Set<string>();
  /** Timers driving the ambient effects of the current rebuild. */
  private ambientTimers: Phaser.Time.TimerEvent[] = [];
  private particles = 0;
  /** Customers who already honked when they got impatient. */
  private honked = new Set<string>();
  /** Called once per customer when they get impatient (used for the horn). */
  onImpatient?: (customerId: string) => void;
  /** Clock of the latest render (rebuild or in-place update). */
  private lastNow = 0;
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
    for (const o of ['tree', 'shop', 'build_slot', 'bay_wash', 'bay_mechanic', 'bay_paint'])
      this.load.image(o, `objects/${o}.png`);
    for (const j of this.content.jobs) this.load.image(`icon_${j.icon}`, `icons/${j.icon}.png`);
    for (const car of this.content.cars) {
      for (const layer of ['shadow', 'body', 'details']) {
        this.load.image(`${car.sprite}_${layer}`, `cars/${car.sprite}/${layer}.png`);
      }
    }
    this.load.image('ui_coin', 'ui/coin.png');
    for (const a of Object.keys(WORKER_FRAMES)) {
      this.load.image(`worker_${a}`, `workers/${a}.png`);
      this.load.image(`worker_${a}_cloth`, `workers/${a}_cloth.png`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor(GRASS);
    this.makeWorkerAnims();
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
    // include the first queue spot (QUEUE_START) with a car-width margin
    const left = isoToScreen(QUEUE_START - 1.5, STREET_ROW + 1, ORIGIN).x - 32;
    const right = isoToScreen(LOT_SIZE, 0, ORIGIN).x + 32;
    const bottom = isoToScreen(LOT_SIZE, STREET_ROW + 1, ORIGIN).y;
    cam.centerOn((left + right) / 2, bottom / 2 + 10);
    const fit = Math.min(this.scale.width / (right - left), (this.scale.height - 120) / (bottom + 80));
    cam.setZoom(Phaser.Math.Clamp(fit, 0.45, 1.3));
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

  private pointer: Phaser.GameObjects.Text | null = null;
  private pointerTarget: string | null = null;

  /** Bouncing arrow over an anchor (tutorial); null hides it. Re-resolved on every render. */
  pointAt(anchorId: string | null) {
    this.pointerTarget = anchorId;
    this.placePointer();
  }

  private placePointer() {
    const a = this.pointerTarget ? this.anchors.get(this.pointerTarget) : undefined;
    if (!a) {
      this.pointer?.setVisible(false);
      return;
    }
    if (!this.pointer) {
      this.pointer = this.add
        .text(0, 0, '▼', { fontSize: '34px', color: '#ffd166', stroke: '#1d1d2b', strokeThickness: 6 })
        .setOrigin(0.5, 1)
        .setDepth(6000);
      this.tweens.add({ targets: this.pointer, scale: 1.2, yoyo: true, repeat: -1, duration: 420 });
    }
    this.pointer.setPosition(a.x, a.y - 58).setVisible(true);
  }

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

  private car(id: string, carKey: string, at: Point, scale: number, vip = false) {
    const def = this.content.cars.find((c) => c.key === carKey) ?? this.content.cars[0]!;
    const c = this.add.container(at.x, at.y);
    for (const layer of ['shadow', 'body', 'details']) {
      const img = this.add
        .image(0, 0, `${def.sprite}_${layer}`)
        .setOrigin(0.5, CAR_FOOT_Y)
        .setScale(scale * CAR_TEXTURE_SCALE);
      if (layer === 'body') img.setTint(vip ? VIP_GOLD : paintFor(id));
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
    this.lastNow = now;
    const key = structureKey(s, now, ui);
    if (key === this.lastKey) {
      for (const u of this.updaters) u(now);
      return;
    }
    this.lastKey = key;
    this.updaters = [];
    for (const t of this.dynamicTweens) t.remove();
    this.dynamicTweens = [];
    for (const t of this.ambientTimers) t.remove();
    this.ambientTimers = [];
    this.dynamic.removeAll(true);
    this.anchors.clear();
    this.carSprites.clear();
    const jobName = (k: string) => this.content.jobs.find((j) => j.key === k)?.name ?? k;
    const jobIcon = (k: string) => this.content.jobs.find((j) => j.key === k)?.icon ?? 'wash';

    // garage slots that have no bay yet: a hazard pad to build on, or a construction sign
    let firstFree = true;
    for (const def of this.content.garage.bays) {
      if (def.prebuilt || s.bays.some((b) => b.id === bayId(def.slot))) continue;
      const [tx, ty] = def.tile;
      const slotAt = isoToScreen(tx, ty, ORIGIN);
      const slot = this.add
        .image(slotAt.x, slotAt.y, 'build_slot')
        .setOrigin(0.5, 0)
        .setScale(0.5)
        .setDepth(-500);
      slot.setInteractive({ useHandCursor: true });
      slot.on('pointerup', () => !this.isDragging() && this.events.emit('slot:tap', def.slot));
      this.dynamic.add(slot);
      const centre = isoToScreen(tx + 1, ty + 1, ORIGIN);
      this.anchors.set(`slot-${def.slot}`, { x: centre.x, y: centre.y - 4 });
      if (firstFree) this.anchors.set('build-slot', { x: centre.x, y: centre.y - 4 });
      firstFree = false;
      const build = s.builds.find((b) => b.slot === def.slot);
      if (!build) continue;
      const g = this.add.graphics().setDepth(2000);
      const t = this.label(centre.x, centre.y - 22, '', '#ffd166').setDepth(2000);
      const update = (at: number) => {
        const p = buildProgress(build, at);
        g.clear();
        g.fillStyle(0x1d1d2b, 1).fillRoundedRect(centre.x - 42, centre.y - 16, 84, 12, 6);
        g.fillStyle(0xffb703, 1).fillRoundedRect(
          centre.x - 40,
          centre.y - 14,
          Math.max(1, 80 * p.fraction),
          8,
          4,
        );
        const text = `🚧 Obra · ${fmt(Math.ceil(p.remainingMs / 1000))}`;
        if (t.text !== text) t.setText(text);
      };
      update(now);
      this.updaters.push(update);
      this.dynamic.add([g, t]);
    }

    const nowDone = new Set<string>();
    const workers = workersFor(s, now);
    for (const bay of s.bays) {
      const pad = isoToScreen(bay.tile.x, bay.tile.y, ORIGIN);
      const padImg = this.add
        .image(pad.x, pad.y, PAD_ART[bay.type]!.key)
        .setOrigin(0.5, 0)
        .setScale(0.5)
        .setDepth(-500)
        .setInteractive({ useHandCursor: true });
      const tint = PAD_ART[bay.type]!.tint;
      if (tint) padImg.setTint(tint);
      padImg.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
      this.dynamic.add(padImg);
      const centre = isoToScreen(bay.tile.x + 1, bay.tile.y + 1, ORIGIN);
      this.anchors.set(bay.id, { x: centre.x, y: centre.y - 10 });
      const helper = s.helpers.find((h) => h.bayId === bay.id);
      const helperDef = helper && this.content.helpers.find((d) => d.key === helper.key);
      if (helperDef) {
        // name badge at the front corner of the pad: this bay works on its own
        const badge = this.label(
          centre.x + 22, // clear of the mechanic standing at the pad's left corner
          centre.y + 30,
          `${helperDef.face} ${helperDef.name.split(' ')[0]} · auto`,
          '#caffbf',
        );
        badge.setDepth(2100).setScale(0.85);
        this.dynamic.add(badge);
      }
      if (!bay.job) {
        if (ui.selectedCustomerId) this.dynamic.add(this.label(centre.x, centre.y - 6, 'Livre', '#caffbf'));
        continue;
      }
      const car = this.car(bay.job.customerId, bay.job.carKey, centre, 1, bay.job.vip);
      this.carSprites.set(bay.job.customerId, car);
      car.setDepth(depthOf(bay.tile.x + 1, bay.tile.y + 1));
      car.setSize(128, 80).setInteractive({ useHandCursor: true });
      car.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
      this.dynamic.add(car);
      const worker = workers.find((w) => w.bayId === bay.id);
      if (worker) this.drawWorker(worker, centre, car.depth);
      const prog = jobProgress(bay.job, now);
      const top = centre.y - 64;
      if (prog.done) {
        if (!this.doneBays.has(bay.id) && this.prevState) this.hop(car, centre);
        nowDone.add(bay.id);
        const doneAt = bay.job.startedAt + bay.job.durationS * 1000;
        const timely = now <= doneAt + TIMELY_WINDOW_MS;
        const coins = this.content.jobs.find((j) => j.key === bay.job!.jobKey)?.coins ?? 0;
        // the bonus coin is the drawn coin, not the emoji: room is left for it on the right of the label
        const text = collectLabel(coins, timely);
        const hasCoin = text.includes('🪙');
        const tag = this.label(centre.x, top, text.replace('🪙', '').trimEnd(), '#ffd166');
        if (hasCoin) tag.setPadding(7, 2, 28, 2);
        tag.setDepth(2000).setInteractive({ useHandCursor: true });
        tag.on('pointerup', () => !this.isDragging() && this.events.emit('bay:tap', bay.id));
        if (hasCoin) {
          const coin = this.add
            .image(tag.x + tag.width / 2 - 15, tag.y - tag.height / 2, 'ui_coin')
            .setDisplaySize(19, 19)
            .setDepth(2001);
          this.dynamic.add(coin);
        }
        this.dynamicTweens.push(
          this.tweens.add({ targets: tag, scale: 1.08, yoyo: true, repeat: -1, duration: 450 }),
        );
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
      const car = this.car(q.id, q.carKey, at, 0.75, q.vip);
      this.carSprites.set(q.id, car);
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
      bubble
        .fillStyle(selected ? 0xffd166 : q.vip ? 0xfff1c1 : 0xffffff, 1)
        .lineStyle(q.vip ? 3.5 : 2.5, 0x1d1d2b, 1);
      bubble.fillRoundedRect(bx - 22, by - 20, 44, 38, 12).strokeRoundedRect(bx - 22, by - 20, 44, 38, 12);
      bubble.fillTriangle(bx - 14, by + 16, bx - 4, by + 16, bx - 18, by + 26);
      bubble.lineBetween(bx - 14, by + 17, bx - 18, by + 26).lineBetween(bx - 18, by + 26, bx - 4, by + 17);
      const icon = this.add
        .image(bx, by - 1, `icon_${jobIcon(q.need)}`)
        .setScale(0.31)
        .setDepth(3001);
      icon.setName(jobName(q.need));
      const g = this.add.graphics().setDepth(3002);
      let angry = false;
      const update = (t: number) => {
        const patience = Math.max(0, Math.min(1, (q.patienceUntil - t) / (q.patienceUntil - q.arrivedAt)));
        // impatience runs on the real clock (this updater), not on scene timers, so it also works at low frame rates
        if (!angry && patience < IMPATIENT_BELOW) {
          angry = true;
          this.dynamic.add(
            this.add
              .text(bx + 30, by - 18, '💢', { fontSize: '20px' })
              .setOrigin(0.5)
              .setDepth(3100),
          );
          if (!this.honked.has(q.id)) {
            this.honked.add(q.id);
            this.onImpatient?.(q.id);
          }
          if (!this.reducedMotion()) {
            const x0 = car.x;
            this.dynamicTweens.push(
              this.tweens.add({
                targets: car,
                x: x0 + 2,
                yoyo: true,
                repeat: 3,
                duration: 45,
                repeatDelay: 0,
                loop: -1,
                loopDelay: 2000,
              }),
            );
          }
        }
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
      if (q.vip)
        this.dynamic.add(
          this.add
            .text(bx + 16, by - 28, '👑', { fontSize: '18px' })
            .setOrigin(0.5)
            .setDepth(3003),
        );
      if (selected)
        this.dynamicTweens.push(
          this.tweens.add({ targets: car, y: at.y - 6, yoyo: true, repeat: -1, duration: 300 }),
        );
    });
    this.doneBays = nowDone;
    this.drawShowcase(s);
    // children of a Container ignore depth unless sorted explicitly
    this.dynamic.sort('depth');
    for (const id of this.inFlight) this.carSprites.get(id)?.setAlpha(IN_FLIGHT_ALPHA);
    this.playTransitions(diffTransitions(this.prevState, s), s);
    this.prevState = s;
    this.startAmbient(s, now, ui);
    this.placePointer();
  }

  /** The player's own car on a spotlit pad, wearing its paint, finish, neon and sticker. */
  private drawShowcase(s: GameState) {
    const car = s.collection.cars.find((x) => x.id === s.collection.activeCarId);
    if (!car) return;
    const L = this.content.looks;
    const top = isoToScreen(SHOWCASE.x, SHOWCASE.y, ORIGIN);
    const centre = isoToScreen(SHOWCASE.x + 1, SHOWCASE.y + 1, ORIGIN);
    const pad = this.add.graphics().setDepth(-500);
    const diamond = [
      new Phaser.Math.Vector2(top.x, top.y + 4),
      new Phaser.Math.Vector2(top.x + 60, top.y + 34),
      new Phaser.Math.Vector2(top.x, top.y + 64),
      new Phaser.Math.Vector2(top.x - 60, top.y + 34),
    ];
    pad.fillStyle(0xfff3c4, 1).fillPoints(diamond, true);
    pad.lineStyle(4, 0xe9b949, 1).strokePoints(diamond, true);
    pad.setInteractive(new Phaser.Geom.Polygon(diamond), Phaser.Geom.Polygon.Contains);
    pad.on('pointerup', () => !this.isDragging() && this.events.emit('showcase:tap'));
    this.dynamic.add(pad);
    this.anchors.set('showcase', { x: centre.x, y: centre.y - 10 });
    // a sign so the player's own car never reads as a customer
    const sign = this.label(centre.x, centre.y - 58, S.showcaseSign, '#ffd166').setDepth(2500);
    this.dynamic.add(sign);
    if (car.look.neon) {
      const glow = this.add
        .ellipse(centre.x, centre.y + 2, 120, 52, 0x4cc9f0, 0.55)
        .setDepth(depthOf(SHOWCASE.x + 1, SHOWCASE.y + 1) - 0.5);
      this.dynamicTweens.push(
        this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 }),
      );
      this.dynamic.add(glow);
    }
    const hex = L.paints.find((p) => p.key === car.look.paint)?.hex ?? '#e63946';
    const sprite = this.car(car.id, car.model, centre, 1).setDepth(depthOf(SHOWCASE.x + 1, SHOWCASE.y + 1));
    const body = sprite.getAt(1) as Phaser.GameObjects.Image;
    body.setTint(Phaser.Display.Color.HexStringToColor(hex).color);
    if (car.look.finish !== 'matte') {
      const shine = this.add
        .image(0, 0, body.texture.key)
        .setOrigin(body.originX, body.originY)
        .setScale(body.scaleX)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      if (car.look.finish === 'pearl') shine.setTint(0xb8f2ff, 0xffc4f0, 0xffc4f0, 0xb8f2ff);
      sprite.addAt(shine, 2);
      this.dynamicTweens.push(
        this.tweens.add({ targets: shine, alpha: 0.35, yoyo: true, repeat: -1, duration: 1100 }),
      );
    }
    if (car.look.sticker) {
      const glyph = STICKER_GLYPH[car.look.sticker] ?? '★';
      const t = this.add
        .text(-14, -16, glyph, {
          fontFamily: '"Baloo 2", system-ui, sans-serif',
          fontSize: '18px',
          fontStyle: '800',
          color: '#ffffff',
          stroke: '#1d1d2b',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      sprite.add(t);
    }
    sprite.setSize(96, 56).setInteractive({ useHandCursor: true });
    sprite.on('pointerup', () => !this.isDragging() && this.events.emit('showcase:tap'));
    this.dynamic.add(sprite);
  }

  private queueSpot(slot: number): Point {
    return isoToScreen(QUEUE_START + slot * QUEUE_STEP + 0.5, STREET_ROW + 0.5, ORIGIN);
  }

  /** Animates each car journey with a temporary sprite; the resting sprite appears when it lands. */
  private playTransitions(list: Transition[], s: GameState) {
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced || list.length === 0) return;
    const street = (x: number) => isoToScreen(x, STREET_ROW + 0.5, ORIGIN);
    const bayCentre = (id: string) => {
      const b = s.bays.find((x) => x.id === id);
      return b ? { tile: b.tile, at: isoToScreen(b.tile.x + 1, b.tile.y + 1, ORIGIN) } : null;
    };
    for (const t of list) {
      if (t.kind === 'arrive') {
        const to = this.queueSpot(t.slot);
        this.trip(t.customerId, t.carKey, 0.75, street(-12), [{ to, mirror: false }], true, t.vip);
      } else if (t.kind === 'giveUp') {
        const from = this.queueSpot(t.slot);
        this.puff(from);
        this.trip(
          t.customerId,
          t.carKey,
          0.75,
          from,
          [{ to: street(LOT_SIZE + 14), mirror: false }],
          false,
          t.vip,
        );
      } else if (t.kind === 'toBay') {
        const bay = bayCentre(t.bayId);
        if (!bay) continue;
        const from = this.queueSpot(t.fromSlot);
        // drive along the street to the bay's column, then reverse up into the bay
        this.trip(
          t.customerId,
          t.carKey,
          1,
          from,
          [
            { to: street(bay.tile.x + 1), mirror: false },
            { to: bay.at, mirror: false },
          ],
          true,
          t.vip,
        );
      } else {
        const bay = bayCentre(t.bayId);
        if (!bay) continue;
        // pull forward out of the bay (facing south-west), then drive off along the street
        this.trip(
          t.customerId,
          t.carKey,
          1,
          bay.at,
          [
            { to: street(bay.tile.x + 1), mirror: true },
            { to: street(LOT_SIZE + 14), mirror: false },
          ],
          false,
          t.vip,
        );
      }
    }
  }

  private trip(
    id: string,
    carKey: string,
    scale: number,
    from: Point,
    legs: { to: Point; mirror: boolean }[],
    landsOnSprite = true,
    vip = false,
  ) {
    const car = this.car(id, carKey, from, scale, vip).setDepth(20);
    if (landsOnSprite) {
      this.inFlight.add(id);
      this.carSprites.get(id)?.setAlpha(IN_FLIGHT_ALPHA);
    }
    const finish = () => {
      car.destroy();
      if (!landsOnSprite) return;
      this.inFlight.delete(id);
      this.carSprites.get(id)?.setAlpha(1);
    };
    let at = from;
    const tweens = legs.map((leg) => {
      const dist = Phaser.Math.Distance.Between(at.x, at.y, leg.to.x, leg.to.y);
      at = leg.to;
      return {
        targets: car,
        x: leg.to.x,
        y: leg.to.y,
        duration: Phaser.Math.Clamp(dist * 2.2, 250, 1200),
        ease: 'Sine.easeInOut',
        onStart: () => car.iterate((img: Phaser.GameObjects.Image) => img.setFlipX(leg.mirror)),
      };
    });
    this.tweens.chain({ tweens, onComplete: finish });
  }

  private reducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Slices each loaded mechanic strip into frames and registers its looping animation. */
  private makeWorkerAnims() {
    for (const [action, n] of Object.entries(WORKER_FRAMES)) {
      for (const layer of ['', '_cloth']) {
        const key = `worker_${action}${layer}`;
        if (!this.textures.exists(key)) continue;
        const tex = this.textures.get(key);
        const src = tex.getSourceImage();
        const fw = Math.floor(src.width / n);
        for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, src.height);
        this.anims.create({
          key,
          frames: Array.from({ length: n }, (_, i) => ({ key, frame: i })),
          frameRate: WORKER_FPS,
          repeat: -1,
        });
      }
    }
  }

  /** The mechanic (or the bay's helper, in their overalls colour) working beside a car in service. */
  private drawWorker(w: Worker, centre: Point, carDepth: number) {
    const key = `worker_${w.action}`;
    if (!this.anims.exists(key) || !this.anims.exists(`${key}_cloth`)) return; // art failed to load
    const at = { x: centre.x + WORKER_OFFSET.x, y: centre.y + WORKER_OFFSET.y };
    const body = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1).setScale(0.5);
    const cloth = this.add.sprite(0, 0, `${key}_cloth`, 0).setOrigin(0.5, 1).setScale(0.5).setTint(w.tint);
    const shadow = this.add.ellipse(0, -2, 34, 10, 0x000000, 0.22);
    const c = this.add.container(at.x, at.y, [shadow, body, cloth]).setDepth(carDepth + 1);
    c.setName(`worker:${w.bayId}`);
    if (!this.reducedMotion()) {
      // a per-bay phase so neighbouring mechanics don't move in lockstep
      const delay = (w.bayId.length * 173) % 500;
      body.play({ key, delay });
      cloth.play({ key: `${key}_cloth`, delay });
    }
    this.dynamic!.add(c);
  }

  /** Short-lived particle with a global cap and an off-screen skip. */
  private particle(
    x: number,
    y: number,
    make: () => Phaser.GameObjects.GameObject & { setDepth(d: number): unknown },
    tween: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
  ) {
    if (this.particles >= 30 || !this.cameras.main.worldView.contains(x, y)) return;
    const obj = make();
    obj.setDepth(3500);
    this.particles++;
    this.tweens.add({
      ...tween,
      targets: obj,
      onComplete: () => {
        obj.destroy();
        this.particles--;
      },
    });
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const ev = this.time.addEvent({ delay: Phaser.Math.Between(minMs, maxMs), loop: true, callback: fn });
    this.ambientTimers.push(ev);
  }

  /** Life animations: idling and impatient cars in the queue, and an effect per bay type while in service. */
  private startAmbient(s: GameState, now: number, ui: SceneUi) {
    if (this.reducedMotion()) return;
    for (const a of ambientFor(s, now)) {
      const car = this.carSprites.get(a.id);
      if (!car) continue;
      if (a.kind === 'service') this.serviceEffect(car, a);
      else this.queueEffect(car, a.id, ui.selectedCustomerId === a.id);
    }
  }

  private queueEffect(car: Phaser.GameObjects.Container, id: string, selected: boolean) {
    const baseY = car.y;
    if (!selected) {
      // idle engine: a gentle bob with a per-car phase
      this.dynamicTweens.push(
        this.tweens.add({
          targets: car,
          y: baseY - 1.5,
          yoyo: true,
          repeat: -1,
          duration: 420,
          delay: (id.length * 137) % 400,
        }),
      );
    }
    this.every(3000, 6000, () => {
      this.particle(car.x - 30, car.y - 8, () => this.add.circle(car.x - 30, car.y - 8, 5, 0xc8c8c8, 0.8), {
        x: car.x - 48,
        y: car.y - 22,
        scale: 2,
        alpha: 0,
        duration: 900,
      });
    });
  }

  private serviceEffect(car: Phaser.GameObjects.Container, a: Extract<Ambient, { kind: 'service' }>) {
    const x = car.x;
    const y = car.y;
    if (a.bay === 'wash') {
      this.every(350, 550, () =>
        this.particle(
          x,
          y,
          () =>
            this.add
              .circle(x + Phaser.Math.Between(-36, 36), y - 30, Phaser.Math.Between(3, 6), 0xffffff, 0.9)
              .setStrokeStyle(1.5, 0x4cc9f0),
          {
            y: y - 70,
            alpha: 0,
            duration: 1000,
          },
        ),
      );
    } else if (a.bay === 'mechanic') {
      this.dynamicTweens.push(
        this.tweens.add({ targets: car, y: y - 6, duration: 400, ease: 'Quad.easeOut' }),
      );
      this.every(800, 1200, () => {
        for (let i = 0; i < 4; i++) {
          const ang = Phaser.Math.FloatBetween(-2.6, -0.5);
          this.particle(x + 20, y - 16, () => this.add.rectangle(x + 20, y - 16, 4, 2, 0xffd166), {
            x: x + 20 + Math.cos(ang) * 30,
            y: y - 16 + Math.sin(ang) * 30,
            alpha: 0,
            duration: 380,
          });
        }
      });
    } else if (a.bay === 'paint') {
      const colours = [0xff5ca8, 0x3a86ff, 0xffd166, 0x06d6a0, 0x8338ec];
      this.every(250, 400, () =>
        this.particle(
          x,
          y,
          () =>
            this.add.circle(
              x + Phaser.Math.Between(-40, 40),
              y - Phaser.Math.Between(10, 40),
              9,
              Phaser.Utils.Array.GetRandom(colours),
              0.35,
            ),
          {
            scale: 2.2,
            alpha: 0,
            duration: 900,
          },
        ),
      );
    } else {
      this.dynamicTweens.push(
        this.tweens.add({ targets: car, x: x + 1.5, yoyo: true, repeat: -1, duration: 60 }),
      );
      this.every(600, 900, () =>
        this.particle(x - 40, y - 4, () => this.add.triangle(x - 40, y - 4, 0, 6, 14, 0, 14, 12, 0xff7b00), {
          x: x - 58,
          scaleX: 1.6,
          alpha: 0,
          duration: 300,
        }),
      );
    }
  }

  /** A little bounce and sparkles when a car's job finishes. */
  private hop(car: Phaser.GameObjects.Container, at: Point) {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.tweens.add({
      targets: car,
      y: car.y - 14,
      yoyo: true,
      repeat: 1,
      duration: 140,
      ease: 'Quad.easeOut',
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const star = this.add.text(at.x, at.y - 30, '✦', {
        fontSize: '16px',
        color: '#ffd166',
        stroke: '#1d1d2b',
        strokeThickness: 3,
      });
      star.setOrigin(0.5).setDepth(3000);
      this.tweens.add({
        targets: star,
        x: at.x + Math.cos(a) * 46,
        y: at.y - 30 + Math.sin(a) * 26,
        alpha: 0,
        scale: 1.4,
        duration: 600,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  private puff(at: Point) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.circle(at.x - 30 + i * 6, at.y - 6, 7 + i * 2, 0xdedede, 0.85).setDepth(21);
      this.tweens.add({
        targets: p,
        x: p.x - 18 - i * 6,
        y: p.y - 14 - i * 4,
        scale: 1.8,
        alpha: 0,
        duration: 700 + i * 80,
        onComplete: () => p.destroy(),
      });
    }
  }
}
