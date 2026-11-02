# Garage Town: Ajudantes, idle híbrido, áudio e animações (design)

- **Data:** 2026-11-02
- **Status:** aguardando revisão do dono
- **Base:** spec principal `2026-11-01-garage-town-design.md` (§7.5–7.6) e revisão `docs/reviews/2026-11-01-qa-game-design-review.md`

## Intenção
O jogo deixa de ser só social e ativo e ganha um lado **idle híbrido**:
- Ajudantes NPC trabalham por você, inclusive com o jogo fechado, até um teto de horas.
- Jogar ativamente continua rendendo mais (gorjeta, pontualidade, minijogo, VIP).
- O jogo ganha **mais áudio** e **animações de vida** nos carros.

**Sucesso:**
- O jogador que só volta 2–3 vezes por dia sente progresso.
- O jogador ativo continua sendo recompensado.
- A faixa da economia (nível 10 entre os dias 2 e 4 para o perfil médio) continua valendo.

## A. Ajudantes e idle híbrido

### A1. Ajudantes
Conteúdo em `content/helpers.json`:

| key | nome | nível para contratar | preço |
|---|---|---|---|
| `ze` | Zé da Chave | 2 | 300 🪙 |
| `bia` | Bia Faísca | 4 | 1.500 🪙 |
| `tiao` | Tião Turbo | 7 | 4.000 🪙 |
| `neusa` | Neusa Polimento | 10 | 10.000 🪙 |

- Cada ajudante pode ser **designado a 1 box** (ou ficar sem box). Cada box tem no máximo 1 ajudante.
- **Treino:** 5 níveis por ajudante. Por nível:
  - **velocidade:** a duração do serviço é multiplicada por 1,00 · 0,93 · 0,86 · 0,79 · 0,72;
  - **repasse:** o jogador recebe 80% · 84% · 88% · 92% · 95% das moedas;
  - **custo do treino** para chegar aos níveis 2 a 5: 2× · 4× · 8× · 16× o preço de contratação.
- **Trabalho automático de um box com ajudante:**
  1. Box livre: pega da fila o cliente mais antigo cuja necessidade é do tipo do box e inicia esse serviço, com a duração reduzida.
  2. Serviço concluído: coleta automaticamente no instante em que termina.
     - Paga as moedas × repasse, **sem gorjeta e sem bônus de pontualidade**.
     - Dá **XP cheio** e **0 de reputação**.
     - Se o cliente era VIP, mantém o 2× do VIP.
  3. Volta ao passo 1.
- O jogador pode tocar num box com ajudante e fazer o serviço ele mesmo (inclusive pelo minijogo). Nesse caso a recompensa é a manual.

### A2. Idle offline (o "turno")
- O estado ganha `lastActiveAt`, atualizado por qualquer ação do jogador (start, collect, build, compra, minijogo).
- Os ajudantes trabalham até `lastActiveAt + turno`:
  - turno de **4 h** de base;
  - o upgrade **Relógio de ponto** (loja da garagem) passa para 6 h (3.000 🪙) e depois para 8 h (12.000 🪙).
- Depois do turno, a oficina "fecha": os ajudantes param, e os serviços já iniciados terminam e esperam a coleta (comportamento atual).
- **Simulação:** o `tick` reproduz eventos em ordem (chegada de cliente, fim de serviço com ajudante) entre `lastTickAt` e `min(now, fim do turno)`.
  - É pura e determinística.
  - Tem limite de segurança de 10.000 eventos.
  - O tempo depois do turno usa a lógica O(1) atual da fila.
- **Contador:** `idleReport` acumula `{ jobs, coins, xp }` feitos pelos ajudantes desde a última vez que o jogador viu o relatório.

### A3. Tela de boas-vindas
Ao abrir o jogo, se `idleReport.jobs > 0`, aparece:

> "Enquanto você estava fora (3h12): **47 carros**, **+1.880 🪙**, **+410 XP**"

O botão **Coletar** zera o relatório e mostra as moedas voando, o confete e a fanfarra. As moedas já foram somadas; o botão é só a celebração.

### A4. Interface
- Na tela da garagem, uma aba nova **"Equipe"**:
  - contratar;
  - treinar (com velocidade e repasse);
  - designar a um box (lista de boxes livres);
  - Relógio de ponto.
- **No cenário:** um crachá com o rosto (emoji) e o nome do ajudante sobre o box. O balão do box mostra "auto".

### A5. Save v4
- Novos campos: `helpers: { key, level, bayId | null }[]`, `clockTier: 0..2`, `lastActiveAt` e `idleReport`.
- Migração do save v3 com valores vazios.

### A6. Economia
- O simulador ganha:
  - ajudantes (contrata assim que pode, designa nos boxes livres e treina com sobra);
  - perfis com tempo offline.
- **Testes:**
  - o perfil médio chega ao nível 10 entre os dias 2 e 4;
  - um dia "só offline" (2 visitas rápidas) rende menos moedas que um dia do perfil médio;
  - 8 h de offline simulam em menos de 50 ms.

## B. Mais áudio
- **Efeitos novos:**
  - cliente chegando (buzina curta);
  - carro indo embora (motor);
  - erro;
  - abrir menu;
  - compra (caixa registradora);
  - ajudante contratado;
  - loop de esfregar no minijogo;
  - fanfarra de "bem-vindo de volta".
- **Música de fundo** em loop leve, com botão próprio (🎵), separado dos efeitos (🔊). As duas preferências ficam salvas.
- **Fontes, em ordem de preferência:**
  1. SoundWeaver (WAV reais), se instalado;
  2. CellCog para a música, se reautorizado;
  3. senão, síntese Web Audio (efeitos já existentes e um loop simples gerado por código).
- **Regras:** o áudio só começa depois de uma interação do usuário (regra dos navegadores) e nunca quebra o jogo se o áudio falhar.

## C. Animações de vida
- **Fila:**
  - leve balanço contínuo ("marcha lenta"), com fase diferente por carro;
  - fumaça do escapamento a cada 3–6 s;
  - **paciência abaixo de 30%:** tremida a cada 2 s, 💢 no balão e buzina (no máximo uma por cliente).
- **Em serviço, por tipo de box:**
  - Lavagem: gotas e bolhas.
  - Mecânica: carro +6 px (elevador), faíscas e "clank".
  - Pintura: névoa colorida.
  - Performance: vibração e chama no escapamento.
- **Restrições:**
  - no máximo ~30 partículas ativas;
  - os efeitos param fora da tela da câmera;
  - nada é animado com `prefers-reduced-motion`.
- **Comparação:** a função pura `ambientFor(state, now)` diz qual efeito cada carro deve ter (ex.: `{ id, kind: 'idle' | 'impatient' | 'service:wash' … }`) e é testada.

## Fora do escopo
- prestígio ou recomeço;
- ajudantes de amigos (online);
- ajudantes andando pela oficina;
- arte nova de ajudantes (eles usam emoji até haver créditos de arte).

## Testes
- **Unitários (sim):**
  - contratar, treinar e designar;
  - automação do box (escolha de cliente, duração reduzida, coleta, repasse sem gorjeta);
  - turno e fechamento;
  - relatório;
  - migração v3 → v4;
  - determinismo;
  - desempenho de 8 h.
- **Unitários (cliente):** `ambientFor`, preferências de áudio e música.
- **E2E:**
  - contratar e designar um ajudante, avançar o relógio e ver o box trabalhando sozinho;
  - recarregar depois de horas e ver a tela de boas-vindas;
  - alternar música e efeitos.
