# Garage Town M0 — Protótipo Local: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protótipo jogável no navegador (desktop e celular). Ele tem oficina isométrica 8×8, 2 boxes, 5 serviços, fila de clientes, 🪙 e XP, níveis 1–5, minijogo de lavagem e save local. Serve para validar se o loop curto é divertido.

**Architecture:**
- Monorepo pnpm.
- `packages/sim` contém as regras puras. O tempo `now` (ms) é sempre parâmetro e o RNG tem seed no estado. Esse pacote é reutilizado no servidor no M1.
- `packages/shared` contém os schemas zod e o loader do conteúdo em `content/*.json`.
- `apps/client` (Phaser 3 + DOM/CSS) só renderiza e traduz input em chamadas ao sim.
- No M0 não há backend. O estado vive no `localStorage`.

**Tech Stack:**
- Node 22, pnpm 10, TypeScript 5.9.3, Vite 8, Vitest 5, zod 4, Phaser 3.90.0.
- ESLint e Prettier.
- `@playwright/test` 1.63.0, a mesma versão do Playwright pré-instalado no ambiente.

**Spec:** `docs/superpowers/specs/2026-11-01-garage-town-design.md` (§1.2, §1.3, §2.1, §2.2, §2.4, §4, §6.1, §6.5 M0)

## Global Constraints
- Nome do jogo lido de `content/brand.json` (`{"name": "Garage Town"}`). Nenhum outro arquivo escreve o nome literalmente.
- Carros **fictícios**. Sem marca real, logo ou design reconhecível de fabricante.
- `packages/sim` sem I/O, sem `Date.now()`, sem `Math.random()`. Tempo e aleatoriedade entram por parâmetro ou pelo estado.
- Conteúdo como dados (`content/*.json`), validado por zod no CI.
- Tiles isométricos 64×32. Terreno inicial 8×8.
- Fila de no máximo 6 clientes. Coleta em até 5 min após o fim dá +10%. Minijogo em serviços ≤ 5 min dá +25% e conclui na hora, com no máximo 20 usos por hora e gesto mínimo de 5 s.
- Performance: 60 fps em celular médio, bundle inicial abaixo de 3 MB.
- Fonte de UI *Baloo 2* (Google Fonts). Cartoon limpo, contorno escuro, sombra suave.
- Texto da UI em PT-BR no M0. A i18n é do M3, mas todas as strings ficam em `apps/client/src/ui/strings.ts`.
- Fora do escopo do M0 (não implementar): backend, login, tipos de box Pintura e Performance, customização, simulador de economia (os critérios dele são de nível 10 e 20, e o M0 vai só até 5), áudio.

## Valores de conteúdo do M0 (decisões deste plano)
| job key | nome | box | duração | 🪙 | XP | nível |
|---|---|---|---|---|---|---|
| `wash` | Lavagem | `wash` | 30 s | 5 | 3 | 1 |
| `oil` | Troca de óleo | `mechanic` | 120 s | 15 | 6 | 1 |
| `polish` | Polimento | `wash` | 180 s | 22 | 8 | 2 |
| `tires` | Pneus novos | `mechanic` | 300 s | 35 | 10 | 3 |
| `engine` | Revisão de motor | `mechanic` | 3600 s | 300 | 50 | 4 |

- **Níveis (XP acumulado):** nível 1 = 0, nível 2 = 20, nível 3 = 60, nível 4 = 130, nível 5 = 250. O nível 5 é o máximo do M0 e mostra o banner "Fim do protótipo — obrigado por testar!".
- **Clientes:** um a cada 20 s, paciência de 120 s, necessidade sorteada entre os jobs desbloqueados.
- **Gorjeta:** quando o job escolhido é igual à necessidade, ganha +20% das 🪙 (arredondado para baixo) e +1 de reputação.
- **Minijogo:** vale para os jobs com `durationS ≤ 300` e box `wash` (`wash` e `polish`), porque o gesto do M0 é "esfregar".
- **Carros de cliente:** `vespa_gt`, `brutus_v8` e `kumo_86`. São visuais apenas, sorteados.
- **Layout inicial:** box `wash` no tile (2,3) e box `mechanic` no tile (5,3). A rua/fila fica ao longo de y = 7.

## Review Focus
1. **Save ausente, corrompido ou de versão desconhecida.** O jogo deve começar do zero sem travar e sem apagar a chave antiga sem antes copiá-la para `gt.save.bak` (Task 6).
2. **Relógio do aparelho volta no tempo.** O progresso nunca fica negativo: um job não "desfaz" e não nascem clientes duplicados (Tasks 3 e 4).
3. **Aba em segundo plano ou fechada por horas.** Na volta, a fila é recalculada em O(1), limitada a 6 clientes, sem loop de milhares de iterações. Clientes expirados somem e jobs prontos esperam a coleta (Tasks 3 e 6).
4. **Toque duplo em "Coletar" ou "Iniciar".** Paga uma vez só e não inicia dois jobs no mesmo box (Tasks 4 e 8).
5. **Ganho de XP que pula vários níveis de uma vez.** Desbloqueia tudo o que ficou para trás e mostra um único toast com o nível final (Tasks 2 e 4).

---

### Task 1: Scaffold do monorepo + CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.nvmrc` (`22`)
- Create: `packages/sim/{package.json,tsconfig.json,src/index.ts,test/smoke.test.ts}`
- Create: `packages/shared/{package.json,tsconfig.json,src/index.ts}`
- Create: `apps/client/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.ts}`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (como rodar: `pnpm i`, `pnpm dev`, `pnpm test`)

**Interfaces:**
- Produces:
  - Pacotes `@gt/sim`, `@gt/shared` e `@gt/client`.
  - Scripts na raiz: `dev` (vite do client), `build`, `test` (vitest em todos), `typecheck` (`tsc -b`), `lint`, `e2e`.

- [ ] **Step 1:** Criar o workspace. TS em `strict`, ESM, `moduleResolution: "bundler"`. `@gt/sim` e `@gt/shared` exportam `src/index.ts` direto (sem build; o Vite e o Vitest resolvem TS).
- [ ] **Step 2:** Teste smoke `packages/sim/test/smoke.test.ts`: `expect(SIM_VERSION).toBe(1)`, com `export const SIM_VERSION = 1` em `src/index.ts`.
- [ ] **Step 3:** `apps/client/src/main.ts` cria um `Phaser.Game` 960×600 com `scale.mode = Phaser.Scale.RESIZE`, fundo `#2b2d42`, e uma cena vazia `BootScene`. `index.html` carrega *Baloo 2* do Google Fonts.
- [ ] **Step 4:** O CI (`ci.yml`) roda em push e PR, com Node 22 + pnpm 10: `pnpm i --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] **Step 5: Verificar**

Run: `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: todos passam e `apps/client/dist/` é gerado. `pnpm dev` abre a tela azul-escura em `localhost:5173`.

- [ ] **Step 6: Commit** — `chore: scaffold monorepo, client, sim, shared and CI`

---

### Task 2: Conteúdo + schemas + níveis

**Files:**
- Create: `content/{brand.json,jobs.json,levels.json,cars.json}` (valores da tabela acima)
- Create: `packages/shared/src/content.ts`
- Create: `packages/shared/test/content.test.ts`
- Create: `packages/sim/src/levels.ts`, `packages/sim/test/levels.test.ts`

**Interfaces:**
- Produces (`@gt/shared`):
  ```ts
  type BayType = 'wash' | 'mechanic'
  type JobKey = string
  interface JobDef { key: JobKey; name: string; bay: BayType; durationS: number; coins: number; xp: number; unlockLevel: number }
  interface LevelDef { level: number; xp: number }      // XP acumulado mínimo
  interface CarDef { key: string; name: string; sprite: string }
  interface Content { brand: { name: string }; jobs: JobDef[]; levels: LevelDef[]; cars: CarDef[] }
  function parseContent(raw: unknown): Content          // lança ZodError
  function loadContent(): Content                       // importa os 4 JSON e chama parseContent
  ```
- Produces (`@gt/sim`):
  ```ts
  function levelForXp(c: Content, xp: number): number
  function unlockedJobs(c: Content, level: number): JobDef[]
  function maxLevel(c: Content): number
  ```

- [ ] **Step 1: Testes que falham**
  - `content.test.ts`:
    - `loadContent()` retorna 5 jobs, 5 níveis e 3 carros.
    - `parseContent` rejeita `durationS: 0`.
    - Rejeita job com `bay: "paint"`.
    - Rejeita `levels` fora de ordem crescente de XP.
    - Rejeita `unlockLevel` maior que o nível máximo.
    - Rejeita `key` de job duplicada.
  - `levels.test.ts`:
    - `levelForXp(c,0)===1`, `(c,19)===1`, `(c,20)===2`, `(c,250)===5`, `(c,99999)===5`. Este último cobre o salto de vários níveis (Review Focus 5).
    - `unlockedJobs(c,1)` tem as keys `['wash','oil']`.
    - `unlockedJobs(c,4)` tem 5 jobs.
- [ ] **Step 2:** Run `pnpm test` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar os schemas zod com `.superRefine` para ordem, unicidade e `unlockLevel`. Implementar as funções de nível.
- [ ] **Step 4:** Run `pnpm test` → PASS.
- [ ] **Step 5: Commit** — `feat: M0 content schemas, data and level rules`

---

### Task 3: Estado inicial, RNG e chegada/saída de clientes

**Files:**
- Create: `packages/sim/src/{rng.ts,state.ts,customers.ts}`
- Create: `packages/sim/test/customers.test.ts`

**Interfaces:**
- Consumes: `Content`, `unlockedJobs`, `levelForXp` (Task 2).
- Produces:
  ```ts
  interface Bay { id: string; type: BayType; tile: { x: number; y: number }; job: ActiveJob | null }
  interface ActiveJob { jobKey: JobKey; customerId: string; carKey: string; need: JobKey; startedAt: number; durationS: number }
  interface Customer { id: string; carKey: string; need: JobKey; arrivedAt: number; patienceUntil: number }
  interface GameState {
    version: 1; coins: number; xp: number; reputation: number;
    bays: Bay[]; queue: Customer[];
    nextCustomerAt: number; lastTickAt: number;
    minigameUses: number[];        // timestamps (ms) da última hora
    rngState: number; nextId: number;
  }
  const QUEUE_MAX = 6, ARRIVAL_MS = 20_000, PATIENCE_MS = 120_000
  function createInitialState(c: Content, now: number, seed: number): GameState
  function nextRandom(s: number): [value: number, nextState: number]   // mulberry32, value em [0,1)
  function tick(c: Content, s: GameState, now: number): GameState
  ```

- [ ] **Step 1: Testes que falham** (`customers.test.ts`, `T0 = 1_700_000_000_000`)
  - O estado inicial tem 0 🪙, 0 XP, a fila vazia e os bays `wash@(2,3)` e `mechanic@(5,3)` livres. `nextCustomerAt === T0 + 20_000`.
  - `tick` em `T0+20_000` → 1 cliente, com `need` em `['wash','oil']` e `patienceUntil === arrivedAt + 120_000`.
  - Mesma seed + mesmos `now` → estados idênticos (determinismo).
  - `tick` em `T0+10*3600_000` (10 h ausente) → fila com exatamente 6 clientes e todos com `patienceUntil > now`. Ou seja, nascem só os últimos 6 slots, calculados por aritmética. O teste mede `performance.now()` e exige < 5 ms (Review Focus 3).
  - Um cliente em `T0+20_000`, depois `tick` em `T0+20_000+120_001` → o cliente sai (paciência).
  - Relógio para trás: `tick(s, T0+60_000)` e depois `tick(s', T0+30_000)` → retorna estado igual a `s'`, sem clientes novos nem remoção (Review Focus 2).
- [ ] **Step 2:** Run `pnpm --filter @gt/sim test` → FAIL.
- [ ] **Step 3:** Implementar. Se `now < lastTickAt`, retorna `s` inalterado. Senão:
  1. Calcula `k = floor((now - nextCustomerAt)/ARRIVAL_MS) + 1` chegadas pendentes.
  2. Gera só as que ainda estariam dentro da paciência, no máximo `QUEUE_MAX - fila atual` (as mais recentes).
  3. Remove os expirados.
  4. Avança `nextCustomerAt` por `k*ARRIVAL_MS`.
  5. Atualiza `lastTickAt`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(sim): initial state, seeded rng and customer queue`

---

### Task 4: Iniciar, acompanhar e coletar serviços

**Files:**
- Create: `packages/sim/src/jobs.ts`, `packages/sim/src/result.ts`
- Create: `packages/sim/test/jobs.test.ts`

**Interfaces:**
- Consumes: `GameState`, `tick`, `levelForXp`, `unlockedJobs`.
- Produces:
  ```ts
  type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E }
  interface Reward { coins: number; xp: number; tip: number; timelyBonus: number; reputation: number; levelBefore: number; levelAfter: number }
  type StartError = 'bay_busy' | 'wrong_bay_type' | 'job_locked' | 'no_customer' | 'unknown_job' | 'unknown_bay'
  type CollectError = 'empty_bay' | 'not_done' | 'unknown_bay'
  const TIMELY_WINDOW_MS = 300_000, TIMELY_BONUS = 0.10, TIP_RATE = 0.20
  function startJob(c: Content, s: GameState, a: { customerId: string; bayId: string; jobKey: JobKey }, now: number): Result<GameState, StartError>
  function jobProgress(job: ActiveJob, now: number): { done: boolean; remainingMs: number; fraction: number }
  function collectJob(c: Content, s: GameState, bayId: string, now: number): Result<{ state: GameState; reward: Reward }, CollectError>
  ```

- [ ] **Step 1: Testes que falham** (`jobs.test.ts`)
  - `startJob` com `wash` no bay `wash` → o cliente sai da fila e `bay.job.startedAt === now`.
  - `oil` no bay `wash` → `wrong_bay_type`.
  - `tires` no nível 1 → `job_locked`.
  - Segundo `startJob` no mesmo bay → `bay_busy` (Review Focus 4).
  - `customerId` inexistente → `no_customer`.
  - `jobProgress` em `startedAt+15_000` para `wash` → `fraction 0.5` e `remainingMs 15_000`.
  - Relógio para trás (`now < startedAt`) → `fraction 0` e `done false` (Review Focus 2).
  - `collectJob` antes do fim → `not_done`.
  - Coleta de `wash` com need `wash` em `fim+1_000` → `coins = 5 + tip 1 + timely 0` (`floor(5*0.2)=1`, `floor(5*0.1)=0`), XP 3, reputação +1.
  - `oil` com need `oil` em `fim+300_000` → `15 + 3 + 1 = 19`.
  - `oil` com need `oil` em `fim+300_001` → `15 + 3 = 18`.
  - Coletar duas vezes → a segunda dá `empty_bay` e as 🪙 não mudam (Review Focus 4).
  - Estado com `xp: 0`, coleta que dá 300 XP (fixture com job de teste) → `levelBefore 1`, `levelAfter 5` (Review Focus 5).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar. Todas as funções começam chamando `tick(c, s, now)`. O bônus usa `floor`. Job ≠ necessidade → `tip 0`, `reputation 0`. Os campos `need` e `carKey` vêm do cliente consumido.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(sim): start, progress and collect jobs with tips and timely bonus`

---

### Task 5: Minijogo — concluir na hora

**Files:**
- Create: `packages/sim/src/minigame.ts`, `packages/sim/test/minigame.test.ts`

**Interfaces:**
- Consumes: `collectJob`, `Reward`, `Result`.
- Produces:
  ```ts
  type MinigameError = 'empty_bay' | 'not_eligible' | 'gesture_too_short' | 'rate_limited' | 'unknown_bay'
  const MINIGAME_BONUS = 0.25, MINIGAME_MIN_GESTURE_MS = 5_000, MINIGAME_MAX_PER_HOUR = 20, MINIGAME_MAX_DURATION_S = 300
  function isMinigameEligible(c: Content, job: ActiveJob): boolean   // durationS <= 300 && bay === 'wash'
  function completeWithMinigame(c: Content, s: GameState, bayId: string, gestureMs: number, now: number): Result<{ state: GameState; reward: Reward }, MinigameError>
  ```

- [ ] **Step 1: Testes que falham**
  - `wash` iniciado e minijogo com `gestureMs 5_000` → reward com `coins = 5 + floor(5*0.25)=1 + tip 1 = 7`, sem bônus de pontualidade, e o bay fica livre.
  - `gestureMs 4_999` → `gesture_too_short`.
  - `engine` → `not_eligible`. `oil` (box `mechanic`) → `not_eligible`.
  - 20 usos em menos de 1 h → o 21º dá `rate_limited`. Em `primeiro_uso + 3_600_001` volta a ser permitido. `minigameUses` guarda só os timestamps da última hora.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar reaproveitando o cálculo de reward da Task 4. Extrair `computeReward(c, s, job, now, opts: { minigame: boolean })` para `jobs.ts`, exportado internamente.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(sim): optional minigame instant completion with rate limit`

---

### Task 6: Save local versionado

**Files:**
- Create: `packages/sim/src/save.ts`, `packages/sim/test/save.test.ts`
- Create: `apps/client/src/state/storage.ts`

**Interfaces:**
- Consumes: `GameState`, `createInitialState`, `tick`.
- Produces:
  ```ts
  // @gt/sim
  function serialize(s: GameState): string
  function deserialize(c: Content, raw: string | null, now: number, seed: number): { state: GameState; recovered: 'ok' | 'missing' | 'corrupt' | 'unknown_version' }
  // apps/client
  const SAVE_KEY = 'gt.save', BACKUP_KEY = 'gt.save.bak'
  function loadGame(c: Content, now: number): GameState      // try/catch em tudo; em corrupt/unknown_version copia raw para BACKUP_KEY
  function saveGame(s: GameState): void                     // try/catch; falha silenciosa + console.warn
  ```

- [ ] **Step 1: Testes que falham** (`save.test.ts`)
  - Round-trip: `deserialize(serialize(s))` é igual a `tick(s, now)` com `recovered 'ok'`.
  - `null` → `missing` + estado inicial.
  - `'{oops'` → `corrupt`.
  - `{"version":99}` → `unknown_version`.
  - JSON válido com `coins: -5` ou sem `bays` → `corrupt` (validar com schema zod do `GameState`) (Review Focus 1).
  - Save com job iniciado 10 h atrás e 3 clientes antigos → após `deserialize`, o job fica `done` aguardando coleta e a fila é refeita conforme a Task 3 (Review Focus 3).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar. A seed de `createInitialState` no fallback vem do parâmetro. O client usa `crypto.getRandomValues`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat: versioned local save with corruption recovery`

---

### Task 7: Renderização isométrica + arte dos 3 carros (portão de revisão do dono)

**Files:**
- Create: `apps/client/src/iso/iso.ts`, `apps/client/test/iso.test.ts`
- Create: `apps/client/src/scenes/GarageScene.ts`
- Create: `art/src/tiles/{floor.svg,street.svg}`, `art/src/objects/{bay_wash.svg,bay_mechanic.svg}`
- Create: `art/src/cars/{vespa_gt,brutus_v8,kumo_86}/{body.svg,details.svg}`
- Create: `apps/client/src/ui/theme.css` (tokens: cores, raios, sombras)

**Interfaces:**
- Produces:
  ```ts
  const TILE_W = 64, TILE_H = 32
  function isoToScreen(x: number, y: number, origin: { x: number; y: number }): { x: number; y: number }
  function screenToIso(px: number, py: number, origin: { x: number; y: number }): { x: number; y: number }  // tile inteiro (floor)
  function depthOf(x: number, y: number): number  // x + y, para ordenar sprites
  class GarageScene extends Phaser.Scene {
    renderState(s: GameState, now: number): void
    events: 'customer:tap'(id) | 'bay:tap'(id)
  }
  ```

- [ ] **Step 1: Testes que falham** (`iso.test.ts`)
  - `isoToScreen(0,0,o)` = `o`.
  - `isoToScreen(1,0,o)` = `o + (32, 16)`.
  - `isoToScreen(0,1,o)` = `o + (-32, 16)`.
  - `screenToIso(isoToScreen(3,5,o).x, isoToScreen(3,5,o).y + 1, o)` = `{3,5}`.
  - `depthOf(2,3) < depthOf(3,3)`.
- [ ] **Step 2:** Run `pnpm --filter @gt/client test` → FAIL.
- [ ] **Step 3:** Implementar `iso.ts`. Desenhar os SVGs:
  - Cada carro é uma vista isométrica única (sudeste), 128×80.
  - `body.svg` é a carroceria em tons de cinza (`#808080` a `#e0e0e0`), para receber `setTint`. `details.svg` traz rodas, vidro e faróis já coloridos.
  - Contorno `#1d1d2b` de 3 px.
  - Formas originais: *Vespa GT* é um compacto arredondado, *Brutus V8* um muscle de capô longo, *Kumo 86* um cupê baixo de faróis finos.
- [ ] **Step 4:** `GarageScene` carrega os SVGs com `this.load.svg`.
  - Desenha o piso 8×8 e a rua em y = 7 e posiciona os 2 boxes.
  - Os clientes da fila aparecem na rua (x = 0..5, y = 7) com tint aleatório estável por `customer.id`.
  - O carro do `ActiveJob` aparece sobre o box.
  - Câmera com arrastar para mover e pinça/roda para zoom entre 0.6 e 1.6.
  - O tamanho do canvas acompanha a janela.
- [ ] **Step 5:** Run `pnpm --filter @gt/client test` → PASS. Run `pnpm dev`: oficina visível em 1280×800 e em 390×844 (DevTools), sem scroll horizontal.
- [ ] **Step 6: Portão de revisão do dono.** Tirar um screenshot com Playwright (`apps/client/e2e/screenshot.ts`, gravando em `docs/screens/m0-garage.png`), commitar e **pedir aprovação do estilo dos 3 carros e da oficina** antes da Task 8. Ajustes pedidos entram aqui.
- [ ] **Step 7: Commit** — `feat(client): isometric garage scene and original car art`

---

### Task 8: Loop jogável — store, HUD, fluxo de serviço

**Files:**
- Create: `apps/client/src/state/store.ts`, `apps/client/test/store.test.ts`
- Create: `apps/client/src/ui/{hud.ts,jobMenu.ts,toast.ts,strings.ts}`
- Modify: `apps/client/src/main.ts`, `apps/client/src/scenes/GarageScene.ts`

**Interfaces:**
- Consumes: `startJob`, `collectJob`, `completeWithMinigame`, `tick`, `jobProgress`, `levelForXp`, `unlockedJobs`, `loadGame`/`saveGame`, eventos da `GarageScene`.
- Produces:
  ```ts
  class Store {
    constructor(c: Content, initial: GameState, clock: () => number, persist: (s: GameState) => void)
    get state(): GameState
    subscribe(fn: (s: GameState) => void): () => void
    tick(): void                                         // chamado a cada 1 s
    start(a: { customerId: string; bayId: string; jobKey: JobKey }): Result<GameState, StartError>
    collect(bayId: string): Result<Reward, CollectError>
    minigame(bayId: string, gestureMs: number): Result<Reward, MinigameError>
  }
  ```
  - Cada ação bem-sucedida chama `persist`, e o `tick` persiste a cada 5 s.
  - O client também persiste em `visibilitychange` (hidden) e em `pagehide`.

- [ ] **Step 1: Testes que falham** (`store.test.ts`, com relógio falso)
  - `start` seguido de `collect` antes do fim → erro `not_done` e `persist` não é chamado.
  - Avançar o relógio e chamar `collect` duas vezes seguidas → a primeira dá ok e a segunda dá `empty_bay` (Review Focus 4).
  - Os subscribers são notificados uma vez por ação.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar o `Store`.
- [ ] **Step 4:** UI em DOM:
  - **HUD** fixo no topo: 🪙, XP com barra até o próximo nível, nível e ⭐.
  - **Fluxo de serviço:**
    1. Tocar num cliente o seleciona (destaque e balão com a necessidade).
    2. Tocar num box livre abre o `jobMenu`. O menu lista os jobs desbloqueados do tipo do box, com duração, 🪙, XP e uma estrela "pedido do cliente" no que bate com a necessidade.
    3. Escolher um job chama `start`.
  - **Box ocupado:** mostra uma barra de progresso sobre o carro. Quando pronto, mostra o botão "Coletar" com pulso. Durante a janela de pontualidade aparece o selo "+10%".
  - **Botões:** desabilitados enquanto a ação processa, para evitar toque duplo.
  - **Toasts:** recompensa ("+7 🪙 +3 XP"), mensagens de erro amigáveis de `strings.ts` (ex.: `wrong_bay_type` → "Esse serviço precisa de outro box") e level-up. Um único toast mostra o nível final mesmo que vários níveis tenham sido pulados.
  - **Nível 5:** banner de fim do protótipo.
  - **Alvos de toque:** ≥ 44 px.
- [ ] **Step 5:** Run `pnpm test` → PASS. No `pnpm dev`, jogar 3 lavagens e 1 óleo do começo ao fim, recarregar no meio de um job e verificar que ele continua.
- [ ] **Step 6: Commit** — `feat(client): playable job loop with HUD, menus and autosave`

---

### Task 9: Minijogo de lavagem (UI)

**Files:**
- Create: `apps/client/src/minigames/scrub.ts`, `apps/client/test/scrub.test.ts`
- Modify: `apps/client/src/ui/jobMenu.ts` (botão "Fazer na mão ✋" no box ocupado, quando `isMinigameEligible`)

**Interfaces:**
- Consumes: `Store.minigame`, `isMinigameEligible`, `MINIGAME_MIN_GESTURE_MS`.
- Produces:
  ```ts
  function createScrubTracker(targetPx: number): {
    add(dxPx: number, dyPx: number, tMs: number): void
    progress(): number                    // 0..1 = distância acumulada / targetPx
    elapsedMs(): number                   // do primeiro ao último movimento
  }
  function openScrubMinigame(root: HTMLElement, carSprite: string, onDone: (gestureMs: number) => void, onCancel: () => void): void
  ```

- [ ] **Step 1: Testes que falham** (`scrub.test.ts`)
  - `targetPx 3000`. Movimentos de 100 px a cada 100 ms por 3 s → `progress 1`, `elapsedMs 2_900`.
  - Movimentos acima de 400 px num único evento são truncados em 400, para que um único arraste longo não complete o minijogo.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar o tracker e a sobreposição.
  - **Tela:** carro grande coberto por camadas de "sujeira" (canvas 2D) que somem conforme o progresso, com contador circular de progresso.
  - **Input:** pointer events, funcionando com toque e mouse.
  - **Conclusão:**
    1. Ao chegar a 100%, se `elapsedMs < 5_000`, mostra "Capricha mais um pouco…" e segura até completar 5 s. Depois chama `onDone(elapsedMs)`.
    2. Em seguida chama `Store.minigame`. Em caso de `rate_limited`, mostra o toast "Seus braços cansaram — tente mais tarde".
  - **Saída:** botão "Deixar no automático" chama `onCancel` e o job segue normal.
- [ ] **Step 4:** Run → PASS. No `pnpm dev`, a lavagem pelo minijogo dá 7 🪙, tanto com mouse quanto com toque emulado.
- [ ] **Step 5: Commit** — `feat(client): scrub minigame for wash bay jobs`

---

### Task 10: Testes E2E + build de produção

**Files:**
- Create: `apps/client/playwright.config.ts`, `apps/client/e2e/{first-job.spec.ts,persistence.spec.ts,minigame.spec.ts,corrupt-save.spec.ts}`
- Modify: `apps/client/src/main.ts` (expor `window.__gt = { store, clock }` **somente** quando `import.meta.env.MODE === 'test'`, com o relógio controlável)
- Modify: `.github/workflows/ci.yml` (job `e2e`: `pnpm build --mode test && pnpm e2e`)

**Interfaces:**
- Consumes: tudo das Tasks 6–9.
- Os testes usam `window.__gt.clock.advance(ms)` para não esperar tempo real.
- O `playwright.config.ts` roda os projetos `desktop` (1280×800) e `mobile` (390×844, `hasTouch`). Quando a variável `PW_CHROMIUM_PATH` existir, usa `launchOptions.executablePath` com ela (no ambiente cloud, `/opt/pw-browsers/chromium`).

- [ ] **Step 1: Escrever os testes**
  - `first-job`:
    1. Avança 20 s e verifica que um cliente aparece.
    2. Toca no cliente e no box de lavagem, escolhe "Lavagem" e avança 30 s.
    3. "Coletar" → HUD mostra 🪙 > 0 e XP 3.
  - `persistence`: inicia `oil`, recarrega a página, avança 120 s e verifica que "Coletar" está visível (Review Focus 3).
  - `minigame`: inicia lavagem, "Fazer na mão", arrasta em zigue-zague por 5,5 s e verifica que o HUD mostra 7 🪙.
  - `corrupt-save`: grava `localStorage['gt.save']='{oops'`, recarrega e verifica que o jogo abre com 0 🪙 e que `gt.save.bak === '{oops'` (Review Focus 1).
  - Em todos os specs: zero erros no console (`page.on('pageerror')` falha o teste).
- [ ] **Step 2:** Run `pnpm build --mode test && pnpm e2e` → PASS nos 2 projetos.
- [ ] **Step 3:** Verificar o orçamento.
  - Run `pnpm build` e conferir que o total de `dist/assets` está abaixo de 3 MB. Adicionar a checagem `tools/check-bundle-size.mjs` ao CI, que falha se passar de 3 MB.
  - No DevTools com CPU 4× mais lenta, o perfil deve ficar em ~60 fps com 6 clientes e 2 jobs ativos.
- [ ] **Step 4: Commit** — `test: e2e flows for job loop, persistence, minigame and corrupt save`

---

### Task 11: Publicar para playtest (com ajuda do dono)

**Files:**
- Create: `docs/playtest-m0.md` (roteiro de playtest: o que observar e 5 perguntas pós-sessão)
- Modify: `README.md` (link do preview)

- [ ] **Step 1: Ação do dono.** Criar o projeto no Cloudflare Pages conectado a `wasdtech/garagetown`, com comando de build `pnpm i && pnpm build`, pasta `apps/client/dist` e Node 22. Os previews por branch saem automaticamente, sem tokens no repositório.
- [ ] **Step 2:** Abrir o preview no celular do dono e jogar 10 min. O critério de saída do M0 é o dono responder "o loop curto é divertido?", seguindo o roteiro de `docs/playtest-m0.md`.
- [ ] **Step 3: Commit** — `docs: M0 playtest guide and preview link`
