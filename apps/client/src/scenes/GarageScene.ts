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
const CAR_FOOT_Y = 54 / 80; // footprint centre in the 128x80 car canvas
const ORIGIN: Point = { x: 0, y: 0 };

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
    this.load.svg('floor', 'tiles/floor.svg');
    this.load.svg('street', 'tiles/street.svg');
    this.load.svg('bay_wash', 'objects/bay_wash.svg');
    this.load.svg('bay_mechanic', 'objects/bay_mechanic.svg');
    for (const car of this.content.cars) {
      for (const layer of ['shadow', 'body', 'details']) {
        this.load.svg(`${car.sprite}_${layer}`, `cars/${car.sprite}/${layer}.svg`);
      }
    }
  }

  create() {
    for (let y = 0; y < LOT_SIZE; y++) for (let x = 0; x < LOT_SIZE; x++) this.tile('floor', x, y);
    for (let x = -4; x < LOT_SIZE + 6; x++) this.tile('street', x, STREET_ROW);
    this.dynamic = this.add.container(0, 0);
    this.setupCamera();
    this.onReady?.();
  }

  private tile(key: string, x: number, y: number) {
    const p = isoToScreen(x, y, ORIGIN);
    this.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(-1000);
  }

  private setupCamera() {
    const cam = this.cameras.main;
    // Fit the lot plus the street queue (tiles x -2..8, y 0..9).
    const left = isoToScreen(-2, STREET_ROW + 1, ORIGIN).x - 32;
    const right = isoToScreen(LOT_SIZE, 0, ORIGIN).x + 32;
    const bottom = isoToScreen(LOT_SIZE, STREET_ROW + 1, ORIGIN).y;
    cam.centerOn((left + right) / 2, bottom / 2 + 10);
    const fit = Math.min(this.scale.width / (right - left), (this.scale.height - 120) / (bottom + 80));
    cam.setZoom(Phaser.Math.Clamp(fit, 0.5, 1.3));
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
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 1.6));
    });
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
      const img = this.add.image(0, 0, `${def.sprite}_${layer}`).setOrigin(0.5, CAR_FOOT_Y).setScale(scale);
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

    for (const bay of s.bays) {
      const pad = isoToScreen(bay.tile.x, bay.tile.y, ORIGIN);
      const padImg = this.add
        .image(pad.x, pad.y, `bay_${bay.type}`)
        .setOrigin(0.5, 0)
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
        tag.on('pointerup', () => this.events.emit('bay:tap', bay.id));
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
      const bubble = this.label(at.x, at.y - 44, jobName(q.need), selected ? '#ffd166' : '#ffffffee');
      bubble.setDepth(3000);
      const g = this.add.graphics().setDepth(3000);
      const update = (t: number) => {
        const patience = Math.max(0, Math.min(1, (q.patienceUntil - t) / (q.patienceUntil - q.arrivedAt)));
        g.clear();
        g.fillStyle(0x1d1d2b, 1).fillRect(at.x - 24, at.y - 44, 48, 6);
        g.fillStyle(patience > 0.3 ? 0x06d6a0 : 0xe63946, 1).fillRect(at.x - 23, at.y - 43, 46 * patience, 4);
      };
      update(now);
      this.updaters.push(update);
      this.dynamic.add([bubble, g]);
      if (selected) this.tweens.add({ targets: car, y: at.y - 6, yoyo: true, repeat: -1, duration: 300 });
    });
  }
}
