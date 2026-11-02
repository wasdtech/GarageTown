import { describe, expect, it } from 'vitest';
import { tick } from '../src/customers';
import { collectJob, jobProgress, startJob } from '../src/jobs';
import { content as c, T0, withCustomer } from './helpers';

const start = (need: string, jobKey: string, bayId: string, extra = {}) =>
  startJob(c, withCustomer(need, c, extra), { customerId: 'cx', bayId, jobKey }, T0);

function started(need: string, jobKey: string, bayId: string, extra = {}) {
  const r = start(need, jobKey, bayId, extra);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('startJob', () => {
  it('moves the customer from the queue into the bay', () => {
    const s = started('wash', 'wash', 'bay1');
    expect(s.queue).toHaveLength(0);
    expect(s.bays[0]!.job).toMatchObject({ jobKey: 'wash', need: 'wash', carKey: 'pitoco', startedAt: T0 });
  });

  it('rejects a job in the wrong bay type', () => {
    expect(start('oil', 'oil', 'bay1')).toEqual({ ok: false, error: 'wrong_bay_type' });
  });

  it('rejects a locked job', () => {
    expect(start('tires', 'tires', 'bay2')).toEqual({ ok: false, error: 'job_locked' });
  });

  it('rejects a second job on a busy bay', () => {
    const s = started('wash', 'wash', 'bay1');
    const s2 = { ...s, queue: [{ ...withCustomer('wash').queue[0]!, id: 'cy' }] };
    expect(startJob(c, s2, { customerId: 'cy', bayId: 'bay1', jobKey: 'wash' }, T0)).toEqual({
      ok: false,
      error: 'bay_busy',
    });
  });

  it('rejects unknown customer, bay and job', () => {
    const s = withCustomer('wash');
    expect(startJob(c, s, { customerId: 'nope', bayId: 'bay1', jobKey: 'wash' }, T0)).toEqual({
      ok: false,
      error: 'no_customer',
    });
    expect(startJob(c, s, { customerId: 'cx', bayId: 'bayX', jobKey: 'wash' }, T0)).toEqual({
      ok: false,
      error: 'unknown_bay',
    });
    expect(startJob(c, s, { customerId: 'cx', bayId: 'bay1', jobKey: 'warp' }, T0)).toEqual({
      ok: false,
      error: 'unknown_job',
    });
  });
});

describe('jobProgress', () => {
  it('reports halfway progress', () => {
    const job = started('wash', 'wash', 'bay1').bays[0]!.job!;
    expect(jobProgress(job, T0 + 15_000)).toEqual({ done: false, remainingMs: 15_000, fraction: 0.5 });
  });

  it('never goes negative when the clock moves backwards', () => {
    const job = started('wash', 'wash', 'bay1').bays[0]!.job!;
    expect(jobProgress(job, T0 - 5_000)).toMatchObject({ done: false, fraction: 0 });
  });
});

describe('collectJob', () => {
  it('refuses before the job is done', () => {
    expect(collectJob(c, started('wash', 'wash', 'bay1'), 'bay1', T0 + 29_999)).toEqual({
      ok: false,
      error: 'not_done',
    });
  });

  it('pays coins, tip, xp and reputation when the need is met', () => {
    const r = collectJob(c, started('wash', 'wash', 'bay1'), 'bay1', T0 + 31_000);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.reward).toMatchObject({ coins: 6, tip: 1, timelyBonus: 0, xp: 3, reputation: 1 });
    expect(r.value.state.coins).toBe(6);
    expect(r.value.state.reputation).toBe(1);
    expect(r.value.state.bays[0]!.job).toBeNull();
  });

  it('adds the timely bonus up to exactly 5 minutes after done', () => {
    const s = started('oil', 'oil', 'bay2');
    const end = T0 + 120_000;
    const on = collectJob(c, s, 'bay2', end + 300_000);
    const late = collectJob(c, s, 'bay2', end + 300_001);
    expect(on.ok && on.value.reward.coins).toBe(19);
    expect(late.ok && late.value.reward.coins).toBe(18);
  });

  it('pays no tip when the job does not match the need', () => {
    const r = collectJob(c, started('wash', 'oil', 'bay2'), 'bay2', T0 + 120_000);
    expect(r.ok && r.value.reward).toMatchObject({ tip: 0, reputation: 0, coins: 16 });
  });

  it('pays only once on a double collect', () => {
    const r1 = collectJob(c, started('wash', 'wash', 'bay1'), 'bay1', T0 + 31_000);
    if (!r1.ok) throw new Error(r1.error);
    expect(collectJob(c, r1.value.state, 'bay1', T0 + 31_001)).toEqual({ ok: false, error: 'empty_bay' });
    expect(r1.value.state.coins).toBe(6);
  });

  it('reports a multi-level jump in one reward', () => {
    const big = { ...c, jobs: [...c.jobs, { ...c.jobs[0]!, key: 'mega', xp: 300 }] };
    const s = startJob(
      big,
      withCustomer('mega', big),
      { customerId: 'cx', bayId: 'bay1', jobKey: 'mega' },
      T0,
    );
    if (!s.ok) throw new Error(s.error);
    const r = collectJob(big, s.value, 'bay1', T0 + 30_000);
    expect(r.ok && r.value.reward).toMatchObject({ levelBefore: 1, levelAfter: 5 });
  });
});

describe('clock moving backwards', () => {
  it('keeps a finished job finished and collectable', () => {
    const s = started('wash', 'wash', 'bay1');
    const later = tick(c, s, T0 + 200_000);
    const r = collectJob(c, later, 'bay1', T0 + 200_000 - 3_600_000);
    expect(r.ok).toBe(true);
  });
});
