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
| `#explorer` | **Explorar** | Hub de exploradores: Terra em Tempo Real (globo dia/noite), Sistema Solar, Galáxia, Corpo Humano 3D (three.js), Portugal (mapa concelhos), Linha do Tempo interativa, Dados do Mundo (Mundo▸Continente▸País▸Cidade), Temas (knowledge base Área→Tema→Subtema) |
| `#noticias` | **Notícias** | Agregador RSS estático por tópicos (tecnologia, IA, gaming, economia, ciência, F1, fact-check, …) — sem DB, refresh a cada 4h via Action |
| `#eventos` | **Eventos** | Descoberta de eventos em Portugal (AgendaLX, e-cultura ao vivo + seed offline), mapa Leaflet, geocoding por concelho |
| `#ocorrencias` | **Ocorrências** | Ocorrências em tempo real: sismos (USGS/IPMA), eventos naturais (NASA EONET), proteção civil |
| `#f1` | **Fórmula 1** | Secção experimental: calendário/resultados (Jolpica), posições live/replay em canvas (OpenF1), tudo CORS-direct sem backend |
| `#oss` | **Descobrir Tech** | Explorador de projetos open-source (índice gerado por Action + GitHub API) |
| `#discovery` | **Gaming Deals** | Deals de gaming e jogos grátis (refresh 6h) |
| `#tools` | **Tools** | Calculadora, pomodoro, cronómetro, editor markdown, regex tester, diff, conversores, cores, UUID, timestamps, dados 3D, … |
| `#cheatsheets` | **Cheatsheets** | Referências de comandos: Git, Linux, Vim, regex, Docker, atalhos |
| `#games` | **Jogos** | 13 jogos curados: Xadrez (chess.js vendored), Sueca (engine/IA próprios, 4 níveis), Tiro ao Arco (1ª pessoa, física de setas + vento), Batalha Naval, Uno (engine/IA próprios), Bomba, Campo Minado, Forca, Wordle, Memória, Neon Shooter, Reaction, Gravity Lab — progresso unificado via `GameProgress` |
| `#quiz` | **Quizzes** | Quizzes offline data-driven: `quizzes/<id>/<lang>/<dificuldade>.json`, cada pergunta com facto explicativo (`exp`), sem APIs |
| `#humor` | **Humor** | Piadas por categoria, data-driven (`data/humor/*.json`), ~12 categorias / centenas de entradas |
| `#links` | **Links** | Biblioteca de recursos por categoria |
| `#photography` | **Fotografia** | Portal por géneros (15 portais: paisagem, retrato, rua, astro, …) com recomendações adaptadas ao equipamento real (Canon M50 II / Galaxy S23+ / ambos), modo "No Terreno" (assistente de bolso), Aprender (fundamentos, composição, 12 técnicas de edição RapidRAW/darktable/Snapseed, roda de cores) e 7 calculadoras (`data/photo/*.json`) |
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
└── .github/workflows/         ← 7 workflows de refresh de dados
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

### Design system

- Tokens em `css/tokens.css` (superfícies, bordas, tipografia, acentos, raios, dimensões, easing).
- **Motion** (`js/core/motion.js` + anime.js v3 vendorizada): camada única de micro-interações — transição de vista com stagger, feedback de pressão em botões/cartões, entrada de modais e stagger da palette. Só transform/opacity, <400ms, tudo desligado com `prefers-reduced-motion`.
- UI kit unificado em `components.css`: `.btn`, `.chip`, `.seg`, `.page-head`, `.empty-state`.
- Ícones de chrome **exclusivamente SVG** (sem emoji na navegação); favicon SVG path-based (D dourado + planeta).
- Temas: light via `body.light`; acentos via `body.theme-*` (blue, purple, green, amber, red, cyan, terminal).
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
| `events-refresh.yml` | `data/events/build-nocartaz.mjs` | `data/events/nocartaz.json` | diário |
| `f1-refresh.yml` | `data/f1/build-f1.mjs` | `data/f1/cache.json` (calendário, resultados) | diário, pós-corridas |
| `oss-refresh.yml` | `data/oss/build-oss.mjs` | `data/oss/index.json` + `projects.json` | diário |
| `discovery-refresh.yml` | `data/discovery/gaming/build-gaming.mjs` | deals de gaming / jogos grátis | a cada 6h |

**Regra crítica de agendamento:** o cron do GitHub atrasa minutos a *horas*. Os workflows **nunca** testam a hora do dia como gate (um `== 07h` falhou silenciosamente durante semanas). Em vez disso, o gate é o próprio snapshot ("o `today.json` já é de hoje, Europa/Lisboa?") e vários crons espalhados pelo dia funcionam como retries — o primeiro que dispara faz o trabalho, os restantes no-op. Commits de refresh usam `[skip ci]`.

Dados **curados offline** (não têm workflow): `data/explore/*.json` (knowledge base de temas), `data/worlddata/` (pipeline OWID+GeoNames), `data/humor/`, `data/galaxy/`, `data/anatomy/`, `quizzes/`, `data/timeline.json`, GeoJSON de Portugal e do mundo. Os scripts em `tools/` (anatomy, explore, f1) fazem a curadoria/geração local.

---

## APIs e fontes externas

### Consumidas no browser (CORS-direct, sem chave)

| API | Uso |
|-----|-----|
| **IPMA** (`api.ipma.pt`) | Previsão por cidade + avisos meteorológicos (popup do dia) |
| **Open-Meteo** | Meteo atual/6 dias para cidade configurável |
| **Wikimedia / Wikipedia PT** (`api.wikimedia.org`) | Reconstrução live das efemérides quando o snapshot está velho (`otd-lib`) |
| **Jolpica** (`api.jolpi.ca`) | Dados históricos/calendário F1 (sucessor do Ergast) |
| **OpenF1** | Posições live/replay das corridas (canvas track-position) |
| **USGS Earthquakes** + **NASA EONET** | Ocorrências: sismos e eventos naturais |
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
6. **Nunca commitar chaves** — se um serviço exige chave, corre na Action com secret.
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
