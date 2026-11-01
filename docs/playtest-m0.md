# Playtest do M0 — roteiro

**Objetivo:** responder "o loop curto é divertido?" (spec §6.5, M0).

## Preparação (dono)
1. No Cloudflare Pages: **Create project → Connect to Git → `wasdtech/garagetown`**.
   - Build command: `pnpm i && pnpm build`
   - Output directory: `apps/client/dist`
   - Variável de ambiente: `NODE_VERSION=22`
   - Cada branch ganha um link de preview automático. Nenhum token vai para o repositório.
2. Abra o link no celular (e no desktop, se quiser comparar).

## Sessão (10 minutos, sem ajuda)
Jogue sem ler nada antes. Se testar com outra pessoa, **só observe**: não explique, não ajude.

O que anotar:
- Quanto tempo até a primeira lavagem concluída.
- Onde a pessoa travou ou tocou no lugar errado.
- Se ela descobriu sozinha o "Fazer na mão ✋".
- Se algum cliente foi embora sem ser atendido, e se ela percebeu.
- Se o celular esquentou ou travou (fps baixo). **Isso não pôde ser medido no ambiente de nuvem.**

## 5 perguntas depois da sessão
1. De 1 a 5, quanto você quis "só mais um carro"?
2. O que foi mais chato ou confuso?
3. O minijogo de esfregar foi divertido ou cansativo? Você faria de novo?
4. Os tempos (30 s a 1 h) pareceram justos? Algum longo demais?
5. O que você mais queria fazer e não podia? (customizar, decorar, outro serviço…)

## Critério de saída do M0
O dono responde "sim, o loop curto é divertido" ou lista o que precisa mudar antes do M1.
