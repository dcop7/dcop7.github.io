# DCOP7 Photography — `/photography/`

Escola visual de fotografia, servida como site independente dentro do mesmo
repositório e do mesmo GitHub Pages que o Diogo Universe. Tem navegação,
sistema de design, manifesto PWA e service worker próprios. O portal só tem
uma ligação na sidebar (**Fotografia ↗**) e redireciona as rotas antigas.

## Estrutura

```
photography/
├── index.html              shell: cabeçalho, índice móvel, hero + áreas (estáticos), rodapé
├── sw.js                   service worker, âmbito /photography/, caches foto-*
├── manifest.webmanifest    PWA própria (id /photography/)
├── icon.svg · icon-*.png   diafragma (os PNG saem do SVG com sharp)
├── css/
│   ├── ph-tokens.css       tokens: --dp-* + nomes de compatibilidade (--card, --accent…)
│   ├── ph-ui.css           shell e componentes próprios (folha de contactos, .btn, cabeça de página)
│   ├── ph-chapters.css     regras ph-* que viviam em css/views/features.css
│   └── photo-*.css         capítulos (learn, genre, cheats, studio)
└── js/
    ├── ph-shell.js         PhNav (router) + PhShell (área ativa, tema, índice, SW)
    ├── photography.js      PhotographyPage.show(sub), o mesmo contrato da secção antiga
    ├── photo-*.js          motores (PhotoLab, PhotoLearn, PhotoCard, PhotoIllus…)
    └── studio/*.mjs        estúdio 3D (three.js via esm.sh)
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
- Ao mudar código do microsite, subir `CACHE` em `photography/sw.js`.

## Sistema de design (câmara escura editorial)

- **Cor:** preto quente `#0f0d0a`, marfim `#efe7d8`, um acento âmbar
  ("luz de segurança") `#e9a649`. O texto sobre o âmbar é tinta escura
  (`--on-accent`), nunca branco. Tema claro = "prova em papel", ativado por
  `body.light` (o hook que o código herdado já usava) e guardado em
  `localStorage['dp-theme']`.
- **Tipo:** *Instrument Serif* (títulos grandes), *Instrument Sans* (interface),
  *IBM Plex Mono* (metadados ao estilo EXIF, números de área e de fotograma).
- **Forma:** cantos de 2–4px e filetes em vez de caixas. As imagens são a cor.
- **Tokens em `:root, body`:** os nomes de compatibilidade
  (`--text: var(--dp-paper)`) têm de ser resolvidos no `body`. Declarados só
  em `:root`, o `body.light` não os mudava e o texto dos capítulos ficava
  marfim sobre papel.
- **Folha de contactos:** cada género é um fotograma com a sua fotografia
  `vis-<id>` (miniatura de 560px em `assets/photo/thumbs`, criada por
  `tools/photogen/thumbs.mjs`), o número do fotograma e a focal equivalente
  na margem.
- **Imagens do site** (`assets/photo/site/`): hero e capas das quatro áreas,
  geradas no ComfyUI local (grupo `site` do `tools/photogen/manifest.json`).
  O `og.jpg` é recortado do hero.

## Testar

```bash
python -m http.server 8321 --bind 127.0.0.1
node node_modules/.mp-flow.mjs 1366    # rotas, cliques, atrás/à frente, redirecionamentos do portal
node node_modules/.mp-flow.mjs 390     # o mesmo em telemóvel
node node_modules/.mp-pwa.mjs          # os dois SW, caches isoladas, offline
```
(os scripts vivem em `node_modules/`, que o git ignora; usam `puppeteer-core`.)
