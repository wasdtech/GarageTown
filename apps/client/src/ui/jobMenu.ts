import type { BayType, Content, JobDef } from '@gt/shared';
import { type Bay, type Customer, jobProgress, levelForXp } from '@gt/sim';
import { fmt } from './format';
import { h } from './dom';
import { S } from './strings';

let current: HTMLElement | null = null;

export function closeSheet() {
  current?.remove();
  current = null;
}

function sheet(root: HTMLElement, title: string, ...body: Node[]) {
  closeSheet();
  const panel = h(
    'div',
    { class: 'gt-sheet', role: 'dialog', 'aria-label': title },
    h('h2', {}, title),
    ...body,
    h('button', { class: 'gt-btn gt-btn-ghost', onclick: closeSheet }, S.close),
  );
  const backdrop = h('div', { class: 'gt-backdrop' }, panel);
  backdrop.addEventListener('click', (e) => e.target === backdrop && closeSheet());
  root.append(backdrop);
  current = backdrop;
}

/** Lists the jobs for an empty bay; locked jobs are shown disabled. */
export function openJobMenu(
  root: HTMLElement,
  c: Content,
  xp: number,
  bay: Bay,
  customer: Customer,
  onPick: (job: JobDef) => void,
) {
  const level = levelForXp(c, xp);
  const items = c.jobs
    .filter((j) => j.bay === bay.type)
    .map((j) => {
      const locked = j.unlockLevel > level;
      const btn = h(
        'button',
        {
          class: `gt-job${j.key === customer.need ? ' gt-job-need' : ''}`,
          'data-job': j.key,
          ...(locked ? { disabled: '' } : {}),
        },
        h(
          'strong',
          {},
          h('img', { src: `icons/${j.icon}.png`, alt: '', class: 'gt-job-icon' }),
          `${j.key === customer.need ? '★ ' : ''}${j.name}`,
        ),
        h(
          'span',
          {},
          locked ? S.lockedAt(j.unlockLevel) : `${fmt(j.durationS)} · ${j.coins} 🪙 · ${j.xp} XP`,
        ),
      );
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('disabled')) return;
        btn.setAttribute('disabled', '');
        closeSheet();
        onPick(j);
      });
      return btn;
    });
  const need = c.jobs.find((j) => j.key === customer.need)?.name ?? customer.need;
  sheet(root, S.chooseService, h('p', { class: 'gt-muted' }, `${S.customerWants}: ★ ${need}`), ...items);
}

/** Shows a running job and keeps its countdown live; closes itself when the job finishes. */
export function openBayStatus(
  root: HTMLElement,
  c: Content,
  getBay: () => Bay | undefined,
  clock: () => number,
  extra: Node[] = [],
) {
  const bay = getBay();
  if (!bay?.job) return;
  const name = c.jobs.find((j) => j.key === bay.job!.jobKey)?.name ?? bay.job.jobKey;
  const remaining = h('p', { class: 'gt-muted', 'data-testid': 'remaining' });
  const update = () => {
    const job = getBay()?.job;
    if (!job || jobProgress(job, clock()).done) {
      clearInterval(timer);
      if (current?.contains(remaining)) closeSheet();
      return;
    }
    remaining.textContent = S.remaining(fmt(Math.ceil(jobProgress(job, clock()).remainingMs / 1000)));
  };
  const timer = setInterval(update, 500);
  sheet(root, name, remaining, ...extra);
  update();
}

/** Lets the player pick a bay type for an empty garage slot. */
export function openBuildMenu(
  root: HTMLElement,
  opts: { level: number; coins: number; slotLevel: number; cost: number; buildS: number },
  onPick: (type: BayType) => void,
) {
  const locked = opts.level < opts.slotLevel;
  const types: BayType[] = ['wash', 'mechanic', 'paint', 'performance'];
  const items = types.map((t) => {
    const disabled = locked || opts.coins < opts.cost;
    const btn = h(
      'button',
      { class: 'gt-job', 'data-bay-type': t, ...(disabled ? { disabled: '' } : {}) },
      h('strong', {}, S.bayTypes[t]),
      h('span', {}, locked ? S.lockedAt(opts.slotLevel) : S.buildInfo(opts.cost, fmt(opts.buildS))),
    );
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled')) return;
      closeSheet();
      onPick(t);
    });
    return btn;
  });
  sheet(root, S.buildTitle, h('p', { class: 'gt-muted' }, S.buildPick), ...items);
}
