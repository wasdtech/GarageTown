# Garage Town: Arrancada (design)

- **Data:** 2026-11-04
- **Status:** aguardando revisão do dono
- **Base:**
  - spec principal `2026-11-01-garage-town-design.md` §7 (controles, peso dos atributos, corrida refeita a partir das entradas);
  - revisão `docs/reviews/2026-11-01-qa-game-design-review.md`, que pede sentido para Potência e Aderência.

## Intenção
- As peças e a classe do carro passam a valer na pista: **Potência** acelera mais e dá mais velocidade final; **Aderência** alarga a faixa verde da troca de marcha e reduz a patinada na largada.
- O minigame que o dono pediu desde o início: apertar no momento certo para o carro acelerar mais que o rival.
- **Duas formas de jogar, ambas escolhidas pelo dono:**
  - a **Liga**, com pistas em sequência e medalhas;
  - os **Rachas**, apostas repetíveis com limite diário.
- O online fica para o fim do roadmap. Por enquanto os adversários são pilotos do jogo, mas a corrida é uma função pura das entradas, para o servidor poder refazê-la depois.

**Sucesso:**
- Um jogador médio com o carro certo ganha Bronze na pista da vez.
- O Ouro exige peças boas **e** uma corrida bem feita.
- A habilidade do jogador vale cerca de 40% do resultado: com o mesmo carro, uma corrida perfeita é bem mais rápida que uma ruim, mas não compensa um carro muito mais fraco.

## A. Regras da corrida (`packages/sim/src/race.ts`, puro e determinístico)

### A1. Entrada e saída
- **Entrada:**
  - a semente da corrida;
  - Potência e Aderência do carro;
  - a lista de toques do jogador `{ kind: 'release' | 'shift' | 'nitro', t: ms }`. O tempo `t` é contado a partir do início da contagem do semáforo.
- **Saída:**
  - `timeMs`, o tempo oficial;
  - `reactionMs`;
  - `falseStart`;
  - a nota de cada troca (`perfect` | `good` | `bad`);
  - a posição ao longo do tempo, amostrada a cada 50 ms, para a cena animar.
- A mesma entrada dá sempre a mesma saída. A integração é feita em passos fixos de 10 ms.

### A2. Largada
- O semáforo acende vermelho, vermelho e verde. O verde chega num instante entre 1.500 e 3.000 ms, sorteado pela semente.
- **Largada queimada:** um `release` antes do verde. O carro sai no verde, e o tempo ganha **+1.000 ms** de punição.
- **Reação:** `release − verde`, quando o toque vem depois do verde. Sem `release`, o carro sai 2.000 ms depois do verde.
- **Tempo oficial:** do verde até cruzar os **400 m**, mais o tempo de reação e a punição.
- **Patinada:** nos primeiros 500 ms depois da saída, a aceleração é multiplicada por `0,7 + Aderência/400`, com teto de 1.

### A3. Motor e marchas
- **Velocidade máxima:** `vmax = 45 + 0,25 × Potência` (m/s).
- **4 marchas:**
  - limite de velocidade em cada uma: `vmax × [0,35; 0,60; 0,82; 1,00]`;
  - aceleração base: `[9,0; 6,0; 4,0; 2,6] m/s² × (0,6 + Potência/100)`.
- **Conta-giros:** `rpm = 1.000 + 7.000 × (v / limite da marcha)`. No limitador (8.000 rpm) o carro não acelera até a troca.

### A4. Troca de marcha
- A **faixa verde** é centrada em 7.000 rpm, com largura total `600 + 6 × Aderência` rpm.
- **Notas** da troca, pelo rpm no instante do toque:
  - **perfeita:** até 30% da meia-largura a partir do centro;
  - **boa:** dentro da faixa;
  - **ruim:** fora da faixa.
- **Efeito de cada nota:**
  - perfeita: a troca leva 100 ms e dá **+15% de aceleração por 500 ms**;
  - boa: a troca leva 250 ms;
  - ruim: a troca leva 600 ms.
  
  Durante a troca o carro não acelera.
- **Toques fora de hora:** um `shift` na 4ª marcha é ignorado; um `shift` antes da saída também é ignorado.

### A5. Nitro
- Um uso por corrida: **+40% de aceleração por 2.000 ms**.
- Funciona depois da saída, inclusive durante uma troca (só acumula quando o carro volta a acelerar). Toques repetidos são ignorados.

### A6. Pilotos do jogo
- Cada rival tem Potência, Aderência e **habilidade** de 0 a 1. A partir da semente, as entradas dele são geradas assim:
  - **reação:** `350 − 250 × habilidade` ms;
  - **troca:** no rpm `7.000 + erro`, com erro sorteado em ±`(1 − habilidade) × meia-largura × 1,6`;
  - **nitro:** no início da 3ª marcha.
- O rival roda na **mesma simulação** do jogador.

## B. Liga e Rachas

### B1. Conteúdo (`content/race.json`)
- **5 pistas:** `bairro` (Rua do Bairro), `avenida` (Avenida), `porto` (Porto), `autodromo` (Autódromo) e `final` (Grande Final).
- **Cada pista tem:**
  - nome;
  - rival `{ name, car, power, grip, skill }`;
  - metas `{ bronze, silver, gold }` em ms;
  - recompensas por medalha `{ coins, xp }`;
  - PI recomendado, mostrado no cartão.
- **Pontos de partida da calibragem** (o plano ajusta os números com o simulador, sem mudar a forma):

| pista | PI recomendado | rival (pot/ader/hab) | 🥉/🥈/🥇 moedas | XP por medalha |
|---|---|---|---|---|
| bairro | 180 | 40/45/0,3 | 100/200/400 | 20 |
| avenida | 230 | 65/50/0,45 | 250/500/1.000 | 40 |
| porto | 280 | 80/70/0,55 | 600/1.200/2.400 | 80 |
| autodromo | 340 | 110/90/0,7 | 1.500/3.000/6.000 | 150 |
| final | 420 | 145/115/0,85 | 4.000/8.000/16.000 | 300 |

- **Metas de tempo:** são derivadas para que:
  - um **jogador médio** (reação 300 ms, todas as trocas boas, nitro no início da 3ª) com um carro de PI recomendado faça Bronze;
  - um **jogador ótimo** (reação 150 ms, trocas perfeitas) com o mesmo carro faça Prata;
  - o Ouro exija o jogador ótimo com um carro cerca de 15% acima do PI recomendado.

### B2. Liga
- **Desbloqueio:** a primeira pista está aberta. As seguintes abrem quando o jogador **vence o rival** da anterior, ou seja, chega antes dele na mesma corrida.
- **Recompensas:** a primeira vez que o jogador alcança cada medalha, recebe as recompensas dela e das medalhas abaixo que ainda não tinha. Correr de novo uma pista sem medalha nova não paga nada.
- **Carro:** a corrida usa o carro em exposição na vitrine. Os atributos dele vêm de `carStats`, que já existe.

### B3. Rachas
- **Abertura:** depois de vencer o rival do `bairro`.
- **Aposta:** pequena, média ou grande, valendo `[50, 150, 400] × (1 + nível/5)`, arredondado para baixo. A aposta é descontada na largada.
- **Rival:** um piloto sorteado pela semente, com PI entre 90% e 110% do PI do carro do jogador e habilidade entre 0,4 e 0,8.
- **Resultado:** vitória paga **2× a aposta**; empate devolve a aposta; derrota não paga.
- **Limite:** **5 rachas a cada 24 h corridas** (janela móvel, como o minijogo).

### B4. Estado e save
- `GameState` passa para a versão **6** e ganha:
  ```ts
  race: { medals: Record<string, 0|1|2|3>; beaten: string[]; rachas: number[]; count: number }
  ```
  - `count` conta as corridas feitas e gera a semente de cada corrida (junto com `rngState`). Assim a semente não muda enquanto o jogador corre.
  - A migração v5 → v6 começa com `{ medals: {}, beaten: [], rachas: [], count: 0 }`.
  - A validação do save descarta pistas desconhecidas e marca como corrupto um nível de medalha fora de 0–3.
- **Ações:**
  - `raceSetup(c, s, track | 'racha')` devolve a semente, o instante do verde, o rival e as entradas do rival.
  - `finishTrack(c, s, trackKey, inputs, now)` devolve o resultado do jogador e do rival, a medalha e as recompensas.
  - `racha(c, s, stake, inputs, now)` desconta a aposta, corre e paga.
  - Todas fazem `tick` antes e `touch` depois, e somam `count`.
- As moedas da Arrancada entram em `runCoins`, então contam para os selos da Franquia.
- **Erros:** `locked`, `unknown_track`, `no_coins`, `rate_limited`.

## C. Interface

### C1. Menu 🏁 Arrancada
- **Botão:** um 5º botão na barra de baixo, com ícone desenhado. Ele abre o painel da Arrancada, no mesmo estilo dos outros menus, com faixa de cor própria.
- **Cartões de pista:**
  - nome;
  - foto do rival (o carro dele em miniatura) com o nome;
  - PI recomendado contra o PI do seu carro;
  - as três medalhas, acesas ou apagadas;
  - botão **Correr**.
  
  A pista travada aparece com cadeado e "Vença o rival anterior".
- **Cartão de Rachas:** três botões de aposta (com o valor e a moeda desenhada) e "N de 5 hoje". Travado até vencer o `bairro`.

### C2. Corrida (`RaceScene`, Phaser, por cima da oficina)
- **Cenário:**
  - pista isométrica em diagonal com duas faixas;
  - os carros (o seu na sua pintura, o rival na cor dele) com a sombra;
  - linha de chegada;
  - placas e arquibancada simples ao lado;
  - a câmera acompanha o carro que estiver na frente.
- **HUD (DOM):**
  - o semáforo;
  - um **conta-giros** grande com a faixa verde e a faixa perfeita marcadas;
  - a marcha atual;
  - o botão grande **"Segure / Troque"**: segurar antes do verde e soltar no verde; depois, tocar para trocar;
  - o botão **Nitro**.
  
  Teclado: Espaço para o botão grande e N para o nitro.
- **Avisos:** a cada troca aparece "Perfeita!", "Boa" ou "Ruim". Na largada queimada aparece "Queimou! +1 s".
- **Animação:** a cena anima a partir do resultado da simulação. O cliente roda a simulação em tempo real, passo a passo, com os toques do jogador, e no fim chama a ação, que recalcula tudo a partir dos mesmos toques.
- **Tela final:**
  - seu tempo contra o do rival;
  - a medalha conquistada, com animação e confete;
  - as recompensas;
  - os botões **Correr de novo** e **Voltar à oficina**.
- **Som:** motor subindo de rotação (sintetizado como os outros sons), bipes do semáforo, "whoosh" do nitro e uma fanfarra na medalha.

### C3. Arte (SpriteCook, cerca de 8 imagens, uns 100 créditos)
- Ícone 🏁 do menu.
- Medalhas de bronze, prata e ouro.
- Semáforo.
- Pórtico de chegada.
- Placa ou arquibancada lateral.
- Faixa de asfalto da pista, se a de rua atual não servir.

## D. Fora de escopo
- Fantasmas de amigos e ranking (vêm com o online).
- Tuning de câmbio.
- Pistas com curva.
- Clima.

## E. Testes
- **Simulação (sim, unitários):**
  - mesmas entradas dão sempre o mesmo resultado;
  - largada queimada soma 1.000 ms;
  - sem toque de saída, o carro sai 2.000 ms depois do verde;
  - as notas da troca dependem do rpm e da faixa, e mais Aderência alarga a faixa;
  - mais Potência, com as mesmas entradas, termina mais rápido;
  - trocas perfeitas são mais rápidas que boas, e boas mais rápidas que ruins;
  - o nitro só vale uma vez;
  - o limitador segura o carro sem troca.
- **Calibragem:**
  - o jogador médio com PI recomendado faz Bronze em cada pista;
  - o jogador ótimo faz Prata;
  - o Ouro exige carro cerca de 15% acima;
  - a habilidade separa cerca de 40%: entre o pior e o melhor jogador no mesmo carro, a diferença é parecida com a de carros de PI 30% diferentes.
- **Liga e Rachas:**
  - desbloqueio por vitória;
  - recompensa de medalha paga uma única vez;
  - aposta descontada; vitória paga 2×; empate devolve;
  - limite de 5 em 24 h;
  - `runCoins` soma os prêmios;
  - migração v5 → v6 e rejeição de save inválido.
- **E2E (desktop e celular):**
  - abrir 🏁, correr a primeira pista com toques programados e ver o resultado e a medalha;
  - pista seguinte trava antes da vitória;
  - racha descontado e pago.
