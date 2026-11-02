# Crescer a oficina: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task.

**Goal:** Animações de trânsito dos carros, construção de boxes (incluindo Pintura e Performance), níveis até 15, 6 serviços novos, clientes VIP e simulador de economia, tudo offline.

**Architecture:** As regras ficam em `packages/sim` (puro, testado). O conteúdo novo entra em `content/*.json`. O cliente só desenha e anima. As animações saem de uma diferença pura entre estados (`diffTransitions`), sem mudar regras.

**Spec:** `docs/superpowers/specs/2026-11-01-garage-town-design.md` §7.5

## Global Constraints
- `packages/sim` sem `Date.now`/`Math.random`.
- O save sobe para `version: 2` com migração automática do v1 (sem perder moedas, XP nem jobs).
- Valores da spec §7.5:
  - Box 3: nível 3, 150 🪙, obra de 2 min. Box 4: nível 6, 400 🪙, obra de 10 min.
  - XP dos níveis: 0, 20, 60, 130, 250, 420, 650, 950, 1350, 1850, 2500, 3300, 4300, 5500, 7000.
  - VIP: reputação ≥ 10, 10% de chance, paciência de 240 s, 2× moedas, pede só serviços de nível ≥ 4.
- `prefers-reduced-motion` desliga as viagens animadas.

## Review Focus
1. Save v1 carregado na versão nova: migra sem perder nada (Task 3).
2. Recarregar a página no meio de uma obra: a obra continua e termina (Task 3).
3. Animação disparada para um carro que já não existe (estado mudou durante a viagem): sem erro, sem carro "fantasma" preso (Task 1).
4. Construir sem moedas ou sem nível suficiente: recusado com mensagem clara (Task 3).
5. VIP pedindo um serviço cujo box o jogador não tem: o jogador ainda pode atender em outro box? Não. O VIP só pede serviços de tipos de box que o jogador já tem (Task 5).

---

### Task 1: Animações de trânsito
**Files:** `apps/client/src/scenes/transitions.ts` (puro) + `apps/client/test/transitions.test.ts`; modificar `GarageScene.ts`.

**Interfaces:**
```ts
type Transition =
  | { kind: 'arrive'; customerId: string; carKey: string; slot: number }
  | { kind: 'toBay'; customerId: string; carKey: string; fromSlot: number; bayId: string }
  | { kind: 'leave'; customerId: string; carKey: string; bayId: string }
  | { kind: 'giveUp'; customerId: string; carKey: string; slot: number };
function diffTransitions(prev: GameState | null, next: GameState): Transition[]
```

**Testes:**
- cliente novo na fila → `arrive` (slot = índice na fila);
- cliente sai da fila e aparece num bay → `toBay`;
- bay perde o job → `leave`;
- cliente some sem ir para um bay → `giveUp`;
- `prev = null` → nenhuma transição (primeiro desenho sem animação).

**Cena:**
- Carros "em viagem" são sprites temporários, fora do container dinâmico.
- O carro de destino fica escondido até a viagem acabar.
- A rota da saída é: box → rua (descendo no eixo y, com a imagem espelhada) → direita até sair da tela (eixo x).
- A desistência mostra uma fumaça.
- Duração entre 0,6 s e 1,2 s.
- Com reduced-motion, nada é animado.

### Task 2: Conteúdo — níveis 1–15, tipos de box, 6 serviços, vagas
- `BayType` passa a ser `wash | mechanic | paint | performance`.
- `content/garage.json`:
  ```json
  { "bays": [
    { "slot": 1, "tile": [2, 3], "prebuilt": "wash" },
    { "slot": 2, "tile": [5, 3], "prebuilt": "mechanic" },
    { "slot": 3, "tile": [2, 0], "level": 3, "cost": 150, "buildS": 120 },
    { "slot": 4, "tile": [5, 0], "level": 6, "cost": 400, "buildS": 600 }
  ] }
  ```
- Moedas e XP dos serviços novos ficam proporcionais (≈ 0,12 🪙/s e XP decrescente). O ajuste final vem da Task 6.
- Os ícones novos são placeholders até a geração no SpriteCook (precisa reautorizar).

### Task 3: Sim — construir boxes, save v2
- Funções:
  ```ts
  startBuild(c, s, { slot: number; type: BayType }, now): Result<GameState, 'locked' | 'no_coins' | 'slot_taken' | 'unknown_slot'>
  buildProgress(...)
  ```
- A obra fica no estado `builds: { slot, type, startedAt, durationS }[]`.
- `tick` transforma a obra concluída em bay automaticamente.
- `deserialize` migra o save v1 → v2.

### Task 4: Cliente — tela "Construir box" e placa de obra
- Tocar na vaga listrada abre uma lista de tipos com custo e nível.
- Durante a obra: placa com barra de progresso.
- Quando todas as vagas estão ocupadas, a vaga some.

### Task 5: VIP
- No `tick`, com reputação ≥ 10, 10% das chegadas são VIP (`vip: true`).
- A necessidade é sorteada entre serviços de nível ≥ 4 cujo tipo de box o jogador possui. Se não houver nenhum, o cliente é normal.
- Paciência de 240 s. O `computeReward` dobra as moedas.
- No cliente: balão dourado e tint metálico.

### Task 6: Simulador de economia
- `tools/econ-sim.ts`: perfis casual, médio e intenso por 30 dias.
- O teste do Vitest falha se o perfil médio sair de "nível 10 entre os dias 2 e 4".

### Task 7: E2E e publicação
- E2E: construir o box 3, fazer um serviço nele e ver o carro ir embora (sem erros).
- Republicar a página.
