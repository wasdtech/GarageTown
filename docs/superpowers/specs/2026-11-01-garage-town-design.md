# Garage Town — Design Spec

- **Data:** 2026-11-01
- **Status:** aguardando revisão
- **Nome:** "Garage Town" é **provisório**. Ele é muito próximo de "Car Town" (marca de terceiros), então o nome final deve passar por checagem de marca antes do beta público. O nome vive num único arquivo de configuração (`content/brand.json`).

---

## 0. Visão e escopo

### 0.1 Pitch
Jogo social web, em 2D isométrico, onde você comanda uma oficina: atende clientes, customiza e coleciona carros, restaura achados de celeiro e ajuda os amigos. Tudo em sessões curtas de 3–10 minutos.

### 0.2 Originalidade
O jogo é inspirado no **gênero** dos jogos sociais de garagem dos anos 2010, mas é uma obra **original**:
- nome, arte, NPCs e sistemas são próprios;
- os carros são **fictícios**, sem marcas reais nem designs reconhecíveis de fabricantes;
- não se copia nenhum asset, texto, UI ou nome de outro jogo.

### 0.3 Objetivo
Lançamento real, com a web primeiro e app via Capacitor depois.

### 0.4 Público
- Faixa de 25–35 anos, nostálgicos dos jogos sociais, fãs de carro e jogadores casuais.
- Brasil primeiro, com PT-BR e EN desde o M3.

### 0.5 Critérios de sucesso
- Jogável em celular e desktop.
- Retenção no beta fechado: D1 ≥ 35% e D7 ≥ 12%.
- Infraestrutura com custo abaixo de US$25/mês até alguns milhares de jogadores.
- 60 fps em celular médio.
- Bundle inicial abaixo de 3 MB.
- Primeira jogada em menos de 5 s em 4G.

### 0.6 Restrições
- Monetização **somente cosmética**, sem pay-to-win.
- Social **assíncrono**, sem tempo real no MVP.
- Desenvolvimento feito majoritariamente pelo Claude. O dono do projeto revisa estilo e nomes e testa em dispositivos.

### 0.7 Pilares (MDA)
| Camada | Conteúdo |
|---|---|
| Fantasia | "Minha oficina dos sonhos, cheia dos carros que eu montei." |
| Loop curto | Cliente chega → escolhe serviço → timer → coleta 🪙 e XP → compra peças ou boxes |
| Loop longo | Nível → desbloqueios → coleção, restaurações e decoração → exibir em concursos e rankings |
| Loop social | Ajudar amigo (os dois ganham) → contratar amigos → comboios → concurso semanal |
| Estéticas-alvo | Expressão (customização), Companhia (social), Submissão (relaxar) e Descoberta (achados) |

---

## 1. Arquitetura

### 1.1 Diagrama
```
Cliente: Phaser 3 + TypeScript + Vite (web; Capacitor depois)
  ├─ scenes/   Boot → Garagem (iso) → Visita → Concurso → Loja
  ├─ ui/       DOM/CSS sobre o canvas
  ├─ sim/      (de packages/sim) regras puras: timers, preços, XP, replay
  └─ net/      cliente Supabase; o cliente só PEDE, o servidor DECIDE
        │ HTTPS (JWT) + Realtime (notificações)
Supabase
  ├─ Auth: anônimo (convidado) → vincular e-mail mágico ou Google no nível 3
  ├─ Postgres + RLS: sem UPDATE direto em moedas, gemas ou XP
  ├─ Edge Functions (TS): start_job, collect_job, buy, place_object,
  │     help_friend, hire, open_trip, join_trip, enter_contest, vote,
  │     stripe_webhook
  ├─ Cron: fechar concursos, expirar comboios e contratações, girar a loja diária
  └─ Storage + CDN: atlas de sprites
Stripe (web) → webhook → credita gemas
PostHog (telemetria e funis) · Sentry (erros)
```

### 1.2 Princípios
1. **O servidor é a autoridade.**
   - O servidor grava `started_at`.
   - `collect_job` só paga quando `now() >= started_at + duration`.
   - O cliente mostra o timer de forma otimista e corrige se o servidor recusar.
2. **Regras puras compartilhadas.** `packages/sim` não tem I/O nem depende de relógio implícito (o tempo é sempre parâmetro). O mesmo código roda no cliente e nas Edge Functions.
3. **Conteúdo como dados.** O conteúdo vive em `content/*.json`, validado por schema (zod) no CI: `cars`, `parts`, `jobs`, `levels`, `objects`, `trips`, `contests` e `shop`.
4. **Idempotência.** Toda função de mutação aceita `request_id`, o que torna os retries seguros.
5. **Auditoria.** Toda mudança de 🪙, 💎 ou XP gera uma linha em `ledger`, com motivo e referência.

### 1.3 Monorepo
```
apps/client/            Phaser + UI
packages/sim/           regras puras + testes (Vitest)
packages/shared/        tipos, schemas zod do conteúdo e da API
supabase/migrations/    SQL + RLS
supabase/functions/     Edge Functions
content/                JSON do conteúdo
art/src/                SVG fonte → art/build (atlas PNG via script)
tools/                  simulador de economia, build de atlas
```

### 1.4 Modelo de dados (inicial)

**Tabelas:**
- `players`: id, nome, nível, xp, coins, gems, reputação, created_at
- `garages`: player_id, tamanho, layout json
- `objects`: id, player_id, tipo, x, y, rot
- `bays`: id, player_id, tipo, object_id, hired_friend_id?
- `customers`: id, player_id, car_template, need, patience_until
- `jobs`: id, bay_id, job_key, customer_id, started_at, duration_s, status
- `cars`: id, player_id, base_key, paint, parts json, condition, stage
- `inventory`: player_id, item_key, qty
- `ledger`: id, player_id, delta_coins, delta_gems, delta_xp, reason, ref, at
- `friendships`: a, b, status
- `helps`: helper, owner, slot, day
- `hires`: owner, friend, bay_id, until
- `trips`: id, owner, dest, duration, slots, opens_until, ends_at
- `trip_members`: trip_id, player_id, car_id
- `contests`: id, tema, starts, ends
- `contest_entries`: contest_id, car_id, elo
- `votes`: voter, contest_id, a, b, winner, day
- `purchases`: id, player_id, stripe_pi, gems, status

**Regra fixa:** RLS em todas as tabelas, e saldos só mudam via Edge Functions (`service_role`).

---

## 2. Sistemas de jogo

### 2.1 Clientes e serviços
- **Fila de clientes:** no máximo 6 carros NPC na rua.
  - O ritmo de chegada é dado por `base × f(nível) × g(reputação)`.
  - Cada cliente tem uma **necessidade** e uma **paciência**. Quando a paciência acaba, ele vai embora sem penalidade além da perda do bônus de reputação.
- **Boxes:**
  - Começa com 2 e o máximo é 8.
  - Os boxes 1–4 são comprados com 🪙. Os boxes 5–8 exigem um mecânico contratado (§3.3).
  - Tipos de box: **Lavagem, Mecânica, Pintura e Performance**. Cada serviço exige o tipo certo de box.
- **Serviços:** `content/jobs.json`. Durações de referência: lavagem 30 s · óleo 2 min · pneus 5 min · pintura 15 min · motor 1 h · turbo 4 h · etapa de restauração 8 h.
  - Os serviços curtos rendem mais XP por minuto e os longos rendem mais 🪙 por sessão.
- **Minijogo opcional** (serviços ≤ 5 min):
  - Um gesto de 5–10 s (esfregar, apertar porcas no ritmo) conclui o serviço na hora com +25%.
  - Ignorar o minijogo nunca penaliza.
  - **Antitrapaça:** o servidor aceita o "concluir agora" apenas para serviços elegíveis, no máximo 20 vezes por hora, e com duração mínima do gesto validada pelo replay de entradas.
- **Coleta no tempo certo:** coletar até 5 min depois do fim dá +10%. Depois disso, sem penalidade.
- **Gorjeta e reputação:**
  - Atender a necessidade do cliente dá gorjeta e ⭐.
  - A reputação aumenta a chegada de clientes e desbloqueia clientes **VIP**, que trazem carros raros e achados de celeiro.

### 2.2 Carros e customização
- **Base de carros:**
  - ~15 carros-base fictícios no lançamento (ex.: *Pitoco*, *Brutus V8*, *Corisco RS*). Nomes e formas não podem ser modelos reais com nome trocado.
  - Classes: Popular, Clássico, Esportivo, Muscle e Exótico.
  - Raridades: Comum, Incomum, Raro e Lendário.
- **Visual por camadas:**
  - Carroceria (cinza → tint de pintura), vidro, rodas, kit, aerofólio, adesivos e neon.
  - 4 direções isométricas.
  - ~30 peças no lançamento.
- **Atributos:**
  - Potência e Aderência são usados na arrancada (v1.1).
  - Estilo é usado nos concursos.
  - Condição vai de 0 a 100 e é usada nas restaurações.
- **Achados de celeiro:**
  - Origem: eventos, VIPs ou presentes de amigos.
  - Restauração em etapas, cada uma um serviço longo: funilaria → motor → interior → pintura.
  - Ao terminar, o carro entra na coleção com selo "Restaurado" e histórico.
- **Vitrine:** área pessoal separada da oficina, para expor a coleção. É o que os amigos veem ao visitar.

### 2.3 Progressão e economia
- **🪙 Moedas** são ganhas jogando e usadas para tudo que tem efeito no jogo.
- **💎 Gemas** são premium, mas também podem ser ganhas jogando. Elas compram **apenas cosméticos** e aceleram no máximo **3 serviços por dia**.
- **Níveis 1–50.** A curva é rápida até o nível 10 (~2 dias de jogo) e mais lenta depois. Todo nível desbloqueia algo concreto.
- **Formas de retirar 🪙 da economia:** expansões de terreno (custo crescente), peças, decoração, restaurações e taxa de concurso.
- **Missões:** 3 diárias e semanais, além de objetivos de coleção.
- **Simulador de economia** (`tools/econ-sim`):
  - Simula 30 dias de três perfis de jogador: casual (3 sessões/dia), médio (6) e intenso (12).
  - Gera curvas de nível e saldo.
  - O CI falha se o perfil médio sair da faixa: nível 10 entre o dia 2 e o dia 4, e nível 20 entre o dia 10 e o dia 18.

### 2.4 Oficina isométrica
- Tiles de 64×32. O terreno começa em 8×8 e vai até 20×20, expandindo por faixas.
- Posicionamento por arrastar, com encaixe na grade, rotação e checagem de colisão. O layout é validado no servidor pela função `place_object`.
- Mecânicos NPC (ou o avatar do amigo contratado) andam até o box durante o serviço. É apenas visual.

---

## 3. Social assíncrono

### 3.1 Amigos
- Formas de adicionar: código de amigo (`GT-XXXX`), link de convite (WhatsApp e Instagram) e sugestões de "vizinhos" (jogadores ativos de nível parecido).
- **Dona Cida:** NPC-mentora original e amiga padrão de todo jogador. Faz o tutorial e preenche vagas sociais.

### 3.2 Visitar e ajudar
- A visita mostra a oficina e a vitrine do amigo em modo de leitura.
- **Dar uma mão:** até 5 ajudas por amigo por dia. Opções: lavar um carro da fila dele, adiantar 10% de um serviço ou limpar sujeira.
  - Quem ajuda ganha XP e 🪙. O dono ganha um bônus coletável.
  - O limite é garantido por `helps` (chave única: helper, owner, slot, day).
- **Curtir a vitrine:** 1 curtida por amigo por dia, que dá reputação ao dono.

### 3.3 Contratar
- Os boxes 5–8 exigem um mecânico contratado: um amigo (o avatar dele aparece trabalhando) ou um NPC temporário pago em 🪙.
- A contratação dura 7 dias e é renovável. O amigo contratado recebe uma comissão passiva em 🪙.
- Não existe "pedido de presente" unilateral, para evitar spam.

### 3.4 Comboio (passeio em grupo)
- O dono abre um comboio: destino (Serra, Praia ou Interior), duração de 4 h ou 8 h, 2–6 vagas e janela de entrada de 2 h.
- Os amigos entram com um carro da coleção. Esse carro fica indisponível até o fim do comboio.
- **Recompensa:** `base × f(nº de participantes) × bônus de variedade de classes`.
- Vagas não preenchidas são completadas por NPCs, com recompensa reduzida.

### 3.5 Concurso semanal
- Tem um tema semanal e uma inscrição por jogador, com taxa em 🪙.
- **Votação em pares:** até 30 votos por dia, com uma pequena recompensa por voto. O placar é Elo, calculado no servidor.
- O cron de domingo fecha o concurso. As faixas top 1%, 10% e 50% ganham troféu para a vitrine, 💎 e um adesivo exclusivo.
- **Moderação:** sem texto livre ou upload no MVP. Adesivos, nomes de carro e frases saem de listas pré-definidas.

### 3.6 Rankings e notificações
- **Rankings** entre amigos e global: nível, reputação e troféus (no v1.1, também tempo de arrancada).
- **Notificações** dentro do jogo via Realtime: ajuda recebida, comboio voltou, serviço pronto. Push vem depois do MVP.

### 3.7 Antiabuso
- Ajudas e contratações só valem entre contas vinculadas (e-mail ou Google) de nível 3 ou mais.
- Limites diários por conta.
- Log de ações sociais em `ledger`.

---

## 4. Arte e áudio
- **Carros:**
  - SVG fonte em `art/src/cars/<base>/<camada>_<dir>.svg`.
  - O script `tools/build-atlas` gera atlas PNG em 1× e 2× mais o JSON do Phaser.
  - A pintura é aplicada por tint na camada da carroceria em tons de cinza.
- **Cenário:** tiles e objetos isométricos em SVG, estilo cartoon limpo, com contorno escuro e sombra suave.
- **Interface:** HTML/CSS com tokens próprios (cores, raios, sombras) e fonte *Baloo 2* (Google Fonts).
- **Áudio:** efeitos e trilha lo-fi CC0 (Kenney/Freesound), com créditos em `CREDITS.md` e controles de volume e mudo.
- **Revisões do dono:** o estilo dos 3 primeiros carros é aprovado antes de produzir o resto; nomes e personalidades vêm do dono; teste em dispositivo real a cada marco.

---

## 5. Monetização
- **💎 Gemas:**
  - Pacotes via Stripe Checkout na web; IAP das lojas quando virar app.
  - Também são ganhas por nível, missões semanais e concurso.
- **Loja:** pinturas especiais, adesivos, neon, decoração e skins de mecânico, com seleção do dia girando por cron.
- **Passe da Temporada (v1.1):** temporada de 6 semanas, com trilha grátis e trilha paga **só cosmética**.
- **Proibido:**
  - vender 🪙 por dinheiro;
  - caixa de recompensa aleatória paga;
  - itens com efeito no jogo vendidos por 💎;
  - mais de 3 acelerações por dia.
- **Compras:**
  - Crédito apenas pelo `stripe_webhook`, com verificação de assinatura e idempotência por `payment_intent`.
  - Tabela `purchases` para estorno e suporte.

---

## 6. Qualidade, operação e lançamento

### 6.1 Testes
- `packages/sim`: Vitest com TDD (timers, economia, replay).
- Edge Functions testadas contra Supabase local (`supabase start`).
- E2E com Playwright: primeiro serviço, coleta, posicionar objeto, compra (Stripe em modo de teste) e ajudar amigo.
- O simulador de economia roda no CI (§2.3).

### 6.2 Performance
- 60 fps em celular médio.
- Bundle inicial abaixo de 3 MB e atlas carregados sob demanda.
- Primeira jogada em menos de 5 s em 4G.

### 6.3 CI/CD
- GitHub Actions roda lint, typecheck, testes, validação de conteúdo e build.
- Deploy do cliente em Cloudflare Pages.
- Migrations e funções via Supabase CLI.
- Ambientes de staging e produção.

### 6.4 Privacidade
- LGPD: política de privacidade, exclusão de conta e minimização de dados.
- Classificação etária livre.

### 6.5 Roadmap
| Marco | Conteúdo | Saída |
|---|---|---|
| **M0** Protótipo local | Oficina isométrica 8×8, 2 boxes, 5 serviços, fila de clientes, 🪙 e XP, níveis 1–5, minijogo de lavagem, save local | Validar a diversão do loop curto |
| **M0.1** Ajuste visual | Balões de pedido com ícone, bairro diurno em volta do lote murado, vaga "construir box aqui", botões de zoom, correções pequenas da revisão do M0, carros renomeados | Leitura clara no celular e sensação de lugar |
| **M1** Online | Login de convidado, servidor como autoridade, conteúdo em JSON, customização em abas (pintura, rodas, pneus, kit, performance, suspensão) com **classe + índice de performance**, 5 carros, níveis 1–15, **editor da oficina (piso e decoração) com inventário** | Jogo persistente e seguro |
| **M2** Social | Amigos, visitar e ajudar, contratar, comboio, concurso semanal, Dona Cida, rankings, **carros de amigos como clientes (rosto e nome)**, **missões e avaliação da garagem**, **coleções na concessionária** | Loop social completo |
| **M3** Beta fechado | Loja cosmética (Stripe em modo de teste), telemetria, PT-BR e EN, achados de celeiro, ~50 testers | D1 ≥ 35% e D7 ≥ 12% |
| **v1.0** | Lançamento público na web, Stripe em produção, nome final aprovado | Público |
| **v1.1** | Arrancada com timing e **metas Bronze/Prata/Ouro por pista**, **roleta diária grátis com timing**, Passe da Temporada, push, app via Capacitor | Expansão |

---

## 7. Futuro: Arrancada com timing (v1.1)
- Pista de 400 m contra o fantasma de um amigo ou de um NPC.
- **Controles:**
  - **Largada:** segurar e soltar no verde. Soltar antes do verde queima a largada.
  - **Troca de marcha:** apertar quando o conta-giros estiver na faixa verde, que tem os níveis *perfeita*, *boa* e *ruim*.
  - **Nitro:** um uso, no momento escolhido pelo jogador.
- **Peso dos atributos:**
  - A largura da faixa verde depende da Aderência.
  - A velocidade final depende da Potência.
  - A habilidade do jogador representa cerca de 40% do resultado.
- **Assíncrono e seguro:**
  - O cliente envia só a sequência de entradas com timestamps relativos.
  - O servidor refaz a corrida com `packages/sim` e grava o fantasma.

## 8. Lições da referência de gênero (2026-11-01)
Fonte: prints de um remake de fãs de um jogo social de garagem dos anos 2010, enviados pelo dono. O que vale é a **ideia de gênero**; arte, ícones, layout e nomes não são copiados.

| Observado | Decisão |
|---|---|
| Pedido do cliente como **ícone** num balão | Adotar no M0.1 |
| Garagem como **lugar**: lote murado num quarteirão com ruas, grama, vizinhos, outdoor de ranking, loja de peças como prédio | Adotar no M0.1 (bairro) e M1 (loja como prédio tocável) |
| Vaga vazia listrada indicando onde construir | Adotar no M0.1 |
| Clientes são **carros de amigos**, com foto e nome | Adotar no M2 |
| Decorações que **geram moedas** (brinquedos de moeda) | Avaliar no M1, com limite e manutenção para não quebrar a economia |
| Customização em **abas**, **classe + índice de performance** | Adotar no M1 |
| Concessionária com **coleções** e XP pela compra | Coleções no M2; XP por compra a avaliar no balanceamento |
| Editor da garagem: **piso e decoração** baratos, **inventário**, "resetar" e "concluir" | Adotar no M1 (melhor forma de gastar moedas) |
| Arrancada com **três metas de tempo por pista** e barra de timing | Adotar na v1.1 (Bronze/Prata/Ouro) |
| Nível como **velocímetro/conta-giros** | Adotar com desenho próprio (M1) |
| **Energia/combustível** que limita ações | **Recusar**: frustra e empurra para pagamento; o ritmo já vem dos timers |
| Carro comprável por **moeda premium**, **caixa misteriosa paga** | **Recusar**: pay-to-win e caixa de recompensa aleatória paga (§5) |
| Carros reais com nome levemente trocado, marcas licenciadas na tela de carregamento | **Recusar**: risco de marca; tudo original |

## 9. Ajustes futuros (lista aberta)
- Balanceamento contínuo, guiado pela telemetria.
- Mais minijogos (pintura, alinhamento, troca de pneu cronometrada).
- Nome final, com checagem de marca e domínio.
- Novos destinos de comboio e temas de concurso.
- Upload de adesivo próprio, com moderação.
- Corridas e eventos em tempo real (pós-v1.1, se a retenção justificar).
