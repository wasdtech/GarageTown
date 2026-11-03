import { expect, test } from '@playwright/test';
import { advance, open, seedSave } from './helpers';

type Shown = { name: string; tint: number; playing: boolean }[];

/** The mechanics currently drawn: their bay, the overalls tint and whether they are animating. */
const shown = () => {
  const dyn = (window.__gt.scene as unknown as { dynamic: { list: unknown[] } }).dynamic;
  return dyn.list
    .filter((o): o is { name: string; list: { tintTopLeft: number; anims?: { isPlaying: boolean } }[] } =>
      String((o as { name?: string }).name).startsWith('worker:'),
    )
    .map((c) => ({ name: c.name, tint: c.list[2]!.tintTopLeft, playing: !!c.list[1]!.anims?.isPlaying }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

test('a mechanic works beside every car in service, in the helper colours, and leaves when it is done', async ({
  page,
}) => {
  const now = Date.now();
  const job = (jobKey: string, id: string, durationS: number) => ({
    jobKey,
    customerId: id,
    carKey: 'pitoco',
    need: jobKey,
    startedAt: now,
    durationS,
  });
  await seedSave(page, {
    xp: 2500,
    bays: [
      { id: 'bay1', type: 'wash', tile: { x: 2, y: 3 }, job: job('wash', 'w', 60) },
      { id: 'bay2', type: 'mechanic', tile: { x: 5, y: 3 }, job: job('engine', 'm', 3600) },
    ],
    version: 4,
    helpers: [{ key: 'bia', level: 1, bayId: 'bay2' }],
    clockTier: 0,
    lastActiveAt: now,
    idleReport: { jobs: 0, coins: 0, xp: 0 },
    queue: [],
    nextCustomerAt: now + 6_000_000,
  });
  const errors = await open(page);
  await expect
    .poll(() => page.evaluate(shown) as Promise<Shown>)
    .toEqual([
      { name: 'worker:bay1', tint: 0x3a86ff, playing: true },
      { name: 'worker:bay2', tint: 0xff5ca8, playing: true },
    ]);
  // the wash finishes: its mechanic is gone, the helper keeps working
  await advance(page, 61_000);
  await expect.poll(() => page.evaluate(shown).then((w) => w.map((x) => x.name))).toEqual(['worker:bay2']);
  expect(errors).toEqual([]);
});
