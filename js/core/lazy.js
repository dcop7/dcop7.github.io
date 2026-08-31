/* ══════════════════════════════════════════════════════════════════
   LAZY — carregamento do código de cada secção a pedido
   ──────────────────────────────────────────────────────────────────
   O index.html carregava os ~78 ficheiros de TODAS as secções em
   <script defer>, por isso quem abria a Home esperava pelo Xadrez, pela
   Fórmula 1 e pela Fotografia antes de a página arrancar: 2,7 MB de JS
   no caminho crítico e DOMContentLoaded a 18 s num telemóvel a 1,6 Mbps.

   Aqui ficam apenas os módulos que a Home e o chrome do site NÃO usam.
   O `nav.js` chama `Lazy.ensure(rota)` antes de invocar o `Page.show()`
   dessa rota — e como o `renderView` já protegia cada chamada com
   `typeof XPage !== 'undefined'`, um módulo que ainda não chegou nunca
   parte a navegação, apenas não pinta nada até chegar.

   Ordem: os scripts inseridos por JS são `async` por omissão. Com
   `async = false` mantêm a semântica do `defer` — descarregam em
   paralelo mas executam pela ordem de inserção, que é o que os IIFE
   deste projeto precisam (o `game-host` depende dos `game-*`, o
   `photography` depende do `photo-lab`, etc.).
   ══════════════════════════════════════════════════════════════════ */
const Lazy = (function () {
  'use strict';

  const GAMES = [
    'src/games/engine/canvas.js',
    'src/games/engine/particles.js',
    'src/games/engine/audio.js',
    'src/games/engine/input.js',
    'src/games/engine/storage.js',
    'src/games/engine/gamedata.js',
    'js/games/game-progress.js',
    'js/games/game-wordle.js',
    'js/games/minesweeper.js',
    'js/games/bomb.js',
    'js/games/game-memory.js',
    'js/games/game-reaction.js',
    'js/games/vendor/chess.min.js',
    'js/games/game-chess.js',
    'js/games/game-battleship.js',
    'js/games/game-uno.js',
    'js/games/game-sueca.js',
    'js/games/game-dobble.js',
    'js/games/game-neon-shooter.js',
    'js/games/game-gravity-lab.js',
    'js/games/hangman.js',
    'js/games/game-host.js',
  ];

  const MAP = {
    games:       GAMES,
    quiz:        ['js/quiz/quiz-engine.js', 'js/quiz/quiz-data.js', 'js/quiz/quiz-providers.js', 'js/quiz/quiz-page.js'],
    tools:       ['js/pages/dice3d.js', 'js/pages/tools.js'],
    links:       ['js/pages/links-page.js'],
    visual:      ['js/pages/visual.js'],
    humor:       ['js/pages/humor.js'],
    cheatsheets: ['js/pages/cheatsheets.js'],
    photography: [
      'js/pages/photo-illus.js',
      'js/pages/photo-mannequin.js',
      'js/pages/photo-lab.js',
      'js/pages/photo-editlab.js',
      'js/pages/photo-learn.js',
      'js/pages/photo-lightart.js',
      'js/pages/photo-cards.js',
      'js/pages/photo-cheats.js',
      'js/pages/photography.js',
    ],
    explorer: [
      'js/explorer/pt-concelhos-info.js',
      'js/explorer/explorer-portugal.js',
      'js/explorer/explorer.js',
      'js/explorer/explorer-solar.js',
      'js/explorer/explorer-galaxy.js',
      'js/explorer/explorer-realtime.js',
      'js/explorer/explorer-body.js',
      'js/explorer/explorer-timeline-interactive.js',
      'js/explorer/explore-kb.js',
      'js/explorer/explorer-timeline.js',
      'js/explorer/explorer-data.js',
    ],
    ocorrencias: ['js/explorer/ocorrencias.js'],
    eventos:     ['js/explorer/eventos.js'],
    noticias:    ['js/pages/noticias.js', 'js/pages/noticias-destaques.js'],
    cidadao:     ['js/pages/cidadao.js'],
    f1:          ['js/f1/f1-data.js', 'js/f1/f1-espn.js', 'js/f1/f1-track.js', 'js/f1/f1-page.js'],
    oss:         ['js/pages/oss.js'],
    discovery:   ['js/pages/discovery.js'],
  };


  /* ── CSS por rota ───────────────────────────────────────────────
     As 23 folhas de estilo eram todas render-blocking no <head>:
     687 KB antes do primeiro pixel. Estas são exclusivas de uma
     secção, e como as .view estão vazias no HTML (o conteúdo é todo
     pintado por JS depois do ensure()), carregá-las a pedido não
     causa flash — nada aparece antes de o CSS chegar.

     Ficam no <head>, sempre: tokens · base · layout · components ·
     home (rota de entrada) · features (traz os `ph-*` de estado
     vazio e o modal partilhado, usados por meia dúzia de secções). */
  const CSS = {
    explorer:    ['css/views/explorer.css', 'css/views/explore-kb.css', 'css/views/worlddata.css', 'css/views/explorer-body.css'],
    ocorrencias: ['css/views/ocorrencias.css'],
    eventos:     ['css/views/eventos.css'],
    noticias:    ['css/views/noticias.css', 'css/views/noticias-destaques.css'],
    cidadao:     ['css/views/cidadao.css'],
    f1:          ['css/views/f1.css'],
    oss:         ['css/views/oss.css'],
    discovery:   ['css/views/discovery.css'],
    quiz:        ['css/views/quiz.css'],
    games:       ['css/views/games.css'],
    /* games.css também define o lançador de dados (.dice-*), que vive
       nas Ferramentas — não é engano. */
    tools:       ['css/views/tools.css', 'css/views/games.css'],
    photography: ['css/views/photo-learn.css', 'css/views/photo-cheats.css'],
  };

  const _script = Object.create(null);   // src → Promise (resolve-once)

  function load(src) {
    if (_script[src]) return _script[src];
    return (_script[src] = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      /* defer-like: paralelo a descarregar, sequencial a executar. */
      s.async = false;
      /* Um módulo em falta degrada a secção; nunca pode deixar a
         navegação pendurada, por isso o erro também resolve. */
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    }));
  }

  const _sheet = Object.create(null);     // href → Promise (resolve-once)

  function loadCss(href) {
    if (_sheet[href]) return _sheet[href];
    return (_sheet[href] = new Promise(resolve => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = l.onerror = () => resolve();
      document.head.appendChild(l);
    }));
  }

  /* Devolve sempre uma Promise, mesmo para rotas sem recursos próprios
     (home, settings, search), para o nav ter um só caminho de código.
     O CSS entra no mesmo Promise.all que o JS: quando o nav pinta, os
     estilos da secção já lá estão. */
  function ensure(route) {
    const js = MAP[route], css = CSS[route];
    if (!js && !css) return Promise.resolve();
    return Promise.all([].concat(js || [], []).map(load)
      .concat((css || []).map(loadCss)));
  }

  /* Aquecimento por intenção: o rato/dedo em cima do item da sidebar
     começa a descarregar a secção antes do clique. */
  function prefetch(route) { if (MAP[route] || CSS[route]) ensure(route); }

  return { ensure, prefetch, routes: Object.keys(MAP) };
})();
