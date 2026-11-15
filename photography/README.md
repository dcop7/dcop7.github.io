# DCOP7 Photography — `/photography/`

Escola visual de fotografia, servida como site independente dentro do mesmo
repositório e do mesmo GitHub Pages que o Diogo Universe. Tem navegação,
sistema de design, manifesto PWA e service worker próprios. O portal só tem
uma ligação na sidebar (**Fotografia ↗**) e redireciona as rotas antigas.

## Estrutura

```
photography/
├── index.html              shell: cabeçalho, pesquisa, índice completo, hero + áreas, autor, rodapé
├── sw.js                   service worker, âmbito /photography/, caches foto-*
├── manifest.webmanifest    PWA própria (id /photography/), com atalhos
├── icon.svg · icon-*.png   diafragma (os PNG saem do SVG com sharp)
├── fonts/                  Instrument Serif/Sans + IBM Plex Mono (woff2, OFL 1.1) + fonts.css
├── css/
│   ├── ph-tokens.css       tokens: --dp-* + nomes de compatibilidade (--card, --accent…)
│   ├── ph-ui.css           shell e componentes próprios (pesquisa, índice, hero, folha de contactos)
│   ├── ph-chapters.css     regras ph-* que viviam em css/views/features.css
│   ├── ph-desk.css         a bancada: Câmara escura e Mesa de revelação
│   ├── ph-lab.css          hub do Laboratório e instrumentos
│   └── photo-*.css         capítulos (learn, genre, cheats, studio)
└── js/
    ├── ph-shell.js         PhNav (router) + PhShell (área ativa, tema, índice, guardados, SW)
    ├── ph-icons.js         PhIcon: ícones SVG próprios; troca os emojis herdados por ícones
    ├── ph-search.js        PhSearch (Ctrl/⌘+K ou "/") + PhFav (páginas guardadas)
    ├── photography.js      PhotographyPage.show(sub), o mesmo contrato da secção antiga
    ├── photo-lab.js        PhotoLab: motor de píxeis (o único; corre também no worker)
    ├── ph-sim.js           PhSim: modelo físico (EV, profundidade de campo, arrasto, ruído)
    ├── ph-lab-worker.js    worker: PhotoLab + PhSim fora da thread principal
    ├── ph-desk.js          PhDesk: a bancada (modos "sim" e "dev")
    ├── ph-instruments.js   PhInstruments: os 8 instrumentos de exposição e ótica
    ├── ph-exif.js          PhExif: leitor mínimo de EXIF (nunca lê GPS)
    ├── photo-*.js          restantes motores (PhotoLearn, PhotoCard, PhotoIllus…)
    └── studio/*.mjs        estúdio 3D (three.js r160 via esm.sh)
```

Os dados e as imagens ficaram onde estavam, porque o `tools/photogen` escreve
lá: `data/photo/*.json` e `assets/photo/` (com `index.json`). São sempre
referidos por **caminho absoluto** (`/data/photo/…`, `/assets/photo/…`).
Caminhos relativos resolviam para `/photography/data/…`.

## Rotas

Por hash (o GitHub Pages não reescreve caminhos): `/photography/#<rota>`, com
as mesmas rotas da secção antiga sem o prefixo `photography/`:
`g/<género>`, `consulta[/…]`, `aprender/<capítulo>[/<item>]`,
`aprender/equipamento/<cat>[/<item>]`, `edicao[/<ferramenta>]`, `laboratorio`,
`estudio`, além dos aliases antigos (`agora/…`, `cs`, `calc`, `ferramentas`…).
A rota vazia é a home (hero + quatro áreas + folha de contactos).

Rotas da bancada e dos instrumentos:

| Rota | O que abre |
|------|------------|
| `laboratorio` | hub do Laboratório (câmara escura, instrumentos, estúdios) |
| `laboratorio/camara[/<cena>]` | Câmara escura: simular abertura, tempo e ISO numa fotografia |
| `laboratorio/<instrumento>` | um instrumento: `exposure`, `dof`, `focal`, `hf`, `nd`, `flash`, `le`, `gh` |
| `edicao/mesa[/<foto>]` | Mesa de revelação: todos os ajustes, estilos, histórico, exportar |

- `PhNav.go(rota)` aceita também a forma `photography/…`.
- As ligações `<a href="#…">` passam pelo router como navegação nova
  (pushState e topo da página). `hashchange`/`popstate` ficam para o
  atrás/à frente, que restauram a posição de scroll.
- No portal, `#photography[/sub]` faz `location.replace('/photography/#sub')`
  em `nav.js`. É `replace` para o "voltar" não cair num ciclo de
  redirecionamento.

## Service workers

- `/sw.js` (portal, caches `dcop7-*`) e `/photography/sw.js` (caches
  `foto-*`) convivem. Em páginas `/photography/` manda o de âmbito mais
  específico, e este SW trata também os pedidos a `/data/photo` e
  `/assets/photo` que essas páginas fazem.
- **Cada SW só apaga as suas caches.** O do portal apagava todas as
  caches com outro nome; foi limitado a `dcop7-*`.
- Ao mudar código do microsite, subir `CACHE` em `photography/sw.js`. A
  lista `STATIC` tem de incluir os ficheiros novos de `css/`, `js/` e `fonts/`.
- Os tipos de letra são do próprio site (`fonts/`), por isso funcionam offline
  à primeira visita e não há pedidos às Google Fonts.

## A bancada (`PhDesk`)

Uma só bancada com dois modos, para a fotografia ser sempre o centro:

- **Câmara escura** (`sim`): parte de uma fotografia com as definições reais
  com que foi tirada (`data/photo/lab.json`) e mostra o que mudava com outra
  abertura, tempo ou ISO. As contas são do `PhSim`; nada é "efeito a olho":
  o desfoque vem do círculo de confusão por píxel (modelo de profundidade
  declarado em cada cena), o arrasto da velocidade declarada de cada zona, o
  ruído do ISO e do tamanho do sensor. A legenda da cena diz sempre o que é
  medido e o que é modelo.
- **Mesa de revelação** (`dev`): todos os ajustes do `PhotoLab` agrupados
  (Luz, Cor, Curva, HSL, Gradação, Detalhe, Efeitos), estilos de
  `looks.json` com dose, histórico com desfazer/refazer e exportação JPEG.
  Abre também um ficheiro do utilizador, que **nunca sai do browser**.

O render corre num worker com fila "ganha o último": enquanto se arrasta um
controlo sai uma passagem a meia resolução, e 170 ms depois de parar sai a
passagem inteira. Sem worker (ou em `file://`) cai para a thread principal.

Comparação: Resultado / Cortina / Lado a lado, e "segurar para ver o
original" (`\` ou `O`). Teclado: `1 2 3` modos de comparação, `[ ]` painéis,
`F` ecrã limpo, `J` avisos de corte, `Z` zoom, `Ctrl+Z` desfazer.
Em ecrãs ≤ 900px a fotografia fica presa em cima, há uma secção por separador
e uma barra de separadores em baixo.

## Dados guardados (`localStorage`)

Mantidos das versões anteriores: `ph-class`, `ph-profile`, `dp-theme`,
`ph-studio-mode`, `ph-shutter`, `ph-comp-ov`, `ph-cmp-*`.
Novos: `ph-desk` (painéis, modo de comparação, última cena de cada modo),
`ph-dev-edit` (a edição em curso), `ph-inst` (valores dos instrumentos),
`ph-favs` (páginas guardadas). Nenhuma chave antiga foi renomeada ou apagada,
por isso não há migração a fazer.

## Sistema de design (câmara escura editorial)

- **Cor:** preto quente `#0f0d0a`, marfim `#efe7d8`, um acento âmbar
  ("luz de segurança") `#e9a649`. O texto sobre o âmbar é tinta escura
  (`--on-accent`), nunca branco. Tema claro = "prova em papel", ativado por
  `body.light` (o hook que o código herdado já usava) e guardado em
  `localStorage['dp-theme']`.
- **Tipo:** *Instrument Serif* (títulos grandes), *Instrument Sans* (interface),
  *IBM Plex Mono* (metadados ao estilo EXIF, números de área e de fotograma).
  Alojados em `fonts/` (OFL 1.1).
- **Ícones:** só SVG de traço, de `PhIcon.svg(nome)`. Não usar emojis como
  ícones: o `PhIcon.watch` troca os que ainda vêm dos dados herdados e tira os
  que não têm equivalente. `data-noico` num elemento desliga a troca.
- **Capas herdadas** (`apr-ico`, `cheat-ico`, `eq-ico`, `genre-ico`): eram
  azuis/ciano; um filtro CSS em `ph-ui.css` passa-as a duotone quente para
  não lutarem com a paleta.
- **Forma:** cantos de 2–4px e filetes em vez de caixas. As imagens são a cor.
- **Tokens em `:root, body`:** os nomes de compatibilidade
  (`--text: var(--dp-paper)`) têm de ser resolvidos no `body`. Declarados só
  em `:root`, o `body.light` não os mudava e o texto dos capítulos ficava
  marfim sobre papel.
- **Folha de contactos:** cada género é um fotograma com a sua fotografia
  `vis-<id>` (miniatura de 560px em `assets/photo/thumbs`, criada por
  `tools/photogen/thumbs.mjs`), o número do fotograma e a focal equivalente
  na margem.
- **Imagens do site** (`assets/photo/site/`): as capas das quatro áreas são
  geradas no ComfyUI local (grupo `site` do `tools/photogen/manifest.json`).
  O hero e o `og.jpg` são uma **fotografia do autor**
  (`tools/photogen/own.mjs --hero`), com a legenda EXIF verdadeira.
  `lab-studio.webp` e `lab-street.webp` são capturas do Estúdio 3D.
- **Fotografias do autor** (`assets/photo/own/`, `data/photo/own.json`): hero,
  secção "Fotografias de Diogo" na home e cenas da bancada. Não substituem as
  imagens didáticas de Aprender. São © do autor (ver
  `ASSET-LICENSE-AUDIT.md`); os originais ficam em `my_photos/`, fora do git.

## Testar

```bash
python -m http.server 8321 --bind 127.0.0.1
node node_modules/.mp-flow.mjs 1366    # rotas, cliques, atrás/à frente, redirecionamentos do portal
node node_modules/.mp-flow.mjs 390     # o mesmo em telemóvel
node node_modules/.mp-pwa.mjs          # os dois SW, caches isoladas, offline
node node_modules/.rd/simtest.mjs      # contas do PhSim contra valores de referência + experiências equilibradas
node node_modules/.rd/feat.mjs 1440    # bancada, instrumentos, pesquisa, guardados (também 820 e 390)
node node_modules/.rd/a11y.mjs 390     # nomes acessíveis, rótulos, contraste, alvos de toque (também 1440)
```
(os scripts vivem em `node_modules/`, que o git ignora; usam `puppeteer-core`.)

O estúdio 3D fica em three.js **r160** de propósito: versões mais recentes
mudaram o interior das sombras que `st-core.mjs` ajusta.
