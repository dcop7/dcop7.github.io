# Diogo Universe

Dashboard pessoal e playground alojado no GitHub Pages. **Zero backend, zero build step no cliente** — HTML, CSS e JavaScript puros, com pipelines de dados via GitHub Actions que geram JSON estático.

**Live:** [dcop7.github.io](https://dcop7.github.io)

Este README serve de *knowledge base* do projeto: o que o site contém, como está arquitetado, que tecnologias e APIs usa, e as convenções a respeitar.

---

## Princípios

- **Frontend-only** — sem servidor, sem base de dados. O "backend" são GitHub Actions que fazem commit de JSON para `data/`.
- **Sem frameworks nem bundler** — não há `package.json` na raiz, React, Vue ou minificação. Vanilla JS com padrão IIFE.
- **Offline-first** — PWA com service worker; dados agregados server-side para o browser ler um único JSON local.
- **PT por omissão** — bilingue (pt/en), com português como língua principal.
- **Sem chaves de API no cliente** — tudo o que exige segredos corre nas Actions.
- **Licenciamento estrito de assets** — apenas CC0 / MIT / CC-BY / trabalho original. Nada de Adobe/Mixamo nem licenças não-comerciais (ver `ASSET-LICENSE-AUDIT.md` e `ASSET-REGISTRY.json`).

---

## Secções do site

Navegação lateral (hash-based), agrupada em **Descobrir**, **Ferramentas**, **Diversão** e **Fotografia**:

| Rota | Secção | Conteúdo |
|------|--------|----------|
| `#home` | **Home** | Saudação, pesquisa, painel de descoberta diária (Hoje na História/Portugal, Nasceram Hoje, Destaque, Inspiração), bloco "Útil hoje" (meteo, combustíveis, eletricidade, feriados), bookmarks, feeds |
| `#explorer` | **Explorar** | Hub de exploradores: Terra em Tempo Real (globo 3D dia/noite com camadas ao vivo — sismos, vulcões, incêndios, tempestades, nuvens NASA — viagem no tempo e auto-rotação), Sistema Solar, Galáxia, Corpo Humano 3D (three.js), Portugal (mapa concelhos), Linha do Tempo interativa, Dados do Mundo (Mundo▸Continente▸País▸Cidade), Temas (knowledge base Área→Tema→Subtema) |
| `#noticias` | **Notícias** | Agregador RSS estático por tópicos (tecnologia, IA, gaming, economia, ciência, F1, fact-check, …) — sem DB, refresh a cada 4h via Action |
| `#noticias-ai` | **Notícias AI** (experimental) | Edição diária curada: um editor de IA (Groq, na Action) agrupa, ordena e resume os mesmos artigos RSS — no máximo 5 histórias por tema. Corre **em paralelo** com `#noticias`, que fica intacto |
| `#eventos` | **Eventos** | Descoberta de eventos em Portugal (AgendaLX, e-cultura ao vivo + seed offline), mapa Leaflet, geocoding por concelho |
| `#ocorrencias` | **Ocorrências PT** | Dashboard de proteção civil em tempo real: sismos (USGS, bbox PT/Atlântico), incêndios/ocorrências ANEPC (3 níveis: API Aberta com chave do utilizador → fogos.pt direto → snapshot via Action a cada 15 min), avisos meteorológicos por distrito (IPMA, polígonos coloridos), camadas de satélite (basemap NASA GIBS do próprio dia, focos de calor + áreas ardidas EFFIS/Copernicus), mapa Leaflet multi-basemap com detalhe por ocorrência e ordenação por recência/gravidade |
| `#f1` | **Fórmula 1** | Secção experimental: calendário/resultados (Jolpica), posições live/replay em canvas (OpenF1), tudo CORS-direct sem backend |
| `#oss` | **Descobrir Tech** | Explorador de projetos open-source (índice gerado por Action + GitHub API) |
| `#discovery` | **Gaming Deals** | Deals de gaming e jogos grátis (refresh 6h) |
| `#tools` | **Tools** | Calculadora, pomodoro, cronómetro, editor markdown, regex tester, diff, conversores, cores, UUID, timestamps, dados 3D, … |
| `#cheatsheets` | **Cheatsheets** | Referências de comandos: Git, Linux, Vim, regex, Docker, atalhos |
| `#games` | **Jogos** | 13 jogos curados: Xadrez (chess.js vendored), Sueca (engine/IA próprios, 4 níveis), Olho Vivo (Dobble/Spot It, plano projetivo, engine próprio), Batalha Naval, Uno (engine/IA próprios), Bomba, Campo Minado, Forca, Wordle, Memória, Neon Shooter, Reaction, Gravity Lab — progresso unificado via `GameProgress` |
| `#quiz` | **Quizzes** | Quizzes offline data-driven: `quizzes/<id>/<lang>/<dificuldade>.json`, cada pergunta com facto explicativo (`exp`), sem APIs |
| `#humor` | **Humor** | Piadas por categoria, data-driven (`data/humor/*.json`), 17 categorias (incl. piropos e cúmulos) organizadas por grupos, centenas de entradas |
| `#links` | **Links** | Biblioteca de recursos por categoria |
| `#photography` | **Fotografia** | Escola por géneros (28 portais: paisagem, retrato, rua, astro, …) com recomendações adaptadas ao equipamento real (Canon M50 II / Galaxy S26+ / ambos), Cheatsheets visuais de consulta rápida (15 gerais + 8 géneros com fichas próprias + cartão de bolso dos restantes 20), Aprender (Visão, Ler fotografias, Fundamentos, Composição, Estilos, Técnicas, Cores), 12 técnicas de edição RapidRAW/darktable/Snapseed e 8 calculadoras (`data/photo/*.json`) |
| `#visual` | **Visual** | Whiteboard (Excalidraw), matriz de Eisenhower, SWOT |
| `#settings` | **Preferências** | Tema, tamanho de letra, língua, bookmarks, cidade da meteo |

Extras transversais: **command palette** (Ctrl+K), pesquisa global (`#search`), página 404.

---

## Arquitetura

### Estrutura de pastas

```
dcop7.github.io/
├── index.html                 ← shell único; todas as views inline
├── sw.js                      ← service worker (na raiz por causa do scope)
├── manifest.json / favicon.svg
├── css/
│   ├── tokens.css             ← design tokens (custom properties)
│   ├── base.css               ← reset, keyframes, fundo
│   ├── layout.css             ← header, sidebar, views
│   ├── components.css         ← UI kit partilhado (.btn, .chip, .seg, .page-head, .empty-state, modals, palette)
│   └── views/                 ← um CSS por secção (home, games, explorer, noticias, f1, …)
├── js/
│   ├── core/                  ← i18n, nav, main, time (AppTime), search, settings, icons, command-palette, otd-lib, parallax, motion (Anime.js)
│   ├── pages/                 ← tools, cheatsheets, photography, visual, links, noticias, humor, oss, discovery, rss
│   ├── explorer/              ← explorer hub + realtime, solar, galaxy, body, portugal, timeline, data (mundo), kb, eventos, ocorrencias
│   ├── games/                 ← game-host + jogos (game-*.js) + game-progress + vendor (chess.js)
│   ├── quiz/                  ← quiz-engine, quiz-data, quiz-providers, quiz-page
│   ├── f1/                    ← f1-data (OpenF1/Jolpica) + UI
│   └── vendor/                ← libs vendorizadas
├── src/
│   ├── core/                  ← store.js (localStorage+pub/sub), events.js (event bus)
│   └── games/engine/          ← canvas, particles, audio, input, storage, gamedata
├── data/                      ← JSON gerado/curado (ver "Pipeline de dados")
├── quizzes/                   ← base de perguntas offline por quiz/língua/dificuldade
├── tools/                     ← scripts de build/curadoria offline (anatomy, explore, f1) — não são servidos
├── assets/ · img/ · games/    ← media e assets estáticos
└── .github/workflows/         ← 8 workflows de refresh de dados
```

### Padrão de módulos

Todos os ficheiros JS usam IIFE que exporta um global único:

```javascript
const ModuleName = (function () {
  // estado privado
  return { publicAPI };
})();
```

Comunicação entre módulos via esses globais (`Nav.go('tools')`, `I18n.t('key')`, `Store`, `Events`) — sem ES modules; a ordem dos `<script defer>` no `index.html` resolve dependências. Exceção: `i18n.js` carrega no `<head>` para fixar a língua antes do render.

### Relógio único — AppTime

`js/core/time.js` (**AppTime**) é a única fonte de data/hora da aplicação. Emite eventos `time:day` / `time:period` que atualizam toda a UI dependente de data (saudação, efemérides, útil hoje). **Nunca** ler `new Date()` diretamente para lógica de dia — subscrever o AppTime.

### Routing

Hash-based via `js/core/nav.js`. Rotas: `home · links · tools · cheatsheets · games · quiz · humor · explorer · ocorrencias · eventos · noticias · f1 · oss · discovery · photography · visual · settings`. Suporta sub-rotas (`#oss/owner/name`, `#discovery/gaming`, `#explorer/kb`). Cada rota ativa uma `.view` e o estado da sidebar. **Não existe bottom-nav mobile** (removido de propósito — não reintroduzir).

### Núcleo partilhado

| Módulo | API |
|--------|-----|
| `Store` (`src/core/store.js`) | `set/get`, `on(key, fn)` (pub/sub), `ns('games')` (namespaces) sobre localStorage |
| `Events` (`src/core/events.js`) | `on / emit / once` — bus global desacoplado |
| `CanvasEngine` | loop RAF responsivo + ResizeObserver |
| `Particles` / `GameAudio` / `GameInput` | partículas, sons Web Audio, teclado + D-pad touch |
| `GameStorage` / `GameProgress` | highscores, níveis, stats unificados por jogo |
| `otd-lib` (`js/core/otd-lib.js`) | reconstrói o painel de descoberta em direto a partir da Wikimedia quando o `today.json` está desatualizado |
| `PhotoLab` (`js/pages/photo-lab.js`) | motor de revelação em canvas: exposição, tonalidade, curva, HSL por banda, tonalidade separada e primitivas de *look* (`fade`, `grain`, `bloom`, `halation`, `vignette`) |
| `PhotoLearn` (`js/pages/photo-learn.js`) | componentes de aprendizagem visual da Fotografia (ver abaixo) |

#### PhotoLearn — componentes de aprendizagem visual

Todos devolvem HTML e ficam inertes até `PhotoLearn.wire(scope, onGo)`; uma só
chamada liga tudo o que está dentro, o que importa porque as secções da
Fotografia re-renderizam inteiras. Reutilizados na Visão de cada género, nos
Estilos, nas Técnicas, em Ler fotografias e no visualizador de Composição.

| Componente | O que ensina |
|-----------|--------------|
| `compare(o)` | A/B em três modos — **lado a lado** (cenas diferentes: vê-se a decisão inteira), **cortina** (pares alinhados), **alternar** (diferenças subtis). O modo fica guardado por família (`fam`). |
| `hotspots(o)` | Fotografia anotada: pontos numerados e mudos até ao toque, para o olho procurar antes de ler |
| `pick(o)` | "Qual é a mais forte?" — a resposta só aparece depois da escolha |
| `look(o)` | Laboratório ao vivo sobre o PhotoLab: cursor de dose, troca da fotografia de base, receita com valores reais |
| `crop(o)` | Escolher o corte e ver, ao lado, o que a fotografia passa a ser |
| `sequence(o)` | Sequências de 3+ imagens. `steps` avança uma de cada vez e mantém as anteriores no ecrã (ambiguidade); `strip` mostra tudo junto porque é a relação que ensina (série) |
| `reveal(o)` / `drill(o)` | Linha que esconde a resposta / exercício com estado em localStorage |
| `lesson(o)` / `chips(o)` | Esqueleto da lição (ideia → ver → levar → treinar) e ligações cruzadas via `data-go` |

`compare(o)` aceita `neutral: true` — marcadores azuis e ◆ em vez de verde/vermelho
e ✓/✗. Existe porque nem toda a comparação tem um lado melhor: complementares ×
análogas, ou dois enquadramentos igualmente honestos do mesmo acontecimento.
Pintá-las de verde e vermelho ensinaria o contrário do que a lição diz.

Os chips `data-go` (`g:`, `look:`, `tec:`, `know:`, `comp:`, `apr:`, `tool:`,
`etool:`, `edicao`) são resolvidos por `plGo()` em `photography.js` — é o que
permite uma lição apontar para outra sem saber nada sobre rotas.
`resolveLinks(list, head)` transforma uma lista destes alvos em chips com o
nome procurado no DB em runtime; os dados guardam só o id.

#### Cheatsheets = infografias de consulta (ago/2026)

Um cheatsheet **não é um artigo curto**: é uma infografia que se lê a olhar,
com a câmara na mão. Regra editorial: **o visual manda, o valor vem em grande,
o texto é uma linha**. Se um bloco precisa de um parágrafo, pertence a Aprender.

| Secção | Responde a |
|--------|-----------|
| **Cheatsheets** | "preciso desta resposta agora" |
| **Aprender** | "quero perceber isto" |
| **Ferramentas** | "quero calcular isto" |

- **Motor visual:** `js/pages/photo-cards.js` (`PhotoCard`) — primitivas SVG
  parametrizadas + 8 tipos de bloco (`strip · grid · versus · diagram · rules ·
  steps · table · note`) pedidos pelo JSON. Cai para o `PhotoIllus` quando a
  ilustração já existe, para não redesenhar o que o portal já sabe desenhar.
- **Diagramas calculados, não decorativos:** a régua de profundidade de campo
  usa a fórmula real (hiperfocal + planos próximo/distante) com o círculo de
  confusão da câmara escolhida (`coc: "auto"` no JSON); as cunhas de campo de
  visão usam 2·atan(18/f); o diafragma tem o diâmetro proporcional a 1/N.
- **Progressões = uma fotografia, uma variável.** ISO, exposição, temperatura,
  abertura e obturador são calculados **ao vivo** sobre UMA imagem do projeto
  pelo `PhotoLab` (que ganhou para isso `motion` e `defocus`, neutros a 0).
  Cinco fotografias diferentes ensinariam mal — mudava tudo ao mesmo tempo. As
  tiras identificam-se com o selo **"simulado"**.
- **Um género é UMA página.** As fichas específicas vêm todas empilhadas com
  uma barra de saltos sticky; `cs:g/<género>/<ficha>` salta para a âncora em
  vez de abrir outra página. Consulta rápida não pode custar três cliques.
- **Fichas de género só existem se a resposta mudar** por ser aquele género
  (`data/photo/cheats-genre.json`, 8 géneros). Repetir o cartão geral dentro de
  um género é conteúdo a mais, não conteúdo específico.
- **Capas:** grupos `cheat-ico`, `apr-ico`, `eq-ico` e `tool-ico` do photogen,
  todos no estilo `genre_icon` — o mesmo dos ícones de género, para o portal
  inteiro ler como um sistema só. **A fronteira:** este estilo serve para
  IDENTIDADE (capas, ícones, tiles). As imagens que **são** a lição — pares de
  Composição, pares da Visão, bases dos Estilos, Técnicas, "Ler fotografias",
  luz natural de retrato — continuam a ser fotografia, porque a lição é olhar
  para uma fotografia e lê-la.

#### Fronteiras entre capítulos (auditoria ago/2026)

O que decide em que capítulo um conceito vive:

| Capítulo | Responde a | Fronteira |
|----------|-----------|-----------|
| **Visão** | o que quero dizer | intenção, narrativa, atmosfera |
| **Fundamentos** | como a fotografia funciona | exposição, ótica, foco, ficheiro |
| **Composição** | como se organiza o enquadramento | as **regras** (onde pôr) + as **decisões** (de onde fotografar, `craft.json`) |
| **Cores** | como a cor comunica | o que uma decisão de cor FAZ a quem vê. A roda mostra relações, a Edição os controlos, os Estilos são receitas — Cores é a camada do meio, e não explica cursores |
| **Estilos** | que linguagem visual escolho | receitas de look aplicadas ao vivo |
| **Técnicas** | que procedimento produz este resultado | algo que de outra maneira não se obtinha (panning, halação, dupla exposição) |
| **Edição** | como se manipula o ficheiro | os controlos, em qualquer programa |

**Composição — regra dos pares (ago/2026).** Os dois lados de uma comparação
têm de ser a MESMA situação fotográfica, mudando **uma só** decisão de
enquadramento. Os rótulos são `✓ Aplica` / `↔ Não aplica`, nunca
correto/incorreto: as duas fotografias são válidas e a ressalva "isto são
ferramentas, não leis" aparece **uma vez** no topo da secção. As marcações
(`draw` de cada `COMPOSITIONS`) têm de corresponder ao que está na imagem —
uma grelha que desenha uma relação inexistente é pior do que grelha nenhuma.

Regra prática que resolveu a maior duplicação: **um arranjo do enquadramento é
Composição, não Técnica.** Espaço negativo, moldura natural e âncora no
primeiro plano tinham ficha própria em Técnicas e já eram ensinados em
Composição — o significado e o limite passaram para `COMP_MEANING`, junto do
exemplo e da grelha que já lá estavam.

### Design system

- Tokens em `css/tokens.css` (superfícies, bordas, tipografia, acentos, raios, dimensões, easing).
- **Motion** (`js/core/motion.js` + anime.js v3 vendorizada): camada única de micro-interações — transição de vista com stagger, feedback de pressão em botões/cartões, entrada de modais e stagger da palette. Só transform/opacity, <400ms, tudo desligado com `prefers-reduced-motion`.
- UI kit unificado em `components.css`: `.btn`, `.chip`, `.seg`, `.page-head`, `.empty-state`.
- Ícones de chrome **exclusivamente SVG** (sem emoji na navegação); favicon SVG path-based (D dourado + planeta).
- Temas: light via `body.light`; acentos via `body.theme-*` (blue, purple, green, amber, red, cyan, terminal).
- **Cor como texto vs cor como forma.** As cores de estado (`--red`, `--green`,
  `--amber`) e o acento de cada secção (`--pg-accent`) estão afinados para brilhar
  nas superfícies escuras e, escritos sobre um cartão branco, caem para 2–3:1.
  Por isso existem tokens paralelos só para TEXTO — `--red-txt`, `--green-txt`,
  `--amber-txt`, `--blue-txt`, `--accent2-txt` e um bloco `body.light #view-*`
  que redefine cada `--pg-accent` no mesmo tom, mais escuro. Regra: **usa o token
  `-txt` quando a cor É o texto; mantém o token normal em barras, pontos, bordas
  e gráficos**, onde o contraste de leitura não se aplica.
- **Utilitários de acessibilidade** em `components.css`: `.sr-only` (título das
  secções em app-shell que não têm espaço para um cabeçalho visível) e
  `.skip-link` (a sidebar põe ~20 itens antes do conteúdo em todas as rotas).
- Fontes: Space Grotesk (títulos), Inter (UI), JetBrains Mono (código/timers).

### I18n

Dois locales: `pt` (default) e `en`. `I18n.set('en')` ou botão no header. `i18n.js` carrega síncrono para evitar flicker.

### PWA / Service worker

`sw.js` faz precache dos estáticos com `Promise.allSettled` (um ficheiro em falta não parte a instalação) e serve **`/data/*.json` em network-first** (dados frescos quando há rede, cache offline caso contrário). Bump da constante `CACHE` (`dcop7-vNNN`) invalida versões antigas.

---

## Pipeline de dados (GitHub Actions)

O padrão central do site: **Actions agendadas correm scripts Node (`build-*.mjs`), agregam APIs externas e fazem commit de JSON estático**. O browser lê só ficheiros locais — rápido, offline, sem chaves expostas.

| Workflow | Script | Output | Cadência alvo |
|----------|--------|--------|---------------|
| `home-refresh.yml` | `data/home/build-home.mjs` | `data/home/today.json` (efemérides, nascimentos, destaque, citação) | diário ~07:20 Lisboa + catch-ups |
| `utility-refresh.yml` | `data/home/build-utility.mjs` | `data/home/utility.json` (meteo, combustíveis DGEG, eletricidade indexada, feriados) | 2×/dia + catch-up |
| `news-refresh.yml` | `data/news/build-news.mjs` | `data/news/topic-*.json` (a partir de `feeds.opml`) | a cada 4h |
| `news-curate.yml` | `data/news/build-curated.mjs` | `data/news/curated/*` (edição diária curada por IA — **Notícias AI / V2**) | diário + catch-ups |
| `events-refresh.yml` | `data/events/build-nocartaz.mjs` | `data/events/nocartaz.json` + `data/events/home.json` | diário |
| `f1-refresh.yml` | `data/f1/build-f1.mjs` | `data/f1/cache.json` (calendário, resultados) | diário, pós-corridas |
| `oss-refresh.yml` | `data/oss/build-oss.mjs` | `data/oss/index.json` + `projects.json` | diário |
| `discovery-refresh.yml` | `data/discovery/gaming/build-gaming.mjs` | deals de gaming / jogos grátis | a cada 6h |
| `ocorrencias-refresh.yml` | `data/ocorrencias/build-ocorrencias.mjs` | `data/ocorrencias/ocorrencias.json` (ocorrências ANEPC ativas via fogos.pt — o fogos.pt fechou o CORS a origens externas, por isso o browser usa este snapshot same-origin como fallback sem chave) | a cada 15 min |

**Regra crítica de agendamento:** o cron do GitHub atrasa minutos a *horas*. Os workflows **nunca** testam a hora do dia como gate (um `== 07h` falhou silenciosamente durante semanas). Em vez disso, o gate é o próprio snapshot ("o `today.json` já é de hoje, Europa/Lisboa?") e vários crons espalhados pelo dia funcionam como retries — o primeiro que dispara faz o trabalho, os restantes no-op. Commits de refresh usam `[skip ci]`.

O `build-nocartaz.mjs` escreve **dois** ficheiros e decide a **categoria no build**:

- `nocartaz.json` — agenda completa (~5 meses) usada pela secção Eventos.
- `home.json` — a mesma agenda cortada aos 45 dias e sem `desc`, para o cartão
  «Eventos perto» da Home, que só mostra duas semanas e nunca pinta a descrição.
  A Home cai para o ficheiro completo se este faltar ou se o `horizon` já passou.
- `cat` — a categoria sai do `genre`/`tags` da própria fonte em vez de ser
  adivinhada no browser a partir do título. Sem isto 61% da agenda caía em
  «Outros» (um concerto anunciado como «Bryan Adams» não tem palavra-chave
  nenhuma) e o filtro de categorias era decorativo; com isto sobram ~3%, que o
  cliente ainda tenta classificar por palavras-chave.

Dados **curados offline** (não têm workflow): `data/explore/*.json` (knowledge base de temas), `data/worlddata/` (pipeline OWID+GeoNames), `data/humor/`, `data/galaxy/`, `data/anatomy/`, `quizzes/`, `data/timeline.json`, GeoJSON de Portugal e do mundo. Os scripts em `tools/` (anatomy, explore, f1) fazem a curadoria/geração local.

---

## APIs e fontes externas

### Consumidas no browser (CORS-direct, sem chave)

| API | Uso |
|-----|-----|
| **IPMA** (`api.ipma.pt`) | Previsão por cidade + avisos meteorológicos por distrito (popup do dia e Ocorrências PT) |
| **Open-Meteo** | Meteo atual/6 dias para cidade configurável |
| **Wikimedia / Wikipedia PT** (`api.wikimedia.org`) | Reconstrução live das efemérides quando o snapshot está velho (`otd-lib`) |
| **Jolpica** (`api.jolpi.ca`) | Dados históricos/calendário F1 (sucessor do Ergast) |
| **OpenF1** | Posições live/replay das corridas (canvas track-position) |
| **USGS Earthquakes** | Sismos: Ocorrências PT (bbox Portugal/Atlântico) e Terra em Tempo Real (global) |
| **API Aberta** (`api.apiaberta.pt`) | Ocorrências PT: incêndios ANEPC em direto (`/v1/anpc/incidents/active`, proxy do fogos.pt com CORS aberto) — opcional, requer chave gratuita do utilizador guardada em localStorage |
| **fogos.pt** | Ocorrências PT: fonte dos incêndios ANEPC (sistema SADO). Deixou de permitir CORS a terceiros (jul/2026) → no browser só via API Aberta ou snapshot da Action |
| **EFFIS / Copernicus** (WMS) | Ocorrências PT: camadas de focos de calor por satélite (`all.hs`) e áreas ardidas NRT (`effis.nrt.ba`) |
| **NASA EONET** | Terra em Tempo Real: vulcões, incêndios e tempestades ativos |
| **NASA GIBS** (WMS/WMTS) | Terra em Tempo Real: imagem base Blue Marble hi-res + mosaico diário de nuvens VIIRS (com cache e crossfade no cliente). Ocorrências PT: basemap «🛰 Hoje» com a imagem VIIRS do próprio dia (auto-fallback D-1/D-2) |
| **Nominatim** (OSM) | Ocorrências PT: reverse geocoding de sismos (distrito/município/freguesia) |
| **AgendaLX / e-cultura** | Eventos culturais em direto (com fallback ao seed offline) |
| **HN Algolia** | Feed Hacker News |
| **GitHub API** | Detalhe de projetos OSS |

### Consumidas nas Actions (build-time)

DGEG preços de combustíveis · nocartaz.pt · feeds RSS via OPML (notícias) · lojas de gaming (deals) · OWID / World Bank / GeoNames (pipeline Dados do Mundo, offline).

### Embeds/CDN opcionais

Google Fonts (CSS), Excalidraw (whiteboard), tiles de mapa (Carto/Esri/OSM) para Leaflet. Todo o resto é vendorizado ou local.

---

## Convenções e regras do projeto

1. **Sem backend, sem build no cliente** — qualquer feature nova tem de funcionar como estático no GitHub Pages.
2. **AppTime é o único relógio** — UI de data reage a `time:day`/`time:period`.
3. **Actions nunca com gate por hora do dia** — gate pelo estado do snapshot (ver acima).
4. **Assets só CC0/MIT/CC-BY/originais** — registar em `ASSET-REGISTRY.json`; preferir procedural/próprio.
5. **Chrome da UI só com ícones SVG**; não reintroduzir bottom-nav mobile.
6. **Nunca commitar chaves** — se um serviço exige chave, corre na Action com secret. Secrets em uso: `TMDB_KEY` (trailers), `ITAD_KEY` (deals), `GROQ_KEY` (Notícias AI). Todos opcionais: sem a chave, o build salta esse bloco e não estraga nada.
7. **Dados primeiro** — conteúdo (quizzes, humor, temas, timeline) vive em JSON, não em código.
8. **PT-first** — strings novas passam pelo `I18n` com pt e en.

---

## Desenvolvimento

Sem instalação. Servir a raiz com qualquer servidor estático:

```bash
python -m http.server 8080   # ou: npx serve .
```

> Para testar o service worker é preciso servir por HTTP (não `file://`). Após alterar estáticos, fazer bump ao `CACHE` em `sw.js`.

### Adicionar uma tool
1. Botão na sidebar de tools no `index.html`; 2. `<div id="tool-<nome>" class="tool-panel">`; 3. lógica no IIFE `Tools` em `js/pages/tools.js`.

### Adicionar um jogo
1. `js/games/game-<id>.js` com IIFE que exporta `{ init(container) }`; 2. registar no `GAMES`/`registry` de `game-host.js`; 3. pane no `index.html`; 4. `<script defer>` antes do `game-host.js`. Usar `GameProgress` para progresso.

### Adicionar um quiz
Criar `quizzes/<id>/{pt,en}/{easy,medium,hard}.json` (cada pergunta com `exp` — facto explicativo) e registar em `js/quiz/quiz-data.js`.

### Adicionar um tema ao Explorar (KB)
Criar `data/explore/<tema>.json` seguindo a estrutura Área→Tema→Subtema→Conteúdo (ver `jogos.json` como modelo) e referenciar no `index.json`.

### Adicionar uma fonte de notícias
Acrescentar o feed ao `data/news/feeds.opml` com o tópico certo; o workflow trata do resto.

### Estilo canónico de imagens geradas (personagem 3D "em casa")
Receita para gerar imagens de demonstração/ilustração consistentes (usada na experiência Fitness de jul/2026; reutilizável em futuras secções). ComfyUI local: JuggernautXL/SDXL, dpmpp_2m/karras, cfg 5.5, 30 steps; retrato 896×1152 para poses de pé/sentado, paisagem 1152×896 para poses de chão. ChatGPT: 1024×1536 / 1536×1024.

**Boneco 3D (personagem canónica):** jovem adulto masculino em render 3D estilizado tipo Pixar, cabelo castanho curto, **t-shirt cinzenta escura lisa** (contraste com o fundo claro) e calções pretos lisos, descalço ou ténis discretos sem marca, corpo inteiro visível da cabeça aos pés, expressão calma, proporções realistas suaves, sombreado limpo de animação 3D de alta qualidade.

**Fundo (cenário canónico):** sala moderna minimalista com chão em madeira clara e parede cinzenta suave, criando um ambiente limpo e acolhedor. Uma grande janela lateral deixa entrar luz natural, iluminando o espaço e destacando naturalmente o exercício. Alguns elementos discretos, como uma planta e acessórios de treino organizados (tapete de exercício cinzento nas poses de chão), dão realismo sem distrair da demonstração. O objetivo é transmitir a sensação de que qualquer utilizador consegue fazer o exercício confortavelmente em casa.

**Prompt EN usado (template):**
```
stylized 3d render, pixar style young man with short brown hair wearing a plain dark gray
t-shirt and plain black shorts, <DESCRIÇÃO DA POSE>, full body visible from head to feet,
nothing cropped, in a bright modern minimalist living room, light wood floor, soft warm
gray wall, large side window with soft natural daylight, a potted plant and neatly arranged
home workout accessories in the background, clean smooth cgi character, high quality 3d
animation render, soft ambient lighting, instructional exercise demonstration, clear readable pose
```
**Negative prompt base:** `photo, photograph, photorealistic, realistic skin texture, text, watermark, words, letters, logo, brand, nike, adidas, blurry, low quality, lowres, ugly, deformed, extra limbs, extra arms, three arms, extra legs, bad anatomy, malformed hands, cropped, cut off, out of frame, second person, duplicate person, nude, shirtless` — acrescentar negativos de pose conforme o movimento (ex.: `arms raised, hands behind head` quando os braços devem ficar em baixo; `both arms raised, two hands on head` quando só um braço sobe). Descrever a pose com termos inequívocos (e nomes de yoga quando existam: balasana, bhujangasana, baddha konasana) e gerar 3+ seeds, escolhendo a melhor. Comprimir para JPEG ~60-90 KB antes de commitar.

**Poses difíceis → ControlNet OpenPose** (instalado 16 jul 2026): quando o prompt não chega (ex.: segurar o tornozelo atrás, braço cruzado sobre o peito), usar o ControlNet `controlnet-openpose-sdxl-xinsir.safetensors` (em `D:/AI/StabilityMatrix/Data/Models/ControlNet`, formato diffusers — o ComfyUI carrega-o nativamente). Fluxo: desenhar o esqueleto OpenPose COCO-18 (cores/ligações padrão) com `C:\tmp\fit-skeletons.cjs` (coordenadas por articulação; fundo preto, traços sólidos) e gerar com `C:\tmp\gen-cn.cjs` (grafo `ControlNetLoader`→`ControlNetApplyAdvanced` entre os CLIPTextEncode e o KSampler; **strength 1.0, end_percent 0.9** — valores mais baixos são ignorados pelo xinsir). Poses deitadas vistas de lado (ex.: figura-4 no chão) continuam pouco fiáveis — preferir variantes em pé/joelhos ou knee-hug.

### Capas das secções (`assets/{explorer,games,quiz,events}/*.jpg`)

Imagens geradas localmente pelo mesmo ComfyUI do photogen, usadas como fundo dos
cartões de Explorar, Jogos, Quizzes e Eventos. Linguagem visual comum:
**fotografia cinematográfica escura, sem texto, o assunto legível em miniatura**
— o cartão põe-lhes por cima um gradiente e o título.

- **Eventos** tem uma capa por categoria (`assets/events/<categoria>.jpg`). A
  maioria dos eventos do snapshot não traz imagem e os cartões mostravam todos o
  mesmo emoji num quadrado tingido; a capa dá assunto ao cartão sem inventar
  conteúdo, porque a categoria continua escrita ao lado.
- **Peso.** `tools/photogen/optimize-covers.mjs` recomprime estas pastas para o
  tamanho a que são de facto pintadas (mozjpeg q78; os quizzes descem para 448 px
  porque o cartão tem ~115). É idempotente — correr depois de gerar capas novas.
  O lote original estava gravado quase sem compressão: 33 MB de JPEG para pintar
  miniaturas, agora 2,4 MB.

```bash
node tools/photogen/optimize-covers.mjs --dry   # relatório
node tools/photogen/optimize-covers.mjs         # aplica
```

### Assets da Fotografia (`tools/photogen`, dev-only)
`node tools/photogen/generate.mjs --group <grupo>` gera as imagens estáticas da
secção via ComfyUI local (JuggernautXL, 32 steps) e escreve
`assets/photo/<grupo>/<id>.webp` + o índice `assets/photo/index.json`. Grupos:

| Grupo | Para quê |
|-------|----------|
| `vision` | Par por género (`vis-<id>` / `vis-<id>-flat`) — com intenção × correta e banal. Os dois prompts descrevem a MESMA cena: só muda a intenção, nunca a qualidade técnica |
| `cmp` | Pares dos princípios transversais (fundo limpo/sujo, história/registo, emoção/registo, momento, simplificar) |
| `look` | Bases NEUTRAS do laboratório de estilos (`look-retrato`, `look-cidade`, `look-praia`). Têm de ser mesmo neutras — uma base já graduada não aceita um look por cima e deixa de ensinar |
| `tec` | Exemplos das técnicas de captação (silhueta, panning, dupla exposição) |
| `comp2` | Pares de composição CONTROLADOS: mesma cena, mesma luz, muda só a decisão de enquadramento. Substituiu `comp`/`comp-bad`, onde o lado "incorreto" era muitas vezes outra fotografia perfeitamente válida |
| `comp-base` | Cenas largas de onde `derive-crops.cjs` extrai dois enquadramentos da MESMA imagem (proporção áurea, espaço negativo) |
| `cor` | Pares da secção Cores: mesma situação, muda a relação de cor |
| `seq` | Sequências de ambiguidade, série e honestidade |
| `comp` / `comp-genre*` | Sobra a Curva em S (o único par antigo que já era controlado) e as composições por género |
| `poses` / `light` / `crop` / `know` / `genre-ico` / `edit-demo` | Retrato: poses, direção de luz, onde cortar, conceitos, ícones dos géneros, foto de demonstração da Edição |

**Pares de composição.** A regra é que os dois lados sejam a mesma situação
fotográfica e mude uma só decisão de enquadramento — senão o exercício vira
"boa fotografia contra má fotografia", que é falso e ensina a desconfiar do
portal. Duas maneiras de o conseguir, por ordem de preferência:
1. **`derive-crops.cjs`** — dois enquadramentos tirados da MESMA imagem. É o
   par mais honesto que existe (mesmos píxeis) e é a única via fiável quando o
   modelo se recusa a produzir o contraexemplo (o SDXL nunca aceitou estragar
   um reflexo, por exemplo).
2. **Mesma seed + mesma descrição de cena**, mudando só a cláusula de
   composição.

**Cuidado com ids repetidos entre grupos:** `generate.mjs` usa `find` pelo id,
por isso um id existente noutro grupo faz com que as correções de prompt vão
parar ao asset errado — e ambos escrevem em `index.json`. Ao substituir um
grupo, apagar as entradas antigas do manifesto.

O site funciona sem estes ficheiros: `assetPath()` devolve `null` e cada
componente cai no seu fallback (SVG procedural do `PhotoIllus`, ou o bloco
simplesmente não aparece). Rever sempre as imagens a olho antes de commitar —
prompts de contraexemplo ("tudo desfocado", "silhueta ilegível") são os que o
SDXL mais resiste a cumprir e costumam precisar de outra abordagem à lição.
