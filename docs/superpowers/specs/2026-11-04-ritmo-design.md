# Ritmo de progressão (rebalanceamento)

Substitui as metas de ritmo da spec original (§2.3, "jogador médio chega ao nível 10 entre os dias 2 e 4").

## Problema medido (simulador `econSim`, jogador-robô em sessão contínua)

- Nível 5 em 52 min, nível 9 em ~3 h 45, nível 15 em ~16 h de jogo ativo.
- **Recompensa invertida:** cada serviço novo pagava menos XP/hora que o anterior (Lavagem 360 → Adesivos 84 → Turbo 38 XP/h). Desbloquear serviços era uma punição; a melhor estratégia era só lavar.
- A curva de níveis crescia ~30% por nível enquanto o ganho por hora ficava travado pelos 4 boxes e pela chegada de clientes.

## Decisão do dono: ritmo rápido

| Meta (robô, sessão contínua) | Antes | Depois |
|---|---|---|
| Nível 5 | 52 min | ≤ 15 min (14) |
| Nível 10 | ~5 h | ≤ 100 min (84) |
| Nível 15 | ~16 h | entre 4 h e 6 h (5 h 17) |
| Jogador médio, nível 10 | dias 2–4 | dias 0,5–1,5 (0,85) |

Uma pessoa real joga ~30% mais devagar que o robô (arrasta, faz minijogos).

## Regras de conteúdo

1. Serviços com menos de 1 h: o XP/hora nunca cai quando o nível de desbloqueio sobe (360 → 680 XP/h).
2. Serviços de 1 h ou mais (para quando o jogador sai): pagam menos XP/hora que a Lavagem (150–180 XP/h), para que jogar ativo continue valendo mais que deixar rodando.
3. Curva de níveis: começo mais curto (20/50/95/160/270), fim parecido com o anterior (total 6.000 XP em vez de 7.000).
4. Moedas, preços e Franquia não mudam.

Os testes de `packages/sim/test/economy.test.ts` ("pacing (ritmo rápido)") fixam essas metas e regras.
