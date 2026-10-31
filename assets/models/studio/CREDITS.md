# Estúdio virtual — sujeito 3D: créditos e licença

`subject.glb` e as texturas em `tex/` formam o sujeito do Estúdio virtual
(Fotografia › Estúdio). É uma pessoa **sintética**: o modelo não corresponde a
nenhuma pessoa real.

## Origem — MakeHuman, CC0 1.0

Todos os dados de partida vêm do projeto **MakeHuman** (makehumancommunity.org):

| Parte | Ficheiro de origem |
|---|---|
| Malha base hm08, targets `universal-female-young-averagemuscle-averageweight` + `caucasian-female-young`, rig `default.mhskel` + pesos `default_weights.mhw`, olhos `high-poly` + `brown_eye.png` | repositório oficial `makehumancommunity/makehuman` (`makehuman/data/`) |
| Pele `young_caucasian_female`, cabelo `ponytail01`, sobrancelhas `eyebrow001`, pestanas `eyelashes01`, roupa `female_casualsuit01`, sapatos `shoes06` | pacote oficial `makehuman_system_assets_cc0.zip` (mirror1.makehuman.net/asset_packs/makehuman_system_assets/) |

Licença: **CC0 1.0 Universal**. Do `LICENSE.md` do MakeHuman, secção C:
*"These assets have been released under CC0 1.0 Universal. In summary this means
that to the fullest extent possible, it is the intention of the MakeHuman project
that anyone can do whatever they want with it."* E secção D: *"the MakeHuman
project makes no claim whatsoever over output"*. Cada ficheiro de origem repete a
nota *"This asset was explicitly released as CC0 in september 2020"*.

A atribuição não é obrigatória; fica aqui por transparência.

## O que foi feito (tools/studio/build-subject.mjs)

- targets aplicados à malha base; esqueleto calculado a partir das articulações
  auxiliares; pose de braços caídos por skinning linear com os pesos oficiais;
- roupa, cabelo, olhos, sobrancelhas e pestanas ajustados ao corpo pelas regras
  `.mhclo` (e com os pesos herdados, para seguirem a pose);
- a córnea foi separada do globo ocular (camada só de reflexo, é dela que vêm os
  catchlights);
- o couro cabeludo foi pintado de castanho debaixo do cabelo;
- a t-shirt foi **repintada de cinzento-grafite liso, sem o logótipo MakeHuman**
  (marca registada do projeto — removida de propósito);
- texturas reduzidas e convertidas para WebP.

Para regenerar: `cd tools/studio && npm i && node fetch.mjs && node build-subject.mjs`.

## O resto do estúdio

Flashes, modificadores (softbox, octabox, stripbox, sombrinhas, beauty dish,
refletor, grelha, snoot), rebatedor 5-em-1, tripés, girafa, câmara, fundo de
papel e sala são **geometria procedural original** (`js/pages/studio/st-gear.mjs`).
As texturas do chão, do papel e dos poros da pele são geradas por código. Não há
modelos, texturas ou HDRIs de terceiros no estúdio.
