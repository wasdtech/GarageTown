# Revisão de andamento — QA + Game Design (2026-11-01)

- **Escopo:** build da branch `claude/customizar-carros` (M0 + M0.1 + Crescer a oficina + Customizar carros).
- **Fora do escopo:** online, arrancada, decoração.
- **Evidência:** `docs/reviews/2026-11-01-qa-mobile.png` (sessão exploratória a 390×844 com toque).

---

## Parte 1 — QA

### O que foi coberto
- **Automatizado:**
  - 111 testes unitários: regras do `sim`, save/migrações, economia, transições e chave de redesenho;
  - 20 E2E Playwright em desktop e celular: primeiro serviço, persistência, minijogo, save corrompido, construir box, garagem e concessionária, contraste, zoom e toque duplo.
- **Exploratório:** 3 charters no celular (≈15 min):
  1. jogador novo nos primeiros 30 s;
  2. garagem em tela estreita;
  3. vaga de construção bloqueada.
- **Fatos medidos:**
  - carregamento ≈ 0,8 s em build local;
  - 0 erros de console;
  - sem scroll horizontal;
  - bundle de 1,96 MB (limite 3 MB).

### Achados (ordenados por risco)

| # | Severidade | Achado | Evidência / reprodução | Sugestão |
|---|---|---|---|---|
| Q1 | **Alta (UX)** | O carro de exposição (vermelho, no lote) parece um cliente. No primeiro minuto é o único carro na tela, e o jogador novo toca nele esperando atender; em vez disso abre a garagem. | Charter 1: tela 01, sem clientes nos primeiros 20 s. | Pedestal visível ("MEU CARRO"), placa ou holofote, e posição fora do caminho dos boxes. |
| Q2 | **Alta (UX)** | 20 s sem nada para fazer no início, sem nenhuma dica do que fazer. | Tela 01–02: "Toque num cliente na rua primeiro" aparece sem cliente nenhum. | Primeiro cliente imediato e tutorial curto (Dona Cida, já prevista na spec). |
| Q3 | Média | No celular, o 1º cliente da fila fica cortado na borda esquerda. | Tela 03: carro na fila em x≈0. | Ajustar o enquadramento para incluir a fila inteira, ou começar a fila mais à direita. |
| Q4 | Média | Abas da garagem no celular: "Peças" e "Carros" ficam escondidas fora da tela (rolagem lateral sem indicação). | Telas 04–05. | Abas em 2 linhas ou ícones curtos no celular. |
| Q5 | Baixa | Vaga bloqueada repete "Nível 3" em cada tipo. | Tela 06. | Uma linha só: "Libera no nível 3", com os tipos desabilitados. |
| Q6 | Baixa | O VIP aparece com a cor comum durante a viagem e só fica dourado ao chegar. | Conhecido. | Passar `vip` na transição. |
| Q7 | Baixa | O piso de Performance é provisório (mecânica com tint). | Conhecido. | Gerar a arte quando houver créditos. |

### Riscos não cobertos por testes
- `prefers-reduced-motion`: não há teste automático.
- Regressão visual: não há screenshots comparados no CI.
- Desempenho real em celular: 60 fps nunca foi medido em aparelho físico.
- Acessibilidade: leitor de tela e foco de teclado nos menus DOM não foram testados. Os botões têm texto, mas o canvas do jogo não tem alternativa.
- Save muito grande ou muito antigo (meses parado): o rebase de relógio cobre, mas falta um teste de longa duração.

### Critério de saída sugerido para a próxima rodada
Q1–Q4 corrigidos, e um playtest de 10 min com 3 pessoas sem ajuda, em que pelo menos 2 completam o 1º serviço em menos de 60 s.

---

## Parte 2 — Game Design

### Leitura MDA

| Camada | Estado | Comentário |
|---|---|---|
| **Mecânicas** | ✅ sólidas | Pedido → box → timer → coleta. Gorjeta por acertar, bônus por pontualidade, minijogo opcional, construir, VIP, peças e visual. |
| **Dinâmicas** | ⚠️ parciais | A escolha "serviço curto (XP) × longo (moedas)" existe e é boa. A escolha do box é quase automática (o pedido manda). Peças e classe ainda **não mudam nada no jogo**: não há onde usar o índice. |
| **Estéticas** | ⚠️ | **Expressão** (customização) e **Submissão** (relaxar com timers) estão presentes. **Desafio** é fraco. **Descoberta** é baixa (sem surpresas além do VIP). **Companhia**: zero (online adiado). |

### Loops
- **Core loop:** funciona e é legível. O balão com ícone e as animações dos carros ajudaram muito.
- **Meta loop:** existe (nível → serviço/box novo → peça/carro), mas **falta um "próximo objetivo" visível**. O jogador não sabe o que perseguir. Pela Teoria da Autodeterminação, **Competência** pede metas claras e feedback de progresso.
- **Fantasy loop** ("minha oficina dos sonhos"): bem servido pelo bairro e pela garagem. O carro de exposição é uma ótima ideia, mas precisa ser **celebrado** (pedestal, luz), não confundido com cliente.

### Pontos fortes
1. **Clareza do loop:** em 1 minuto dá para entender o que fazer.
2. **Estilo visual coeso:** carros, ícones e pisos da IA no mesmo traço.
3. **Economia validada por simulação:** nível 10 por volta do dia 4 e sinks reais.
4. **Respeito ao jogador:** sem energia, sem pay-to-win, minijogo opcional, sem punição por ficar fora.

### Problemas de design (por impacto)
1. **Onboarding (Hodent, *The Gamer's Brain*).** Hoje é "descubra sozinho". Proposta: 1º cliente imediato e 4 passos guiados pela Dona Cida (tocar cliente → box → coletar → ver a garagem), com recompensa no fim.
2. **Juice e feedback (*Juice it or Lose it*).** Falta som e falta a sensação de ganhar. Propostas:
   - moedas voando até o HUD;
   - um "plim" de som;
   - um pequeno salto do carro ao terminar;
   - uma celebração ao subir de nível.

   O CellCog pode gerar os sons.
3. **Índice de performance sem uso.** Peças e classe precisam de **significado mecânico**. A Arrancada (próximo bloco) resolve isso. Até lá, o **Estilo** do carro exposto pode aumentar a chance de VIP ou a gorjeta, ligando a customização ao loop principal.
4. **Objetivos visíveis.** Um painel leve de "Metas" (3 por vez, ex.: "Atenda 5 lavagens", "Construa um box de Pintura", "Chegue à classe C") dá direção. Isso já estava no bloco de decoração e vale antecipar.
5. **Decisão de alocação rasa.** Hoje o melhor é sempre atender o pedido. Para criar decisões interessantes (Sid Meier), dá para:
   - fazer o cliente aceitar um serviço "melhor" que o pedido, por mais moedas e menos gorjeta;
   - ou criar combos (lavagem + polimento no mesmo carro).
6. **Ritmo do início.** Os níveis 1–3 têm só 2 boxes e serviços de 30 s a 5 min, então o jogador ativo fica esperando cliente (1 a cada 20 s). Avaliar 12–15 s no início.

### Recomendação de ordem (próximas entregas)
1. **Polimento do início:** Q1–Q4, onboarding com a Dona Cida e 1º cliente imediato.
2. **Juice:** moedas voando, sons via CellCog e celebração de nível.
3. **Arrancada:** dá sentido às peças e à classe.
4. **Metas e decoração:** objetivos visíveis e mais formas de gastar moedas.
5. Online (combinado para o final).
