# Garage Town — Guia de estilo de arte

Para gerar arte com IA (SpriteCook / CellCog) mantendo tudo coerente com o jogo.

- **Referências:** `art/reference/style-cars.png` e `art/reference/style-scene.png`
- **Manifesto dos assets gerados:** `art/spritecook-assets.json`

## Regras visuais (valem para todo asset)
- **Projeção:** isométrica 2:1 (tile de 64×32 px). Carros **virados para sudeste** (frente para baixo-direita), uma única vista no M0.
- **Traço:** cartoon limpo, contorno escuro `#1d1d2b` de ~3 px na escala final, cantos levemente arredondados, sombreado em 2–3 tons chapados. Sem degradê realista e sem textura de foto.
- **Luz:** vem de cima e da esquerda. Topo mais claro, lateral direita média, lateral esquerda mais escura.
- **Paleta base:**
  - grama `#86c96b`
  - asfalto `#4a4e5a`
  - calçada `#d9dde3`
  - piso da oficina `#f1ebe0`
  - vidro `#5fa8d3`
  - faróis `#ffe066`
  - lanterna `#e63946`
  - destaque `#ffd166`
- **Fundo:** sempre transparente (remover o fundo após gerar).
- **Originalidade:** nada de marcas, logos, emblemas, placas reais ou formas reconhecíveis de modelos reais. Carros com proporções exageradas e fofas ("chibi"), nomes inventados.

## Carros (camadas para pintura no jogo)
O jogo pinta a carroceria por tint. Cada carro precisa de **3 PNGs alinhados** (mesmo canvas):

1. `shadow`: só a sombra no chão, preta com ~28% de opacidade.
2. `body`: carroceria em **tons de cinza** (`#e0e0e0` topo, `#b0b0b0` lateral direita, `#808080` lateral esquerda), com o contorno.
3. `details`: rodas, vidros, faróis, lanterna e para-choque, já coloridos.

Canvas de 256×160 (2×), com o centro da base do carro em (128, 108).

**Prompt base (carro):**
> isometric 2:1 game sprite of a small cartoon car facing south-east, chunky cute proportions, clean thick dark outline (#1d1d2b), flat cel shading with 3 tones, light from top-left, transparent background, no logos, no text, no license plate, original design, consistent with the reference style images

**Variações por carro:**

| key | nome | descrição para o prompt |
|---|---|---|
| `pitoco` | Pitoco | compact rounded hatchback, tall cabin, short hood |
| `brutus_v8` | Brutus V8 | long-hood muscle coupe, hood scoop, wide stance |
| `corisco_rs` | Corisco RS | low sporty coupe, sloped roof, small rear spoiler |

Para a camada `body`: acrescentar *"body painted in neutral greyscale only, no colour"*. Para `details`, usar edição do mesmo asset (manter o enquadramento).

## Cenário (tiles e objetos)
| asset | tamanho final | prompt curto |
|---|---|---|
| `tiles/floor` | 64×32 | warm light concrete garage floor tile, subtle seams |
| `tiles/street` | 64×32 | asphalt road tile with dashed yellow centre line along the tile's long diagonal |
| `tiles/sidewalk` | 64×32 | light grey sidewalk tile with curb edge |
| `tiles/grass` | 64×32 | grass tile with a few small tufts, seamless with #86c96b |
| `objects/bay_wash` | 128×64 | 2×2 car wash pad, blue border, water drops |
| `objects/bay_mechanic` | 128×64 | 2×2 mechanic pad, orange border, small lift posts |
| `objects/build_slot` | 128×64 | empty construction pad with yellow/black hazard stripes |
| `objects/tree` | 64×96 | round cartoon tree, base at bottom centre |
| `objects/shop` | 200×170 | small auto-parts shop, flat roof, striped awning, **no readable text** |
| `objects/billboard` | 140×110 | blank billboard on two posts (text drawn in-game) |

## Ícones de pedido (48×48)
`wash` (gota), `oil` (galão de óleo), `polish` (brilho), `tires` (pneu), `engine` (motor). Estilo de ícone grosso, contorno escuro e uma cor dominante cada.

## Como foi feito o primeiro lote (carros)
- **Modelo:** `gpt-image-2`, qualidade `low` (2 créditos por imagem), HD (não pixel art), fundo transparente.
- **Referências de estilo:** `style-cars.png` e, a partir do segundo carro, o próprio Pitoco gerado.
- **Pintura:** o carro é gerado **pintado de vermelho sólido**. O script `tools/split_ai_car.py` separa os pixels vermelhos na camada `body` (convertida para cinza) e o resto em `details`/`shadow`, com saída em PNG 2× em `art/src/cars/<key>/`.
- **No jogo:** as camadas são carregadas como PNG com escala 0,5.

## Processo
1. Subir as referências como *style assets* e guardar os `asset_id` no manifesto.
2. Gerar **um lote de teste:** 3 carros + `floor` + `street`.
3. O dono compara com a arte atual e aprova ou pede ajustes.
4. Gerar o resto, remover o fundo, redimensionar para o tamanho final e salvar em `art/src/...` com os mesmos nomes de arquivo (o jogo não muda de código).
5. Registrar cada asset no manifesto (`asset_id`, `sha12`, `label`).

## Checagens antes de aceitar um asset
- Ângulo e escala batem com a referência (sobrepor no `style-scene.png`).
- Fundo transparente, sem halo branco.
- Nada de texto, logo ou semelhança com modelo real.
- A camada `body` está realmente em cinza (o tint precisa funcionar).
