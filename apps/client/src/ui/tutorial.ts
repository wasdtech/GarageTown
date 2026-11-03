import { jobProgress } from '@gt/sim';
import type { GarageScene } from '../scenes/GarageScene';
import type { Store } from '../state/store';
import { h } from './dom';
import { S } from './strings';
import {
  advanceTutorial,
  initialTutorialStep,
  TUTORIAL_DONE,
  TUTORIAL_STEPS,
  type TutorialEvent,
} from './tutorialSteps';

export const TUTORIAL_KEY = 'gt.tutorial';

function readStep(): number | null {
  try {
    const v = localStorage.getItem(TUTORIAL_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function writeStep(step: number) {
  try {
    localStorage.setItem(TUTORIAL_KEY, String(step));
  } catch {
    /* tutorial progress is a convenience only */
  }
}

/** Dona Cida's walkthrough for brand-new garages: a speech panel plus an arrow in the scene. */
export function createTutorial(root: HTMLElement, scene: GarageScene, store: Store, clock: () => number) {
  let step = initialTutorialStep(readStep(), store.state);
  const text = h('p', { class: 'gt-cida-text' });
  const skip = h('button', { class: 'gt-btn gt-btn-ghost gt-cida-skip' }, S.tutorialSkip);
  const panel = h(
    'div',
    { class: 'gt-cida', role: 'status', 'data-testid': 'tutorial' },
    h('span', { class: 'gt-cida-face', 'aria-hidden': 'true' }, '👵'),
    text,
    skip,
  );
  skip.addEventListener('click', () => emit('skip'));

  const target = (): string | null => {
    const s = store.state;
    const point = TUTORIAL_STEPS[step]?.point;
    if (point === 'customer') return s.queue[0]?.id ?? null;
    if (point === 'bay') return s.bays.find((b) => !b.job)?.id ?? null;
    if (point === 'collect') {
      const now = clock();
      return (
        (s.bays.find((b) => b.job && jobProgress(b.job, now).done) ?? s.bays.find((b) => b.job))?.id ?? null
      );
    }
    return point === 'showcase' ? 'showcase' : null;
  };

  function render() {
    if (step >= TUTORIAL_DONE) {
      panel.remove();
      scene.pointAt(null);
      return;
    }
    if (!panel.isConnected) root.append(panel);
    text.textContent = TUTORIAL_STEPS[step]!.text;
    scene.pointAt(target());
  }

  function emit(e: TutorialEvent) {
    const next = advanceTutorial(step, e);
    if (next === step) return;
    step = next;
    writeStep(step);
    render();
  }

  store.subscribe(() => step < TUTORIAL_DONE && scene.pointAt(target()));
  render();
  return { emit };
}
