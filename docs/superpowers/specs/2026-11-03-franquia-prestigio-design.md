# Garage Town: Franquia (prestígio) (design)

- **Data:** 2026-11-03
- **Status:** aguardando revisão do dono
- **Base:**
  - spec principal `2026-11-01-garage-town-design.md`;
  - spec dos ajudantes `2026-11-02-ajudantes-idle-audio-design.md`;
  - relatório de economia de 2026-11-03.

## Intenção
Hoje o conteúdo acaba cedo.

| Perfil | Chega ao nível 15 (máximo) | Situação no dia 30 |
|---|---|---|
| Médio, com ajudantes | dia 5,8 | todas as peças compradas, 32 mil 🪙 sem uso |
| Médio, sem ajudantes | dia 10 | — |
| Intenso | dia 2,9 | 120 mil 🪙 sem uso |

O dono escolheu **progressão sem fim**, no estilo idle: o jogador **abre uma nova filial**. Isso recomeça a oficina em troca de **Selos de Franquia**, que compram **melhorias permanentes**.

**Sucesso:**
- Sempre há um próximo objetivo. Em 30 dias, o jogador médio ainda tem melhorias para comprar.
- As moedas voltam a ter valor depois da coleção completa, porque viram selos.
- A primeira filial não muda: o jogador médio chega ao nível 10 entre os dias 2 e 4.
- Cada nova filial chega ao nível 12 mais rápido que a anterior.

**Decisões do dono:**
- Progressão sem fim (prestígio).
- Ao abrir uma filial, mantém **só os carros**.
- O bônus funciona como **selos + loja de melhorias**.

## A. Regras

### A1. Abrir uma nova filial
- **Requisito:** nível ≥ **12** (`minLevel`).
  - Abaixo disso a ação falha com o erro `level`.
  - Também falha com `no_seals` se a filial renderia 0 selos.
- **Selos ganhos:** `floor(sqrt(runCoins / 500))`.
  - `runCoins` é o total de moedas **ganhas** nesta filial. Gastos não descontam.
  - Entra tudo: serviços do jogador, dos ajudantes, minijogo e gorjetas.
  - Exemplos: 12.500 🪙 rendem 5 selos; 50.000 🪙 rendem 10; 200.000 🪙 rendem 20.
- **Mantém:**
  - a coleção de carros (`collection`: carros, peças, visual, carro ativo, tintas, acabamentos, adesivos, neon);
  - os selos;
  - as melhorias compradas;
  - o contador de filiais;
  - `rngState` e `nextId`, que continuam de onde estavam.
- **Recomeça** como num jogo novo (`createInitialState`):
  - moedas, XP e nível;
  - reputação;
  - boxes, que voltam aos 2 pré-construídos e livres;
  - obras;
  - fila e próximo cliente;
  - usos do minijogo;
  - ajudantes, que saem todos;
  - relógio de turno (nível 0);
  - `idleReport`;
  - `runCoins = 0`.
- **Contador:** `branch` (a filial atual, começando em 1) aumenta em 1.
- `lastActiveAt` e `lastTickAt` passam a ser `now`.

### A2. Melhorias (loja de selos)
O conteúdo fica em `content/prestige.json`. Cada melhoria tem nível de 0 até `max`. O custo para subir ao nível `n` é `baseCost + step × (n − 1)` selos.

| key | nome | efeito por nível | máx. | baseCost | step |
|---|---|---|---|---|---|
| `lucro` | Lucro | +10% moedas por serviço | 10 | 2 | 1 |
| `agilidade` | Agilidade | duração dos serviços × (1 − 0,05) | 6 | 3 | 2 |
| `paciencia` | Paciência | paciência dos clientes +15% | 5 | 2 | 1 |
| `experiencia` | Experiência | +10% XP por serviço | 10 | 2 | 1 |
| `recrutamento` | Recrutamento | contratar e treinar ajudantes −15% | 4 | 3 | 2 |

**Aplicação dos efeitos:**
- **Lucro:**
  - multiplica as moedas do serviço do jogador (`computeReward`), do ajudante (`helperReward`) e do minijogo;
  - não multiplica gorjeta nem bônus de pontualidade;
  - fórmula: `floor(base × (1 + 0,10 × nível))`, aplicada depois do 2× do VIP e do repasse do ajudante.
- **Experiência:** `floor(xp × (1 + 0,10 × nível))` no XP de todos os serviços.
- **Agilidade:**
  - a duração de cada serviço iniciado vira `round(durationS × (1 − 0,05 × nível))`, com mínimo de 1 s;
  - vale para o jogador e para o ajudante, e acumula com a velocidade do treino;
  - serviços já em andamento não mudam.
- **Paciência:** `patienceUntil = arrivedAt + PATIENCE × (1 + 0,15 × nível)`, para clientes que chegarem depois da compra. O VIP usa a própria base.
- **Recrutamento:** preço de contratar e custo de treinar viram `ceil(preço × (1 − 0,15 × nível))`.

**Compra:** `buyPerk(c, s, key, now)`. Falha com:
- `unknown_perk`;
- `maxed`;
- `no_seals`.

Pode ser feita a qualquer momento, não só ao abrir a filial.

### A3. Estado e save
- `GameState` passa para `version: 5` e ganha:
  ```ts
  prestige: { branch: number; seals: number; perks: Record<string, number>; runCoins: number }
  ```
- **Migração v4 → v5:** `{ branch: 1, seals: 0, perks: {}, runCoins: 0 }`. As moedas ganhas antes da migração não contam.
- **Validação do save:**
  - `branch ≥ 1`, `seals ≥ 0`, `runCoins ≥ 0`;
  - níveis das melhorias inteiros e entre 0 e `max`;
  - chaves de melhoria desconhecidas são descartadas.
- `applyReward` e o caminho dos ajudantes somam as moedas pagas em `runCoins`.
- Abrir filial e comprar melhoria chamam `tick` antes e `touch` depois, como as outras ações.

## B. Interface

### B1. Aba "🏢 Franquia" no painel da garagem
- **Topo:**
  - "Filial N" e "🏅 X selos";
  - a frase "Moedas ganhas nesta filial: Y 🪙".
- **Cartão "Abrir nova filial":**
  - **Prévia:** "Abrir agora: +N selos". Quando o próximo selo estiver perto: "faltam Z 🪙 para o próximo selo".
  - **Lista de perdas e ganhos:** "Você mantém seus carros. Recomeçam: moedas, nível, boxes e ajudantes."
  - **Botão "Abrir filial":**
    - travado abaixo do nível 12, com o texto "Disponível no nível 12";
    - travado com 0 selos de prévia, com o texto "Ganhe mais moedas nesta filial".
  - **Confirmação:** o botão abre uma segunda etapa, "Tem certeza? A oficina recomeça do zero", com **Abrir filial** e **Cancelar**.
  - **Depois de abrir:**
    - o painel fecha, com confete e o som `branch`;
    - aparece o toast "Filial N aberta! +X selos";
    - a cena redesenha a oficina zerada.
- **Melhorias:** um cartão por melhoria com:
  - nome;
  - efeito atual → efeito do próximo nível, por exemplo "+20% → +30% moedas";
  - nível "2/10";
  - botão "Comprar (3 🏅)", desabilitado sem selos e trocado por "Máximo" no máximo.
- **Test IDs:** `tab-franquia`, `open-branch`, `confirm-branch`, `cancel-branch`, `perk-<key>`, `seals`.

### B2. HUD
- A partir da filial 2, mostra um selo pequeno "🏢 2" junto do nível (test ID `branch`).
- Na filial 1 não mostra nada.

### B3. Tutorial e textos
- A Dona Cida não muda.
- Ao subir para o nível 12, aparece junto da comemoração um toast: "Você já pode abrir uma nova filial! Veja em Garagem → Franquia." Como o nível só sobe uma vez por filial, o aviso aparece uma vez por filial, sem precisar de estado extra.
- Todos os textos ficam em `strings.ts`, em português.

## C. Simulador e balanceamento
- **Simulador:** o jogador simulado abre filial ao chegar ao nível 15. Ele compra melhorias sempre que pode, na ordem lucro, agilidade, experiência, paciência e recrutamento, a mais barata primeiro.
- **Novos testes de economia:**
  1. **Primeira filial:** o perfil médio chega ao nível 10 entre os dias 2 e 4. É o teste atual, que continua passando.
  2. **Abertura:** o perfil médio abre a primeira filial até o dia 10.
  3. **Aceleração:** na segunda filial, o perfil médio chega ao nível 12 em menos tempo que na primeira.
  4. **Sem fim:** no dia 30, o perfil médio ainda tem pelo menos uma melhoria abaixo do máximo.
  5. **Moedas úteis:** depois da primeira filial, `runCoins` cresce e vira selos, e o jogador nunca fica sem objetivo de gasto.
- Se os números iniciais da tabela A2 não baterem essas faixas, o plano ajusta `divisor` (500), `baseCost` e `step` em `prestige.json`. A forma das regras não muda.

## D. Fora de escopo
- Visual diferente por filial, como outro mapa ou outra fachada.
- Ranking ou social de filiais.
- Melhorias que mudam regras novas, como mais boxes ou um quinto ajudante.
- A Arrancada, que é o próximo bloco.

## E. Testes
- **Sim, unitários:**
  - `openBranch`: o que mantém e o que zera; os erros `level` e `no_seals`; o contador `branch`; selos somados.
  - Fórmula dos selos: 499 rende 0; 500, 1; 12.500, 5.
  - `buyPerk`: custo por nível, `maxed`, `no_seals`.
  - Cada efeito: lucro (inclusive VIP e ajudante), experiência, agilidade (mínimo 1 s, acumula com treino), paciência e recrutamento.
  - `runCoins` soma moedas do jogador, do ajudante e do minijogo.
  - Migração v4 → v5 e rejeição de save inválido.
- **Cliente, unitários:**
  - Textos da prévia, com o próximo selo.
  - Estado do botão abaixo do nível 12 e com 0 selos.
- **E2E:**
  1. Save no nível 12 com moedas ganhas: abrir a aba, confirmar a abertura e ver o HUD "🏢 2", os selos e a oficina zerada com os carros mantidos.
  2. Comprar uma melhoria e ver o nível subir.
  3. Cancelar a confirmação não muda nada.
