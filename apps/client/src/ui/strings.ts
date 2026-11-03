import type {
  AssignError,
  BranchError,
  BuildError,
  BuyCarError,
  BuyPartError,
  CollectError,
  HireError,
  LookError,
  MinigameError,
  PerkError,
  StartError,
  TrainError,
} from '@gt/sim';

type ErrorKey =
  | StartError
  | CollectError
  | MinigameError
  | BuildError
  | BuyCarError
  | BuyPartError
  | LookError
  | HireError
  | TrainError
  | AssignError
  | BranchError
  | PerkError;

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
  saveReset: 'Não deu para ler o seu save. Começamos um jogo novo (uma cópia do antigo foi guardada).',
  tutorialSkip: 'Pular',
  soundOn: 'Ligar som',
  soundOff: 'Desligar som',
  musicOn: 'Ligar música',
  musicOff: 'Desligar música',
  showcaseSign: '⭐ Meu carro',
  team: {
    pitch: 'Cada ajudante atende e coleta sozinho no box dele, até com o jogo fechado.',
    pitchShort: 'Pronto pra contratar',
    hire: (price: number) => `Contratar · ${price} 🪙`,
    hired: (name: string) => `${name} entrou na equipe! 🤝`,
    train: (cost: number) => `Treinar · ${cost} 🪙`,
    trained: (name: string) => `${name} ficou mais rápido! 💪`,
    faster: (p: string) => `⚡ −${p} tempo`,
    share: (p: string) => `🪙 ${p}`,
    unlocksAt: (lvl: number) => `Chega no nível ${lvl}`,
    assignLabel: (name: string) => `Box de ${name}`,
    noBay: 'Sem box',
    bay: 'Box',
    clock: 'Relógio de ponto',
    shift: (hours: number) => `A equipe trabalha até ${hours} h depois que você sai.`,
    clockBuy: (hours: number, cost: number) => `Turno de ${hours} h · ${cost} 🪙`,
    clockBought: 'Turno ampliado! ⏰',
  },
  welcome: {
    title: 'Enquanto você estava fora',
    away: (ms: number) => {
      const m = Math.round(ms / 60_000);
      return m < 60
        ? `Você ficou fora ${m} min.`
        : `Você ficou fora ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}.`;
    },
    cars: 'carros',
    collect: 'Coletar',
  },
  menus: {
    bar: 'Menus',
    label: { car: 'Meu carro', dealer: 'Concessionária', team: 'Equipe', franchise: 'Franquia' },
    title: { car: 'Meu carro', dealer: 'Concessionária', team: 'Equipe', franchise: 'Franquia' },
  },
  garage: {
    title: 'Minha garagem',
    tabs: {
      paint: 'Pintura',
      finish: 'Acabamento',
      extras: 'Neon e adesivos',
      parts: 'Peças',
    },
    stat: { power: 'Potência', grip: 'Aderência' },
    style: 'Estilo',
    free: 'Grátis',
    owned: 'Liberado',
    maxed: 'Nível máximo',
    noSticker: 'Sem adesivo',
    showing: 'Em exposição',
    show: 'Expor este carro',
    installed: (part: string) => `${part} instalado! 🔧`,
    bought: (car: string) => `${car} é seu! 🎉`,
  },
  buildTitle: 'Construir box',
  buildPick: 'Escolha o tipo de box',
  slotUnlocksAt: (lvl: number) => `🔒 Esta vaga libera no nível ${lvl}`,
  bayTypes: { wash: 'Lavagem', mechanic: 'Mecânica', paint: 'Pintura', performance: 'Performance' },
  buildInfo: (cost: number, secs: string) => `${cost} 🪙 · obra de ${secs}`,
  buildStarted: (secs: string) => `Obra iniciada! Fica pronta em ${secs} 🚧`,
  buildInProgress: (secs: string) => `Obra em andamento: faltam ${secs}`,
  zoomIn: 'Aproximar',
  zoomOut: 'Afastar',
  franchise: {
    title: (n: number) => `Filial ${n}`,
    seals: (n: number) => `${n} selos`,
    runCoins: (n: string) => `Moedas ganhas nesta filial: ${n} 🪙`,
    preview: (n: number) => `Abrir agora: +${n} selos`,
    nextSeal: (n: string) => `faltam ${n} 🪙 para o próximo selo`,
    keeps: 'Você mantém seus carros. Recomeçam: moedas, nível, boxes e ajudantes.',
    lockedLevel: 'Disponível no nível 12',
    noSeals: 'Ganhe mais moedas nesta filial',
    confirm: 'Tem certeza? A oficina recomeça do zero.',
    open: 'Abrir filial',
    cancel: 'Cancelar',
    opened: (n: number, s: number) => `Filial ${n} aberta! +${s} selos`,
    available: 'Você já pode abrir uma nova filial! Toque em 🏢 Franquia.',
    topLevel: 'Nível máximo! Abra uma nova filial em 🏢 Franquia para ganhar selos.',
    buy: (n: number) => `Comprar · ${n}`,
    max: 'Máximo',
    perksTitle: 'Melhorias permanentes',
    effect: {
      lucro: (p: number) => `+${p}% moedas`,
      agilidade: (p: number) => `−${p}% tempo`,
      paciencia: (p: number) => `+${p}% paciência`,
      experiencia: (p: number) => `+${p}% XP`,
      recrutamento: (p: number) => `−${p}% custo de ajudantes`,
    } as Record<string, (p: number) => string>,
  },
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
    locked: 'Você ainda não tem nível para essa vaga',
    no_coins: 'Moedas insuficientes',
    slot_taken: 'Essa vaga já está ocupada',
    unknown_slot: 'Vaga desconhecida',
    unknown_model: 'Carro desconhecido',
    owned: 'Você já tem esse carro',
    unknown_car: 'Carro desconhecido',
    unknown_part: 'Peça desconhecida',
    maxed: 'Essa peça já está no máximo',
    unknown_option: 'Opção desconhecida',
    unknown_helper: 'Ajudante desconhecido',
    hired: 'Já está na sua equipe',
    not_hired: 'Contrate primeiro',
    bay_has_helper: 'Esse box já tem um ajudante',
    level: 'Disponível no nível 12',
    no_seals: 'Selos insuficientes',
    unknown_perk: 'Melhoria desconhecida',
  } satisfies Record<ErrorKey, string>,
};

export function errorText(e: ErrorKey): string {
  return S.errors[e];
}
