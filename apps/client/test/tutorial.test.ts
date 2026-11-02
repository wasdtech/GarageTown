import { describe, expect, it } from 'vitest';
import { advanceTutorial, TUTORIAL_STEPS, type TutorialEvent } from '../src/ui/tutorialSteps';

const run = (events: TutorialEvent[]) => events.reduce((step, e) => advanceTutorial(step, e), 0);

describe('tutorial steps', () => {
  it('walks select → start → collect → garage, then finishes', () => {
    expect(TUTORIAL_STEPS).toHaveLength(4);
    expect(run(['select'])).toBe(1);
    expect(run(['select', 'start'])).toBe(2);
    expect(run(['select', 'start', 'collect'])).toBe(3);
    expect(run(['select', 'start', 'collect', 'garage'])).toBe(4);
  });

  it('ignores events that are not the current step', () => {
    expect(run(['collect', 'garage', 'start'])).toBe(0);
    expect(run(['select', 'select', 'garage'])).toBe(1);
  });

  it('skip ends it from any step and finished stays finished', () => {
    expect(run(['select', 'skip'])).toBe(4);
    expect(run(['select', 'start', 'collect', 'garage', 'select'])).toBe(4);
  });

  it('every step says who talks and where to point', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.text.length).toBeGreaterThan(10);
      expect(['customer', 'bay', 'collect', 'showcase']).toContain(s.point);
    }
  });
});
