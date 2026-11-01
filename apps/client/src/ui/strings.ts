import type { CollectError, MinigameError, StartError } from '@gt/sim';

type ErrorKey = StartError | CollectError | MinigameError;

export const S = {
  coins: 'Moedas',
  level: 'Nível',
  reputation: 'Reputação',
  pickCustomerFirst: 'Toque num cliente na rua primeiro 🚗',
  chooseService: 'Escolha o serviço',
  customerWants: 'Pedido do cliente',
  lockedAt: (lvl: number) => `Nível ${lvl}`,
  close: 'Fechar',
  inProgress: 'Em andamento',
  remaining: (t: string) => `Faltam ${t}`,
  doByHand: 'Fazer na mão ✋',
  leaveAuto: 'Deixar no automático',
  scrubMore: 'Capricha mais um pouco…',
  scrubTitle: 'Esfregue o carro!',
  reward: (coins: number, xp: number) => `+${coins} 🪙  +${xp} XP`,
  tip: (n: number) => `gorjeta +${n}`,
  timely: (n: number) => `pontual +${n}`,
  levelUp: (lvl: number) => `Subiu para o nível ${lvl}! 🎉`,
  endOfPrototype: 'Fim do protótipo — obrigado por testar!',
  errors: {
    bay_busy: 'Esse box já está ocupado',
    wrong_bay_type: 'Esse serviço precisa de outro box',
    job_locked: 'Serviço ainda bloqueado',
    no_customer: 'Esse cliente já foi embora',
    unknown_job: 'Serviço desconhecido',
    unknown_bay: 'Box desconhecido',
    empty_bay: 'Não tem carro nesse box',
    not_done: 'Ainda não terminou',
    not_eligible: 'Esse serviço não tem minijogo',
    gesture_too_short: 'Capricha mais um pouco…',
    rate_limited: 'Seus braços cansaram — tente mais tarde',
  } satisfies Record<ErrorKey, string>,
};

export function errorText(e: ErrorKey): string {
  return S.errors[e];
}
