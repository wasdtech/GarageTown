export type TutorialEvent = 'select' | 'start' | 'collect' | 'garage' | 'skip';

export interface TutorialStep {
  /** The event that completes this step. */
  until: Exclude<TutorialEvent, 'skip'>;
  /** What the arrow points at in the scene. */
  point: 'customer' | 'bay' | 'collect' | 'showcase';
  text: string;
}

/** Dona Cida's first-session walkthrough. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    until: 'select',
    point: 'customer',
    text: 'Oi, eu sou a Dona Cida! Chegou seu primeiro cliente. Toque no carro dele na rua.',
  },
  {
    until: 'start',
    point: 'bay',
    text: 'O balão mostra o que ele quer. Agora toque num box livre e escolha o serviço com ★.',
  },
  {
    until: 'collect',
    point: 'collect',
    text: 'Serviço rodando! Quando aparecer "Coletar" em cima do carro, toque para receber.',
  },
  {
    until: 'garage',
    point: 'showcase',
    text: 'Mandou bem! Aquele carro no pedestal dourado é o SEU. Toque nele para pintar e turbinar.',
  },
];

export const TUTORIAL_DONE = TUTORIAL_STEPS.length;

/**
 * Where Dona Cida starts when nothing was saved: only a brand-new garage (no XP, first branch) gets
 * the walkthrough; a new branch also starts at 0 XP but its player already knows the game.
 */
export function initialTutorialStep(
  saved: number | null,
  s: { xp: number; prestige: { branch: number } },
): number {
  if (saved !== null) return saved;
  return s.xp === 0 && s.prestige.branch === 1 ? 0 : TUTORIAL_DONE;
}

export function advanceTutorial(step: number, e: TutorialEvent): number {
  if (step >= TUTORIAL_DONE) return TUTORIAL_DONE;
  if (e === 'skip') return TUTORIAL_DONE;
  return TUTORIAL_STEPS[step]!.until === e ? step + 1 : step;
}
