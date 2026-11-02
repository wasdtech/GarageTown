# Ajudantes, idle híbrido, áudio e animações: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajudantes NPC que atendem boxes sozinhos (também offline, até o fim do turno), tela "enquanto você estava fora", mais sons e música, e animações dos carros parados e em serviço.

**Architecture:**
- Regras novas no `packages/sim`, que continua puro:
  - `helpers.ts`: contratar, treinar, designar, relógio de ponto;
  - `idle.ts`: motor de eventos dentro do `tick`.
- O cliente ganha a aba "Equipe", o crachá no box, a tela de boas-vindas, `ambient.ts` (puro) com os efeitos na cena e a expansão de `sfx.ts` com música.

**Tech Stack:** TypeScript, Phaser 3.90, Vitest, Playwright, Web Audio.

**Spec:** `docs/superpowers/specs/2026-11-02-ajudantes-idle-audio-design.md`

## Global Constraints
- **Pureza:** `packages/sim` sem `Date.now` nem `Math.random`; determinismo pela seed do estado.
- **Ajudantes:**
  - Contratação: `ze` (nível 2, 300), `bia` (4, 1500), `tiao` (7, 4000), `neusa` (10, 10000).
  - Por nível 1–5: duração ×1,00/0,93/0,86/0,79/0,72 e repasse 80/84/88/92/95%.
  - Treino para os níveis 2–5: 2×/4×/8×/16× o preço de contratação.
- **Pagamento de serviço feito por ajudante:** moedas × repasse (VIP mantém o 2× antes do repasse), sem gorjeta, sem pontualidade, XP cheio, 0 de reputação.
- **Turno:** 4 h, 6 h ou 8 h depois de `lastActiveAt` (`clockTier` 0/1/2). Relógio de ponto: 3000 e 12000 🪙.
- **Motor de eventos:** limite de 10.000 eventos por tick; 8 h de offline em menos de 50 ms.
- **Save:** v4 com migração do v3 (`helpers: []`, `clockTier: 0`, `lastActiveAt = lastTickAt`, `idleReport: { jobs: 0, coins: 0, xp: 0 }`).
- **Animações:** no máximo ~30 partículas ativas; nada animado com `prefers-reduced-motion`.
- **Áudio:** só começa depois de uma interação; uma falha de áudio nunca quebra o jogo; música (🎵) e efeitos (🔊) com preferências separadas e salvas.

## Review Focus
1. **Jogador e ajudante no mesmo box:** o jogador inicia um serviço num box que tem ajudante. O ajudante não inicia outro por cima, e a recompensa é a manual (Task 3).
2. **Relógio do aparelho volta ou salta para a frente com ajudantes:** o rebase também desloca `lastActiveAt`. Um salto de 3 dias para a frente rende no máximo um turno (Task 3).
3. **Clientes de tipo sem ajudante:** continuam na fila e expiram normalmente. O ajudante só pega clientes do tipo do box dele (Task 3).
4. **Desdesignar o ajudante com serviço em andamento:** o serviço continua. Ao terminar, quem coleta é o jogador, com a recompensa do ajudante, porque o serviço foi iniciado por ele (`job.byHelper`) (Task 3).
5. **Save v3 com serviços em andamento e sem ajudantes:** o comportamento é idêntico ao atual (Task 2).

---

### Task 1: Conteúdo dos ajudantes
**Files:** `content/helpers.json`; modificar `packages/shared/src/content.ts`; testar em `packages/shared/test/content.test.ts`.

**Interfaces:** Produces:
```ts
interface HelperDef { key: string; name: string; face: string; unlockLevel: number; price: number }
Content.helpers: HelperDef[]
Content.helperLevels: { speed: number; share: number; trainCostMult: number }[]
// 5 entradas; trainCostMult do nível 1 = 0
Content.clockTiers: { hours: number; cost: number }[]  // [{4,0},{6,3000},{8,12000}]
```
- [ ] **Teste:** 4 ajudantes com os valores da tabela. `helperLevels` com speed `[1,0.93,0.86,0.79,0.72]`, share `[0.8,0.84,0.88,0.92,0.95]` e trainCostMult `[0,2,4,8,16]`. `clockTiers` como acima.
- [ ] Rodar o teste: FAIL. Implementar. Rodar: PASS. Commit.

### Task 2: Estado v4 e ações da equipe
**Files:** `packages/sim/src/helpers.ts`; modificar `state.ts` e `save.ts`; teste em `packages/sim/test/helpers.test.ts`.

**Interfaces:** Produces:
```ts
interface HiredHelper { key: string; level: number; bayId: string | null }
GameState.version: 4
GameState.helpers: HiredHelper[]
GameState.clockTier: number
GameState.lastActiveAt: number
GameState.idleReport: { jobs: number; coins: number; xp: number }
ActiveJob.byHelper?: string  // chave do ajudante que iniciou
hireHelper(c, s, key, now): Result<GameState, 'unknown_helper'|'hired'|'locked'|'no_coins'>
trainHelper(c, s, key, now): Result<GameState, 'unknown_helper'|'not_hired'|'maxed'|'no_coins'>
assignHelper(s, key, bayId | null, now): Result<GameState, 'not_hired'|'unknown_bay'|'bay_has_helper'>
buyClock(c, s, now): Result<GameState, 'maxed'|'no_coins'>
shiftEndsAt(c, s): number  // lastActiveAt + clockTiers[clockTier].hours h
touch(s, now): GameState   // lastActiveAt = max(lastActiveAt, now)
```

- [ ] **Testes:**
  - nível/preço e "já contratado";
  - treino com os custos 600/1200/2400/4800 do `ze` e `maxed` no nível 5;
  - designar a um box ocupado por outro ajudante → `bay_has_helper`;
  - designar `null` libera;
  - `buyClock` 3000 → tier 1, 12000 → tier 2, depois `maxed`;
  - `startJob`, `collectJob`, `startBuild`, `buyCar`, `buyPart`, `applyLook` e minijogo atualizam `lastActiveAt` (via `touch`);
  - migração v3 → v4 (Review Focus 5: um save v3 com job em andamento coleta igual ao de hoje).
- [ ] FAIL → implementar → PASS → commit.

### Task 3: Motor idle (eventos)
**Files:** `packages/sim/src/idle.ts`; modificar `customers.ts` (o `tick` delega) e `jobs.ts` (recompensa do ajudante); teste em `packages/sim/test/idle.test.ts`.

**Interfaces:** Produces:
```ts
helperReward(c, s, job, helper): Reward  // moedas × share (VIP 2× antes), tip 0, timely 0, rep 0, XP cheio
runHelpers(c, s, until): GameState       // processa eventos até `until`
clearIdleReport(s): GameState
```

**Algoritmo de `tick(c, s, now)` com ajudantes:**
1. Faz o rebase se `now < lastTickAt` (inclui `lastActiveAt`).
2. `end = min(now, shiftEndsAt)`.
3. Laço até `end`, no máximo 10.000 iterações. O próximo evento é o menor entre:
   - `nextCustomerAt`;
   - o fim de cada job com `byHelper` num box cujo ajudante ainda está designado.
4. Em cada evento:
   - aplica a chegada, ou a coleta automática com `helperReward` (acumulando `idleReport`);
   - depois, cada box com ajudante e sem job pega o cliente mais antigo cujo `need` é do tipo do box. O job usa `durationS × speed` (arredondado) e `byHelper`.
5. Depois de `end`, a lógica O(1) atual cobre o restante até `now`.
6. `collectJob` de um job com `byHelper` (feito pelo jogador) paga `helperReward` (Review Focus 4).

- [ ] **Testes:**
  - ajudante `ze` nível 1 no box de lavagem, fila com um cliente `wash`: inicia na hora com duração 30 s; aos 30 s coleta 4 🪙 (`floor(5 × 0,8)`) e 3 XP, sem gorjeta;
  - box com job manual: o ajudante não inicia outro, e a coleta manual paga gorjeta (Review Focus 1);
  - cliente `oil` com ajudante só na lavagem: continua na fila e expira (Review Focus 3);
  - com `lastActiveAt = T0`, avançar 10 h (turno de 4 h): `idleReport.jobs` > 0 e nenhum job iniciado por ajudante depois de T0+4 h;
  - salto de +3 dias rende o mesmo que +4 h, e relógio para trás não quebra (Review Focus 2);
  - determinismo: mesma seed, mesmo resultado;
  - desempenho: 8 h com 2 ajudantes em menos de 50 ms;
  - `clearIdleReport` zera o relatório.
- [ ] FAIL → implementar → PASS (incluindo toda a suíte anterior) → commit.

### Task 4: Simulador de economia com ajudantes
**Files:** modificar `packages/sim/src/econSim.ts` e `packages/sim/test/economy.test.ts`.
- [ ] **Comportamento do simulador:** contrata assim que pode, designa nos boxes livres (lavagem primeiro), treina com sobra depois das peças e compra o relógio.
- [ ] **Perfil novo** `offline`: 2 sessões de 2 min por dia.
- [ ] **Testes:**
  - médio: nível 10 entre os dias 2 e 4 (ajustar preços ou repasse só se falhar, registrando o ajuste);
  - 1 dia do `offline` rende menos moedas que 1 dia do `medio`.
- [ ] Commit.

### Task 5: Interface — Equipe, crachá e boas-vindas
**Files:** `apps/client/src/ui/teamTab.ts`, `ui/welcomeBack.ts`; modificar `garageSheet.ts` (aba `team`), `store.ts`, `GarageScene.ts` (crachá), `structureKey.ts` (inclui os ajudantes) e `main.ts`; testes em `apps/client/test/store.test.ts` e `structureKey.test.ts`.
- [ ] **Store:** `hireHelper(key)`, `trainHelper(key)`, `assignHelper(key, bayId|null)`, `buyClock()`, `clearIdleReport()`, todos `Result<void, E>`.
- [ ] **Aba "Equipe":**
  - um cartão por ajudante (rosto, nome, nível, velocidade %, repasse %, botão contratar/treinar, seletor de box);
  - cartão do Relógio de ponto.
  - `data-testid`: `hire-ze`, `train-ze`, `assign-ze` (select) e `clock`.
- [ ] **Cena:** crachá `"<face> <nome>"` sobre o box designado e o rótulo "auto" no balão do box.
- [ ] **Boas-vindas:** ao carregar, se `idleReport.jobs > 0`, mostra uma ficha com o tempo fora, os carros, 🪙 e XP. O botão "Coletar" chama `clearIdleReport`, faz as moedas voarem e o confete. `data-testid="welcome-back"`.
- [ ] **E2E** `helpers.spec.ts` (save semeado com nível 2 e 1.000 🪙):
  1. contratar o Zé e designar ao box 1;
  2. avançar 60 s: o box 1 fez pelo menos 1 serviço sem toque;
  3. recarregar e avançar 2 h: a ficha de boas-vindas aparece e some ao coletar.
- [ ] Commit.

### Task 6: Animações de vida
**Files:** `apps/client/src/scenes/ambient.ts`; modificar `GarageScene.ts`; teste em `apps/client/test/ambient.test.ts`.

**Interfaces:**
```ts
type Ambient =
  | { id: string; kind: 'idle' | 'impatient' }
  | { id: string; kind: 'service'; bay: BayType };
function ambientFor(s: GameState, now: number): Ambient[]
// impatient quando a paciência restante for < 30%
```
- [ ] **Testes:**
  - fila nova → `idle`;
  - cliente com 25% de paciência → `impatient`;
  - box de pintura com job → `service` / `paint`;
  - box com job concluído → nada (já tem o pulinho).
- [ ] **Cena:**
  - balanço contínuo nos carros da fila (fase por id) e fumaça a cada 3–6 s;
  - `impatient`: tremida a cada 2 s, 💢 ao lado do balão e `onImpatient(id)` uma vez por cliente (buzina na Task 7);
  - `service`: emissores leves por tipo (lavagem: bolhas; mecânica: +6 px e faíscas; pintura: névoa; performance: vibração e chama);
  - no máximo 30 partículas; nada com reduced-motion.
- [ ] Captura de tela para conferência visual. Commit.

### Task 7: Áudio
**Files:** modificar `apps/client/src/ui/sfx.ts`, `main.ts`, `controller.ts`; teste em `apps/client/test/sfx.test.ts`.
- [ ] **Sons novos:** `horn`, `engine`, `error`, `menu`, `register` (compra), `hired`, `scrub` (loop curto), `welcome`.
- [ ] **Música:** `startMusic()` / `stopMusic()` com loop sintetizado (progressão de 4 acordes, volume baixo) e preferência `gt.music`. Botão 🎵 (`data-testid="music"`).
  - Se o SoundWeaver estiver instalado (`ListPlugins`), trocar a síntese dos efeitos por WAVs dele sem mudar a interface `Sfx`.
- [ ] **Testes:** preferências de música e efeitos independentes; todos os sons novos não lançam erro sem `AudioContext`; o mudo de efeitos não desliga a música.
- [ ] **Ligações:**
  - `horn` no `onImpatient`;
  - `engine` ao sair do box;
  - `error` nos toasts de erro;
  - `register` nas compras;
  - `hired` ao contratar;
  - `welcome` na ficha de boas-vindas.
- [ ] Commit.

### Task 8: Verificação, publicação e PR
- [ ] lint, typecheck, unitários, E2E (`CI=1`), tamanho do bundle (menos de 3 MB).
- [ ] Revisão final da branch por um revisor independente.
- [ ] Publicar a página e abrir o PR empilhado sobre o #6.
