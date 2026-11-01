import type { Content, JobDef } from '@gt/shared';
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
        h('strong', {}, `${j.key === customer.need ? '★ ' : ''}${j.name}`),
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

/** Shows a running job; `extra` lets callers add actions (e.g. the minigame). */
export function openBayStatus(root: HTMLElement, c: Content, bay: Bay, now: number, extra: Node[] = []) {
  if (!bay.job) return;
  const name = c.jobs.find((j) => j.key === bay.job!.jobKey)?.name ?? bay.job.jobKey;
  const p = jobProgress(bay.job, now);
  sheet(
    root,
    name,
    h('p', { class: 'gt-muted' }, S.remaining(fmt(Math.ceil(p.remainingMs / 1000)))),
    ...extra,
  );
}
