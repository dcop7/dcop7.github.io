/* ══════════════════════════════════════════════════════════════════
   DripLevels — níveis do Gota a Gota (out/2026).

   Mapa: 24 × 34 células de 20 px (por baixo das 2 linhas da superfície).
   Legenda: '#' terra · 'R' pedra · 'k' pedra rachada (só a bomba parte)
            'w' água · 'p' lodo · 'l' lava · 'm' musgo · ' ' ar
            'G' vaso do Rebento (canto sup. esq. de 3×2) · 'F' turbina
            'X' bomba · 'H' placa quente · 'C' nuvem fria · 'O' torneira
            'a'/'b'/'c' copo que abre a comporta 'A'/'B'/'C' · 'V' válvula
   Cada nível é desenhado com um pequeno construtor (g) em vez de ASCII à
   mão (menos erros) e traz a solução `sol` — traços de escavação {d} e
   toques {tap} em coordenadas de célula — que o verificador em Node
   (node_modules/.drip-check.cjs) corre para provar que o nível se faz
   com as 3 turbinas.
══════════════════════════════════════════════════════════════════ */
const DripLevels = (function () {
  'use strict';
  const C = 24, R = 34;

  function grid() {
    const m = Array.from({ length: R }, () => Array(C).fill('#'));
    const g = {
      m,
      put(x, y, ch) { if (x >= 0 && y >= 0 && x < C && y < R) m[y][x] = ch; },
      rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.put(x, y, ch); },
      /* bacia: líquido em [x0..x1]×[y0..y1] com paredes de pedra dos lados e (opcional) fundo de pedra */
      basin(x0, y0, x1, y1, ch, o) {
        o = o || {};
        g.rect(x0, y0, x1, y1, ch || 'w');
        if (o.walls !== false) { g.rect(x0 - 1, y0 - (o.lip || 0), x0 - 1, y1 + 1, 'R'); g.rect(x1 + 1, y0 - (o.lip || 0), x1 + 1, y1 + 1, 'R'); }
        if (o.floor) g.rect(x0 - 1, y1 + 1, x1 + 1, y1 + 1, 'R');
        if (o.air) g.rect(x0, y0 - o.air, x1, y0 - 1, ' ');
      },
      /* vaso: G + ar 3×2, pedra por baixo e dos lados */
      pot(x, y) {
        g.rect(x, y, x + 2, y + 1, ' '); g.put(x, y, 'G');
        g.rect(x - 1, y + 2, x + 3, y + 2, 'R'); g.rect(x - 1, y, x - 1, y + 1, 'R'); g.rect(x + 3, y, x + 3, y + 1, 'R');
      },
      bud(x, y) { g.put(x, y, 'F'); },
      floor(y) { g.rect(0, y, C - 1, R - 1, 'R'); },
      air(x0, y0, x1, y1) { g.rect(x0, y0, x1, y1, ' '); },
    };
    return g;
  }

  const CHAPTERS = [
    { name: 'Primeiras Gotas', icon: '💧', desc: 'Escava caminhos e liga as turbinas.', grad: ['#3fb6ff', '#1d6fa8'] },
    { name: 'Lodo e Musgo', icon: '🟣', desc: 'O lodo anula a água; o musgo bebe-a. Comportas coloridas.', grad: ['#a855f7', '#5b21b6'] },
    { name: 'Rio de Lava', icon: '🌋', desc: 'Lava + água = pedra e vapor. Nuvens frias fazem chover.', grad: ['#f97316', '#9a3412'] },
    { name: 'Engenhocas', icon: '⚙️', desc: 'Bombas, válvulas, torneiras e tudo junto.', grad: ['#64748b', '#1e293b'] },
    { name: 'Grutas Fundas', icon: '💎', desc: 'Caminhos compridos, grutas sedentas e pouca água.', grad: ['#2dd4bf', '#0f766e'] },
    { name: 'Laboratório Roxo', icon: '🧪', desc: 'Lodo, musgo e comportas — agora a sério.', grad: ['#d946ef', '#701a75'] },
    { name: 'Fogo e Vapor', icon: '🔥', desc: 'Lava, pedra, vapor e chuva das nuvens frias.', grad: ['#fb7185', '#9f1239'] },
    { name: 'Mestre da Água', icon: '🏆', desc: 'Bombas, válvulas, torneiras e tudo o que aprendeste.', grad: ['#fbbf24', '#92400e'] },
  ];

  const L = [];
  function lvl(id, name, o, build, sol) {
    L.push(Object.assign({ id, name, build, sol }, o));
  }

  /* ═════════ capítulo 1 — Primeiras Gotas ═════════ */
  lvl('c1-1', 'Primeira Gota', { chapter: 0, need: 70, tip: 'Arrasta o dedo pela terra, da água até ao vaso do Rebento.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.pot(10, 27);
    g.bud(12, 9); g.bud(11, 15); g.bud(12, 21);
  }, [{ d: [[11.5, 4.2], [12.5, 9.5], [11.5, 15.5], [12.5, 21.5], [11.5, 27]] }]);

  lvl('c1-2', 'A Curva', { chapter: 0, need: 70, tip: 'A pedra cinzenta não se escava — contorna-a.' }, g => {
    g.floor(30);
    g.basin(2, 1, 7, 3, 'w', { air: 1 });
    g.rect(0, 12, 15, 13, 'R');
    g.pot(18, 27);
    g.bud(5, 9); g.bud(18, 10); g.bud(19, 20);
  }, [{ d: [[4.5, 4.2], [5.5, 9.5], [10, 10.5], [18.5, 10.5], [18.5, 20.5], [19.5, 27]] }]);

  lvl('c1-3', 'Duas Poças', { chapter: 0, need: 150, tip: 'Uma poça não chega: junta as duas.' }, g => {
    g.floor(30);
    g.basin(2, 2, 6, 4, 'w', { air: 1 }); g.basin(17, 2, 21, 4, 'w', { air: 1 });
    g.rect(8, 6, 15, 7, 'R');
    g.pot(10, 27);
    g.bud(4, 12); g.bud(19, 12); g.bud(11, 20);
  }, [{ d: [[4.5, 5.2], [4.5, 12.5], [11.5, 17], [11.5, 27]] }, { d: [[19.5, 5.2], [19.5, 12.5], [11.5, 17]] }, { d: [[11.5, 17], [11.5, 20.5]] }]);

  lvl('c1-4', 'Gruta Gulosa', { chapter: 0, need: 90, tip: 'Grutas vazias enchem-se de água. Não as abras sem querer!' }, g => {
    g.floor(30);
    g.basin(10, 1, 15, 3, 'w', { air: 1 });
    g.air(1, 9, 7, 14); g.air(16, 15, 22, 20);
    g.rect(9, 12, 14, 12, 'R');
    g.pot(10, 27);
    g.bud(15, 9); g.bud(13, 14); g.bud(11, 22);
  }, [{ d: [[12.5, 4.2], [15.5, 9.5], [15.5, 13.5], [11.5, 16], [11.5, 27]] }, { d: [[11, 22.5], [11.5, 22.5]] }]);

  lvl('c1-5', 'Zigue-Zague', { chapter: 0, need: 90, tip: 'Desce pelas prateleiras de pedra.' }, g => {
    g.floor(30);
    g.basin(2, 1, 8, 3, 'w', { air: 1 });
    g.rect(0, 8, 16, 8, 'R'); g.rect(7, 15, 23, 15, 'R'); g.rect(0, 22, 16, 22, 'R');
    g.pot(10, 27);
    g.bud(20, 6); g.bud(3, 13); g.bud(20, 20);
  }, [{ d: [[5.5, 4.2], [8, 6.5], [20.5, 6.5], [20.5, 11.5], [3.5, 12.5], [3.5, 18.5], [20.5, 19.5], [20.5, 24.5], [11.5, 25], [11.5, 27]] }]);

  lvl('c1-6', 'Vasos Comunicantes', { chapter: 0, need: 80, tip: 'A água sobe pelo outro lado de um "U" — desde que a poça esteja mais alta.' }, g => {
    g.floor(30);
    g.basin(1, 0, 7, 6, 'w');
    g.rect(9, 0, 10, 12, 'R');
    g.pot(15, 12); g.rect(12, 8, 21, 8, 'R');
    g.bud(4, 11); g.bud(11, 14); g.bud(13, 10);
  }, [{ d: [[4.5, 7.2], [4.5, 14.5], [12.5, 14.5], [12.5, 10.5], [16.5, 10.5], [16.5, 12]] }]);

  lvl('c1-7', 'Gotas Contadas', { chapter: 0, need: 120, tip: 'Pouca água: cada desvio conta. As turbinas também gastam!' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.basin(1, 10, 4, 11, 'w', { air: 0 });
    g.rect(6, 14, 18, 14, 'R');
    g.pot(10, 27);
    g.bud(6, 8); g.bud(3, 17); g.bud(13, 21);
  }, [{ d: [[11.5, 4.2], [6.5, 8.5], [2.5, 12.2], [3.5, 17.5], [10, 21], [13.5, 21.5], [11.5, 27]] }]);

  lvl('c1-8', 'Labirinto', { chapter: 0, need: 70, tip: 'Encontra o caminho entre as pedras — a água só desce, nunca sobe.' }, g => {
    g.floor(30);
    g.basin(1, 0, 6, 3, 'w');
    g.air(9, 2, 11, 4);
    g.rect(0, 6, 15, 6, 'R'); g.rect(11, 7, 11, 10, 'R');
    g.rect(6, 12, 23, 12, 'R'); g.rect(12, 13, 12, 16, 'R');
    g.rect(0, 18, 17, 18, 'R'); g.rect(14, 19, 14, 21, 'R');
    g.rect(6, 23, 23, 23, 'R'); g.air(14, 25, 18, 27);
    g.pot(2, 27);
    g.bud(14, 10); g.bud(7, 17); g.bud(19, 21);
  }, [{ d: [[3.5, 4.2], [4, 5.4], [17.5, 5.2], [18.5, 8], [18.5, 10.5], [3.5, 11.6], [3.5, 13], [3, 16.6], [11, 17.35], [13.5, 17.4], [19.5, 17.6], [20.5, 19], [20.5, 21.5], [3.5, 22.6], [3.5, 27]] }, { d: [[14.5, 10.5], [14.5, 11.5]] }, { d: [[19.5, 21.5], [19.5, 22.2]] }]);

  lvl('c1-9', 'Chuva Miúda', { chapter: 0, need: 110, tip: 'A água está espalhada em bolsinhas. Junta-as todas.' }, g => {
    g.floor(30);
    [[2, 2], [8, 4], [14, 2], [20, 4], [5, 9], [17, 9]].forEach(([x, y]) => g.rect(x, y, x + 1, y + 1, 'w'));
    g.rect(0, 14, 9, 14, 'R'); g.rect(14, 14, 23, 14, 'R');
    g.pot(10, 27);
    g.bud(11, 8); g.bud(11, 17); g.bud(6, 23);
  }, [{ d: [[2.5, 3.5], [8.5, 5.5], [11.5, 8.5], [14.5, 3.5]] }, { d: [[20.5, 5.5], [17.5, 10.5], [11.5, 12.5]] }, { d: [[5.5, 10.5], [11.5, 12.5], [11.5, 17.5], [6.5, 23.5], [11.5, 25.5], [11.5, 27]] }]);

  lvl('c1-10', 'Cascata', { chapter: 0, need: 160, tip: 'Muita água, muito longe. Faz uma cascata!' }, g => {
    g.floor(30);
    g.basin(16, 1, 22, 5, 'w', { air: 1 });
    g.rect(9, 9, 23, 9, 'R'); g.rect(0, 17, 19, 17, 'R'); g.rect(4, 24, 23, 24, 'R');
    g.pot(2, 27);
    g.bud(3, 7); g.bud(16, 15); g.bud(12, 21);
  }, [{ d: [[19.5, 6.2], [8, 7.5], [3.5, 7.5], [4.5, 10], [4.5, 15.5], [16.5, 15.5], [21.5, 16], [21.5, 19], [12.5, 21.5], [2.5, 22.5], [3.5, 27]] }]);

  /* ═════════ capítulo 2 — Lodo e Musgo ═════════ */
  lvl('c2-1', 'Lodo à Vista', { chapter: 1, need: 70, tip: 'O lodo roxo anula a água e faz mal ao Rebento. Não o deixes chegar ao vaso!' }, g => {
    g.floor(30);
    g.basin(2, 1, 7, 3, 'p', { air: 1 }); g.basin(15, 1, 20, 3, 'w', { air: 1 });
    g.rect(0, 9, 10, 9, 'R');
    g.pot(10, 27);
    g.bud(17, 9); g.bud(13, 15); g.bud(11, 21);
  }, [{ d: [[17.5, 4.2], [17.5, 9.5], [13.5, 15.5], [11.5, 21.5], [11.5, 27]] }]);

  lvl('c2-2', 'O Desvio', { chapter: 1, need: 80, tip: 'O lodo está mesmo no caminho. Passa ao lado sem lhe tocar.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.air(9, 10, 14, 13); g.rect(9, 11, 14, 13, 'p'); g.rect(8, 14, 15, 14, 'R');
    g.pot(10, 27);
    g.bud(5, 9); g.bud(5, 17); g.bud(12, 22);
  }, [{ d: [[11.5, 4.2], [8, 6.5], [5.5, 9.5], [5.5, 17.5], [12.5, 22.5], [11.5, 27]] }]);

  lvl('c2-3', 'Neutralizar', { chapter: 1, need: 70, tip: 'Água e lodo anulam-se. Gasta um pouco de água para limpar o caminho.' }, g => {
    g.floor(30);
    g.basin(8, 0, 15, 4, 'w');
    g.air(9, 12, 14, 14); g.rect(9, 13, 14, 14, 'p'); g.rect(7, 15, 8, 16, 'R'); g.rect(15, 15, 16, 16, 'R');
    g.pot(10, 27);
    g.bud(12, 8); g.bud(10, 19); g.bud(12, 23);
  }, [{ d: [[11.5, 5.2], [12, 8.5], [11.5, 12]] }, { d: [[11.5, 14.6], [10.5, 19.5], [12.5, 23.5], [11.5, 27]], t: 4 }]);

  lvl('c2-4', 'Musgo Guloso', { chapter: 1, need: 80, tip: 'O musgo verde bebe a água toda que lhe tocar — e cresce. Contorna-o!' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.rect(9, 11, 14, 15, 'm');
    g.pot(10, 27);
    g.bud(16, 9); g.bud(17, 17); g.bud(11, 22);
  }, [{ d: [[11.5, 4.2], [16.5, 9.5], [17.5, 17.5], [11.5, 22.5], [11.5, 27]] }]);

  lvl('c2-5', 'Lodo contra Musgo', { chapter: 1, need: 70, tip: 'O musgo tapa a passagem… mas o lodo mata o musgo! Depois, a água limpa o lodo que sobrar.' }, g => {
    g.floor(30);
    g.basin(2, 1, 6, 3, 'p', { air: 1 }); g.basin(15, 0, 21, 4, 'w');
    g.rect(0, 14, 23, 15, 'R'); g.rect(10, 12, 13, 15, 'm');
    g.air(9, 16, 14, 18); g.rect(8, 19, 15, 19, 'R');
    g.pot(10, 27);
    g.bud(17, 9); g.bud(14, 22); g.bud(12, 25);
  }, [{ d: [[4.5, 4.2], [8, 8], [11.5, 11.5]] }, { d: [[18, 5.2], [17.5, 9.5], [12.5, 11.2]], t: 3 }, { d: [[14.5, 18.2], [16.6, 18.4], [16.5, 20.5], [14.5, 22.5], [12.5, 25.5], [11.5, 27]], t: 9 }]);

  lvl('c2-6', 'Primeira Comporta', { chapter: 1, need: 70, tip: 'Enche o copo vermelho para abrir a comporta vermelha.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.rect(0, 18, 23, 18, 'R'); g.rect(10, 18, 12, 18, 'A');
    g.put(4, 16, 'a'); g.rect(2, 17, 6, 17, 'R');
    g.pot(10, 27);
    g.bud(12, 8); g.bud(8, 14); g.bud(11, 23);
  }, [{ d: [[11.5, 4.2], [12, 8.5], [8.5, 14.5], [4.5, 16.4]] }, { d: [[9, 15], [11.5, 17.4]] }, { d: [[11.5, 19.5], [11.5, 23.5], [11.5, 27]] }]);

  lvl('c2-7', 'Dois Copos', { chapter: 1, need: 80, tip: 'Duas comportas, dois copos. Divide bem a água.' }, g => {
    g.floor(30);
    g.basin(8, 0, 15, 3, 'w');
    g.rect(0, 12, 23, 12, 'R'); g.rect(10, 12, 13, 12, 'A'); g.put(2, 11, 'a');
    g.rect(0, 21, 23, 21, 'R'); g.rect(10, 21, 13, 21, 'B'); g.put(21, 20, 'b');
    g.pot(10, 27);
    g.bud(11, 7); g.bud(12, 16); g.bud(11, 24);
  }, [{ d: [[11.5, 4.2], [11.5, 7.5], [2.5, 11.4]] }, { d: [[11.5, 7.5], [11.5, 11.4]] }, { d: [[11.5, 13], [12.5, 16.5], [21.5, 20.4]], t: 3 }, { d: [[12.5, 16.5], [11.5, 20.4]], t: 3 }, { d: [[11.5, 22], [11.5, 24.5], [11.5, 27]], t: 3 }]);

  lvl('c2-8', 'Copo Roxo', { chapter: 1, need: 70, tip: 'O lodo também enche copos! Usa-o para abrir a comporta.' }, g => {
    g.floor(30);
    g.basin(2, 1, 6, 3, 'p', { air: 1 }); g.basin(16, 1, 21, 3, 'w', { air: 1 });
    g.rect(14, 0, 14, 20, 'R');
    g.put(4, 12, 'a'); g.rect(2, 13, 6, 13, 'R');
    g.rect(15, 20, 23, 20, 'R'); g.rect(17, 20, 19, 20, 'A');
    g.pot(17, 27);
    g.bud(18, 9); g.bud(19, 16); g.bud(18, 24);
  }, [{ d: [[4.5, 4.2], [4.5, 12.3]] }, { d: [[18.5, 4.2], [18.5, 9.5], [19.5, 16.5], [18.5, 19.4]] }, { d: [[18.5, 21], [18.5, 24.5], [18.5, 27]], t: 4 }]);

  lvl('c2-9', 'Jardim de Musgo', { chapter: 1, need: 70, tip: 'Musgo por todo o lado. Limpa-o com o lodo — e depois limpa o lodo com água.' }, g => {
    g.floor(30);
    g.basin(10, 1, 13, 2, 'p', { air: 1 }); g.basin(2, 0, 6, 4, 'w'); g.basin(17, 0, 21, 4, 'w');
    g.rect(8, 10, 15, 11, 'm'); g.rect(0, 12, 23, 12, 'R'); g.rect(9, 12, 14, 12, 'm');
    g.air(9, 13, 14, 15); g.rect(8, 16, 15, 16, 'R');
    g.rect(3, 19, 8, 20, 'm'); g.rect(15, 19, 20, 20, 'm');
    g.pot(10, 27);
    g.bud(4, 9); g.bud(19, 9); g.bud(11, 23);
  }, [{ d: [[11.5, 3.2], [11.5, 9.8]] }, { d: [[4.5, 5.2], [4.5, 9.5], [10, 9.8]], t: 3 }, { d: [[19.5, 5.2], [19.5, 9.5], [13, 9.8]], t: 3 }, { d: [[14.5, 15.4], [16.3, 15.6], [16.3, 17.5], [11.5, 19], [11.5, 23.5], [11.5, 27]], t: 9 }]);

  lvl('c2-10', 'Grande Final Roxo', { chapter: 1, need: 100, tip: 'Lodo, musgo e comportas — tudo junto. Pensa antes de escavar!' }, g => {
    g.floor(30);
    g.basin(1, 0, 5, 3, 'p'); g.basin(9, 0, 15, 3, 'w'); g.basin(19, 0, 22, 3, 'w');
    g.rect(7, 8, 17, 8, 'R'); g.rect(10, 9, 13, 10, 'm');
    g.put(3, 15, 'a'); g.rect(1, 16, 5, 16, 'R');
    g.rect(0, 19, 23, 19, 'R'); g.rect(10, 19, 12, 19, 'A');
    g.pot(10, 27);
    g.bud(20, 9); g.bud(16, 16); g.bud(11, 23);
  }, [{ d: [[3.5, 4.2], [3.5, 15.3]] }, { d: [[3.5, 6], [11.5, 8.6]] }, { d: [[12, 4.2], [16.5, 6.5], [20.5, 9.5]], t: 5 }, { d: [[20.5, 4.2], [20.5, 9.5], [16.5, 16.5], [11.5, 18.4]], t: 5 }, { d: [[11.5, 20], [11.5, 23.5], [11.5, 27]], t: 5 }]);

  /* ═════════ capítulo 3 — Rio de Lava ═════════ */
  lvl('c3-1', 'Lava Lenta', { chapter: 2, need: 70, tip: 'A lava é espessa e queima tudo — turbinas e Rebento incluídos. Deixa-a fechada!' }, g => {
    g.floor(30);
    g.basin(15, 1, 21, 3, 'l', { air: 1 }); g.basin(2, 1, 7, 3, 'w', { air: 1 });
    g.rect(13, 6, 23, 6, 'R');
    g.pot(10, 27);
    g.bud(5, 9); g.bud(8, 16); g.bud(11, 22);
  }, [{ d: [[4.5, 4.2], [5.5, 9.5], [8.5, 16.5], [11.5, 22.5], [11.5, 27]] }]);

  lvl('c3-2', 'Ponte de Pedra', { chapter: 2, need: 70, tip: 'Água em cima da lava faz pedra. Cobre o poço de lava e passa por cima!' }, g => {
    g.floor(30);
    g.basin(2, 0, 8, 4, 'w');
    g.air(9, 12, 15, 15); g.rect(9, 14, 15, 15, 'l'); g.rect(8, 16, 16, 16, 'R'); g.rect(8, 12, 8, 15, 'R'); g.rect(16, 12, 16, 15, 'R');
    g.pot(17, 27);
    g.bud(6, 9); g.bud(18, 15); g.bud(18, 22);
  }, [{ d: [[5, 5.2], [6.5, 9.5], [8, 11.5], [9.5, 12.5]] }, { d: [[15.5, 12.6], [17.5, 12.5], [18.5, 15.5], [18.5, 22.5], [18.5, 27]], t: 5 }]);

  lvl('c3-3', 'Fosso de Lava', { chapter: 2, need: 70, tip: 'Primeiro despeja a lava num buraco onde não faça mal. Depois, a água.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'l', { air: 1 }); g.basin(17, 0, 22, 4, 'w');
    g.air(1, 16, 6, 21); g.rect(0, 22, 7, 22, 'R');
    g.pot(10, 27);
    g.bud(19, 10); g.bud(15, 17); g.bud(12, 23);
  }, [{ d: [[11.5, 4.2], [6, 10], [3.5, 16]] }, { d: [[19.5, 5.2], [19.5, 10.5], [15.5, 17.5], [12.5, 23.5], [11.5, 27]], t: 7 }]);

  lvl('c3-4', 'Nuvem de Vapor', { chapter: 2, need: 90, tip: 'A placa quente ferve a água; o vapor sobe e a nuvem fria transforma-o em chuva.' }, g => {
    g.floor(31);
    g.basin(2, 20, 7, 23, 'w', { air: 2 });
    g.put(9, 28, 'H'); g.rect(8, 29, 10, 29, 'R');
    g.air(12, 4, 20, 10); g.rect(11, 3, 21, 3, 'R'); g.rect(11, 4, 11, 12, 'R'); g.rect(21, 4, 21, 13, 'R');
    g.rect(13, 4, 19, 4, 'C');
    g.pot(15, 11); g.rect(13, 13, 20, 13, 'R');
    g.bud(5, 26); g.bud(8, 27); g.bud(13, 9);
  }, [{ d: [[4.5, 24.2], [5.5, 26.5], [8.5, 27.5], [9.5, 28.4]] }, { d: [[9.5, 28], [10, 22], [11, 16], [12.4, 13.5], [12.5, 10]] }]);

  lvl('c3-5', 'Rastilho de Musgo', { chapter: 2, need: 70, tip: 'A lava pega fogo ao musgo — e o fogo corre pelo musgo todo como um rastilho!' }, g => {
    g.floor(30);
    g.basin(3, 1, 3, 1, 'l', { air: 1 });
    g.rect(3, 5, 15, 5, 'm'); g.rect(0, 6, 11, 6, 'R'); g.rect(12, 6, 15, 12, 'm');
    g.rect(0, 12, 11, 12, 'R'); g.rect(16, 12, 23, 12, 'R');
    g.basin(18, 0, 22, 3, 'w');
    g.pot(10, 27);
    g.bud(20, 9); g.bud(13, 17); g.bud(11, 23);
  }, [{ d: [[3.5, 2.2], [3.5, 4.4]] }, { d: [[20, 4.2], [20.5, 9.5], [16.5, 10.5], [13.5, 11]], t: 4 }, { d: [[13.5, 13], [13.5, 17.5], [11.5, 23.5], [11.5, 27]], t: 4 }]);

  lvl('c3-6', 'Lava contra Lodo', { chapter: 2, need: 70, tip: 'A lava faz o lodo evaporar. Usa uma ameaça contra a outra!' }, g => {
    g.floor(30);
    g.basin(2, 1, 5, 2, 'l', { air: 1 });
    g.air(9, 9, 14, 12); g.rect(9, 11, 14, 12, 'p'); g.rect(8, 13, 15, 13, 'R'); g.rect(8, 9, 8, 12, 'R'); g.rect(15, 9, 15, 12, 'R');
    g.basin(17, 0, 22, 4, 'w');
    g.pot(10, 27);
    g.bud(19, 10); g.bud(16, 17); g.bud(12, 23);
  }, [{ d: [[3.5, 3.2], [6, 7], [9.5, 9.3]] }, { d: [[19.5, 5.2], [19.5, 10.5], [16.5, 17.5], [12.5, 23.5], [11.5, 27]], t: 8 }]);

  lvl('c3-7', 'Chaminé', { chapter: 2, need: 60, tip: 'A água está lá em baixo e o Rebento lá em cima. Só o vapor sobe!' }, g => {
    g.floor(31);
    g.basin(14, 21, 21, 25, 'w', { air: 2 });
    g.put(11, 29, 'H'); g.put(12, 29, 'H'); g.rect(10, 30, 13, 30, 'R');
    g.air(2, 2, 9, 7); g.rect(1, 1, 10, 1, 'R'); g.rect(1, 2, 1, 10, 'R'); g.rect(10, 2, 10, 9, 'R'); g.rect(3, 2, 8, 2, 'C');
    g.pot(4, 8); g.rect(2, 10, 8, 10, 'R');
    g.bud(17, 28); g.bud(3, 6); g.bud(8, 6);
  }, [{ d: [[17.5, 26.2], [17.5, 28.4], [12.5, 29.3]] }, { d: [[12, 28.6], [12, 20], [10.5, 13], [9.5, 10.6], [9.5, 7]] }]);

  lvl('c3-8', 'Muralha de Pedra', { chapter: 2, need: 80, tip: 'Primeiro a água, depois a lava: onde se encontram nasce uma muralha de pedra.' }, g => {
    g.floor(30);
    g.basin(2, 1, 6, 2, 'l', { air: 1 }); g.basin(10, 0, 16, 4, 'w');
    g.air(1, 10, 22, 12); g.rect(0, 13, 23, 13, 'R'); g.rect(0, 9, 23, 9, 'R');
    g.put(4, 9, '#'); g.put(13, 9, '#'); g.put(21, 13, '#');
    g.pot(18, 27);
    g.bud(13, 7); g.bud(20, 16); g.bud(19, 22);
  }, [{ d: [[13, 5.2], [13.5, 7.5], [13.5, 10]] }, { d: [[4, 3.2], [4, 10]], t: 3 }, { d: [[21.5, 12.4], [21.5, 14], [20.5, 16.5], [19.5, 22.5], [19.5, 27]], t: 8 }]);

  lvl('c3-9', 'Caldeira', { chapter: 2, need: 120, tip: 'Duas placas, duas nuvens. Faz o máximo de vapor possível!' }, g => {
    g.floor(31);
    g.basin(1, 22, 6, 25, 'w', { air: 2 }); g.basin(17, 22, 22, 25, 'w', { air: 2 });
    g.put(9, 29, 'H'); g.put(14, 29, 'H'); g.rect(8, 30, 15, 30, 'R');
    g.air(7, 3, 16, 8); g.rect(6, 2, 17, 2, 'R'); g.rect(6, 3, 6, 10, 'R'); g.rect(17, 3, 17, 10, 'R'); g.rect(8, 3, 15, 3, 'C');
    g.pot(10, 9); g.rect(8, 11, 15, 11, 'R');
    g.bud(4, 28); g.bud(19, 28); g.bud(15, 7);
  }, [{ d: [[3.5, 26.2], [4.5, 28.5], [9.5, 29.3]] }, { d: [[19.5, 26.2], [19.5, 28.5], [14.5, 29.3]] }, { d: [[9.5, 28.6], [7, 21], [7, 13], [7.5, 11.6], [7.5, 8]] }, { d: [[14.5, 28.6], [16, 21], [16.5, 13], [16.5, 11.6], [16.5, 8]] }]);

  lvl('c3-10', 'Vulcão', { chapter: 2, need: 100, tip: 'Lava por todo o lado. Pedra, vapor e muito sangue-frio!' }, g => {
    g.floor(30);
    g.basin(1, 0, 4, 2, 'l'); g.basin(19, 0, 22, 2, 'l'); g.basin(8, 0, 15, 4, 'w');
    g.air(1, 9, 6, 12); g.air(17, 9, 22, 12); g.rect(0, 13, 7, 13, 'R'); g.rect(16, 13, 23, 13, 'R');
    g.rect(6, 17, 17, 17, 'R');
    g.pot(10, 27);
    g.bud(11, 8); g.bud(4, 20); g.bud(12, 23);
  }, [{ d: [[2.5, 3.2], [3.5, 9.5]] }, { d: [[20.5, 3.2], [19.5, 9.5]] }, { d: [[11.5, 5.2], [11.5, 8.5], [9.5, 14.5], [5, 18], [4.5, 20.5], [12.5, 23.5], [11.5, 27]], t: 7 }]);

  /* ═════════ capítulo 4 — Engenhocas ═════════ */
  lvl('c4-1', 'Bomba!', { chapter: 3, need: 70, tip: 'A pedra rachada não se escava, mas uma bomba parte-a. Toca na bomba!' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.rect(0, 14, 23, 15, 'R'); g.rect(9, 14, 14, 15, 'k'); g.put(12, 14, 'X');
    g.pot(10, 27);
    g.bud(12, 8); g.bud(10, 19); g.bud(12, 23);
  }, [{ tap: [12.5, 14.5] }, { d: [[11.5, 4.2], [12, 8.5], [12, 12.5]], t: .5 }, { d: [[11.5, 16], [10.5, 19.5], [12.5, 23.5], [11.5, 27]], t: .5 }]);

  lvl('c4-2', 'A Válvula', { chapter: 3, need: 80, tip: 'Toca na válvula para a abrir (e outra vez para fechar).' }, g => {
    g.floor(30);
    g.basin(8, 0, 15, 5, 'w'); g.rect(8, 6, 15, 6, 'R'); g.rect(10, 6, 13, 6, 'V');
    g.pot(10, 27);
    g.bud(5, 12); g.bud(17, 17); g.bud(11, 23);
  }, [{ d: [[11.5, 7.5], [5.5, 12.5], [17.5, 17.5], [11.5, 23.5], [11.5, 27]] }, { tap: [11.5, 6.5], t: .5 }]);

  lvl('c4-3', 'A Torneira', { chapter: 3, need: 120, spout: 220, spoutKey: 'A', tip: 'Enche o copo para abrir a torneira grande!' }, g => {
    g.floor(30);
    g.basin(2, 1, 5, 2, 'w', { air: 1 });
    g.put(4, 9, 'a'); g.rect(2, 10, 6, 10, 'R');
    g.put(15, 3, 'O'); g.air(14, 4, 16, 5); g.rect(13, 6, 17, 6, 'R');
    g.pot(10, 27);
    g.bud(17, 10); g.bud(12, 17); g.bud(11, 23);
  }, [{ d: [[3.5, 3.2], [4.5, 8.4]] }, { d: [[16.4, 5.5], [18.5, 5.7], [18.5, 7.5], [17.5, 10.5], [12.5, 17.5], [11.5, 23.5], [11.5, 27]] }]);

  lvl('c4-4', 'Bombas e Lodo', { chapter: 3, need: 70, tip: 'Cuidado com a bomba que está ao pé do lodo…' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w');
    g.rect(0, 12, 23, 13, 'R');
    g.rect(4, 12, 7, 13, 'k'); g.put(5, 11, 'X'); g.rect(16, 12, 19, 13, 'k'); g.put(18, 11, 'X');
    g.air(3, 14, 8, 17); g.rect(3, 15, 8, 17, 'p'); g.rect(2, 18, 9, 18, 'R'); g.rect(2, 14, 2, 17, 'R'); g.rect(9, 14, 9, 17, 'R');
    g.pot(16, 27);
    g.bud(15, 8); g.bud(18, 17); g.bud(17, 23);
  }, [{ tap: [18.5, 11.5] }, { d: [[11.5, 4.2], [15.5, 8.5], [17.5, 10.5]], t: .3 }, { d: [[18, 14.2], [18.5, 17.5], [17.5, 23.5], [17.5, 27]], t: .3 }]);

  lvl('c4-5', 'Comporta de Lava', { chapter: 3, need: 80, tip: 'A válvula segura a lava. Prepara a água primeiro!' }, g => {
    g.floor(30);
    g.basin(2, 0, 7, 3, 'l'); g.rect(1, 4, 8, 4, 'R'); g.rect(3, 4, 6, 4, 'V');
    g.basin(15, 0, 21, 4, 'w');
    g.air(1, 5, 8, 8); g.rect(0, 9, 9, 9, 'R'); g.rect(0, 5, 0, 8, 'R'); g.rect(9, 5, 9, 8, 'R');
    g.pot(10, 27);
    g.bud(18, 10); g.bud(14, 17); g.bud(11, 23);
  }, [{ d: [[18, 5.2], [18.5, 10.5], [14.5, 17.5], [11.5, 23.5], [11.5, 27]] }]);

  lvl('c4-6', 'Escolhe a Bomba', { chapter: 3, need: 90, tip: 'Três bombas, só uma ajuda. Pensa antes de tocar!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 4, 'w');
    g.rect(0, 10, 23, 11, 'R');
    [[3, 'l'], [11, ' '], [19, 'p']].forEach(([x, f]) => { g.rect(x - 1, 10, x + 1, 11, 'k'); g.put(x, 9, 'X'); if (f !== ' ') { g.air(x - 2, 12, x + 2, 14); g.rect(x - 2, 13, x + 2, 14, f); g.rect(x - 3, 15, x + 3, 15, 'R'); g.rect(x - 3, 12, x - 3, 14, 'R'); g.rect(x + 3, 12, x + 3, 14, 'R'); } });
    g.pot(10, 27);
    g.bud(9, 7); g.bud(12, 16); g.bud(11, 23);
  }, [{ tap: [11.5, 9.5] }, { d: [[11.5, 5.2], [9.5, 7.5], [11.5, 8.6]], t: .3 }, { d: [[11.5, 12.2], [12.5, 16.5], [11.5, 23.5], [11.5, 27]], t: .3 }]);

  lvl('c4-7', 'Duas Válvulas', { chapter: 3, need: 70, tip: 'Uma válvula solta lodo, a outra água. Abre, espera… e fecha a tempo!' }, g => {
    g.floor(30);
    g.basin(2, 2, 7, 4, 'p', { air: 2 }); g.rect(1, 5, 8, 5, 'R'); g.rect(3, 5, 6, 5, 'V');
    g.basin(16, 0, 21, 4, 'w'); g.rect(15, 5, 22, 5, 'R'); g.rect(17, 5, 20, 5, 'V');
    g.rect(9, 11, 14, 13, 'm'); g.rect(0, 14, 23, 14, 'R'); g.rect(10, 14, 13, 14, 'm');
    g.air(9, 15, 14, 17); g.rect(8, 18, 15, 18, 'R');
    g.pot(10, 27);
    g.bud(18, 10); g.bud(16, 19); g.bud(12, 24);
  }, [{ d: [[4.5, 6.5], [8, 9], [11, 10.6]] }, { tap: [4.5, 5.5], t: .2 }, { tap: [4.5, 5.5], t: 1.3 }, { d: [[18.5, 6.5], [18.5, 10.5], [13, 10.6]], t: .2 }, { tap: [18.5, 5.5], t: 4 }, { d: [[14.5, 17.2], [16.5, 17.4], [16.5, 19.5], [12.5, 24.5], [11.5, 27]], t: 11 }]);

  lvl('c4-8', 'Fábrica de Chuva', { chapter: 3, need: 90, spout: 260, tip: 'A torneira dá água, a placa faz vapor e a nuvem faz chover no Rebento.' }, g => {
    g.floor(31);
    g.put(4, 18, 'O'); g.air(3, 19, 5, 20);
    g.put(9, 28, 'H'); g.put(10, 28, 'H'); g.rect(8, 29, 11, 29, 'R');
    g.air(13, 3, 21, 9); g.rect(12, 2, 22, 2, 'R'); g.rect(12, 3, 12, 11, 'R'); g.rect(22, 3, 22, 12, 'R'); g.rect(14, 3, 20, 3, 'C');
    g.pot(16, 10); g.rect(14, 12, 21, 12, 'R');
    g.bud(6, 24); g.bud(8, 26); g.bud(14, 8);
  }, [{ d: [[4.5, 21.2], [6.5, 24.5], [8.5, 26.5], [10, 28.4]] }, { d: [[10, 28], [11.5, 20], [12, 14], [13.4, 12.5], [13.5, 9]] }]);

  lvl('c4-9', 'Engrenagens', { chapter: 3, need: 100, spout: 240, spoutKey: 'B', tip: 'Copo vermelho abre a comporta; copo amarelo liga a torneira.' }, g => {
    g.floor(30);
    g.basin(2, 0, 6, 3, 'w');
    g.put(4, 9, 'a'); g.rect(2, 10, 6, 10, 'R');
    g.rect(8, 12, 23, 12, 'R'); g.rect(11, 12, 13, 12, 'A'); g.put(12, 11, 'b');
    g.put(19, 2, 'O'); g.air(18, 3, 20, 4); g.rect(17, 5, 21, 5, 'R');
    g.pot(10, 27);
    g.bud(19, 9); g.bud(13, 17); g.bud(11, 23);
  }, [{ d: [[4.5, 4.2], [4.5, 8.4]] }, { d: [[5.5, 6.5], [11, 10], [12.5, 10.6]] }, { d: [[20.6, 4.5], [22.5, 4.7], [22.5, 6.5], [19.5, 9.5], [13.5, 11.2]], t: 3 }, { d: [[12.5, 13.2], [13.5, 17.5], [11.5, 23.5], [11.5, 27]], t: 3 }]);

  lvl('c4-10', 'Grande Final', { chapter: 3, need: 110, tip: 'Tudo o que aprendeste num só jardim. Força, Rebento!' }, g => {
    g.floor(30);
    g.basin(1, 0, 5, 3, 'l'); g.basin(9, 0, 14, 4, 'w'); g.basin(18, 0, 22, 3, 'p');
    g.rect(0, 9, 23, 10, 'R'); g.rect(10, 9, 13, 10, 'k'); g.put(11, 9, 'X'); g.rect(3, 9, 3, 10, '#'); g.rect(20, 9, 20, 10, '#');
    g.air(1, 11, 6, 14); g.rect(0, 15, 7, 15, 'R'); g.air(17, 11, 22, 14); g.rect(16, 15, 23, 15, 'R');
    g.rect(5, 18, 10, 19, 'm');
    g.pot(10, 27);
    g.bud(8, 6); g.bud(16, 20); g.bud(12, 24);
  }, [{ d: [[3, 4.2], [3.5, 11.5]] }, { d: [[20, 4.2], [20.5, 11.5]] }, { tap: [11.5, 9.5], t: .2 }, { d: [[11.5, 5.2], [8.5, 6.5], [11.5, 8.5]], t: .3 }, { d: [[11.5, 11], [15, 14], [16.5, 20.5], [12.5, 24.5], [11.5, 27]], t: .3 }]);

  /* ═════════ capítulo 5 — Grutas Fundas ═════════ */
  lvl('c5-1', 'Escadaria', { chapter: 4, need: 80, tip: 'Quatro prateleiras de pedra: leva a água de degrau em degrau.' }, g => {
    g.floor(30);
    g.basin(17, 1, 21, 3, 'w', { air: 1 });
    g.rect(8, 8, 23, 8, 'R'); g.rect(0, 14, 15, 14, 'R'); g.rect(8, 20, 23, 20, 'R');
    g.pot(2, 27);
    g.bud(5, 10); g.bud(19, 17); g.bud(10, 24);
  }, [{ d: [[19.5, 4.2], [19.5, 6.5], [7, 7.6], [5.5, 10.5], [5.5, 12.5], [16.5, 13.5], [18, 16], [19.5, 17.5], [19.5, 19.5], [7, 19.6], [6, 22], [10.5, 24.5], [3.5, 26.2], [3.5, 27]] }]);

  lvl('c5-2', 'Três Fontes', { chapter: 4, need: 120, tip: 'Três poças pequenas. Junta-as no buraco do meio.' }, g => {
    g.floor(30);
    g.basin(2, 1, 4, 2, 'w', { air: 1 }); g.basin(10, 1, 13, 2, 'w', { air: 1 }); g.basin(19, 1, 21, 2, 'w', { air: 1 });
    g.rect(0, 7, 10, 7, 'R'); g.rect(13, 7, 23, 7, 'R');
    g.pot(10, 27);
    g.bud(7, 4); g.bud(16, 4); g.bud(12, 16);
  }, [{ d: [[3.5, 3.2], [7.5, 4.5], [11, 6.2]] }, { d: [[20.5, 3.2], [16.5, 4.5], [12.5, 6.2]] }, { d: [[11.5, 3.2], [11.5, 9], [12.5, 16.5], [11.5, 22], [11.5, 27]] }]);

  lvl('c5-3', 'Grutas em Fila', { chapter: 4, need: 90, tip: 'Há grutas escondidas dos dois lados. Passa-lhes rente, sem lhes abrir buraco!' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.air(1, 8, 6, 12); g.air(17, 13, 22, 17); g.air(1, 18, 6, 22); g.air(17, 22, 22, 25);
    g.pot(10, 27);
    g.bud(8, 10); g.bud(15, 15); g.bud(8, 20);
  }, [{ d: [[11.5, 4.2], [8.6, 10.5], [11.5, 13], [15.4, 15.5], [11.5, 18], [8.6, 20.5], [11.5, 24], [11.5, 27]] }]);

  lvl('c5-4', 'Sifão', { chapter: 4, need: 80, tip: 'A água desce por baixo da parede e volta a subir do outro lado — mas nunca mais alto do que a poça.' }, g => {
    g.floor(30);
    g.basin(14, 0, 22, 6, 'w');
    g.rect(11, 0, 12, 13, 'R');
    g.pot(3, 11);
    g.bud(18, 11); g.bud(12, 16); g.bud(8, 12);
  }, [{ d: [[18.5, 7.2], [18.5, 16.5], [8.5, 16.5], [8.5, 12.5], [8.5, 9.5], [4.5, 9.5], [4.5, 11]] }]);

  lvl('c5-5', 'Ponte sobre a Gruta', { chapter: 4, need: 80, tip: 'Uma gruta enorme ao meio. Dá a volta por fora — se lhe abrires buraco, a água fica lá presa.' }, g => {
    g.floor(30);
    g.basin(2, 1, 6, 3, 'w', { air: 1 });
    g.air(5, 11, 19, 17); g.rect(4, 18, 20, 18, 'R');
    g.pot(17, 27);
    g.bud(3, 9); g.bud(10, 21); g.bud(18, 23);
  }, [{ d: [[4.5, 4.2], [3.5, 9.5], [2.6, 14], [2.6, 19.5], [10.5, 21.5], [18.5, 23.5], [18.5, 27]] }]);

  lvl('c5-6', 'Serpente', { chapter: 4, need: 90, tip: 'Uma serpente de pedra. Segue-lhe as curvas até lá abaixo.' }, g => {
    g.floor(30);
    g.basin(1, 0, 7, 3, 'w');
    g.rect(0, 7, 19, 7, 'R'); g.rect(4, 12, 23, 12, 'R'); g.rect(0, 17, 19, 17, 'R'); g.rect(4, 22, 23, 22, 'R');
    g.pot(10, 27);
    g.bud(21, 9); g.bud(2, 14); g.bud(21, 19);
  }, [{ d: [[4.5, 4.2], [5, 5.6], [21.5, 6.4], [21.5, 9.5], [21, 11.2], [2.5, 11.4], [2.5, 14.5], [2.5, 16.2], [21.5, 16.4], [21.5, 19.5], [21, 21.2], [2.5, 21.4], [2.5, 24], [9, 25.5], [11.5, 26], [11.5, 27]] }]);

  lvl('c5-7', 'Conta-Gotas', { chapter: 4, need: 120, tip: 'Pouca água, em dois sítios. Junta-a toda e não desperdices uma gota.' }, g => {
    g.floor(30);
    g.basin(19, 1, 22, 3, 'w', { air: 1 }); g.basin(1, 10, 4, 12, 'w', { air: 1 });
    g.rect(6, 14, 18, 14, 'R');
    g.pot(10, 27);
    g.bud(14, 7); g.bud(3, 17); g.bud(12, 22);
  }, [{ d: [[20.5, 4.2], [14.5, 7.5], [7, 8.6], [3, 9.4]] }, { d: [[2.5, 13.2], [3.5, 17.5], [10, 21], [12.5, 22.5], [11.5, 27]], t: 2.5 }]);

  lvl('c5-8', 'Cortina de Água', { chapter: 4, need: 90, tip: 'A água está guardada atrás de uma cortina de terra. Abre-a de lado!' }, g => {
    g.floor(30);
    g.rect(0, 7, 7, 7, 'R'); g.rect(0, 15, 7, 15, 'R'); g.rect(0, 8, 5, 14, 'w');
    g.pot(10, 27);
    g.bud(9, 14); g.bud(15, 19); g.bud(11, 23);
  }, [{ d: [[6.6, 14.3], [9.5, 14.5], [15.5, 19.5], [11.5, 23.5], [11.5, 27]] }]);

  lvl('c5-9', 'Dois Caminhos', { chapter: 4, need: 100, tip: 'Pela direita é mais perto… mas há lá uma gruta sedenta. Vai pela esquerda!' }, g => {
    g.floor(30);
    g.basin(8, 0, 15, 4, 'w');
    g.air(16, 9, 22, 14); g.rect(15, 15, 23, 15, 'R');
    g.rect(0, 15, 1, 15, 'R');
    g.pot(10, 27);
    g.bud(3, 10); g.bud(5, 19); g.bud(11, 24);
  }, [{ d: [[9.5, 5.2], [3.5, 10.5], [3.5, 14], [5.5, 19.5], [11.5, 24.5], [11.5, 27]] }]);

  lvl('c5-10', 'Grande Gruta', { chapter: 4, need: 140, tip: 'Três poças, duas grutas e um funil. Junta tudo no meio!' }, g => {
    g.floor(30);
    g.basin(1, 0, 5, 3, 'w'); g.basin(18, 0, 22, 3, 'w'); g.basin(9, 5, 14, 7, 'w', { air: 1, floor: false });
    g.air(1, 15, 6, 20); g.air(17, 15, 22, 20);
    g.rect(0, 24, 8, 24, 'R'); g.rect(15, 24, 23, 24, 'R');
    g.pot(10, 27);
    g.bud(7, 12); g.bud(16, 12); g.bud(11, 21);
  }, [{ d: [[3.5, 4.2], [7.5, 12.5], [11.5, 16]] }, { d: [[20.5, 4.2], [16.5, 12.5], [12, 16]] }, { d: [[11.5, 8.2], [11.5, 16], [11.5, 21.5], [11.5, 27]] }]);

  /* ═════════ capítulo 6 — Laboratório Roxo ═════════ */
  lvl('c6-1', 'Lodo dos Dois Lados', { chapter: 5, need: 80, tip: 'Há lodo escondido à esquerda e à direita. Passa pelo meio sem lhe tocar.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 3, 'w', { air: 1 });
    g.basin(2, 10, 7, 12, 'p', { air: 1 }); g.basin(16, 16, 21, 18, 'p', { air: 1 });
    g.pot(10, 27);
    g.bud(9, 8); g.bud(14, 13); g.bud(9, 21);
  }, [{ d: [[11.5, 4.2], [9.5, 8.5], [11, 11], [14.5, 13.5], [12, 17], [9.5, 21.5], [11.5, 24], [11.5, 27]] }]);

  lvl('c6-2', 'Rolha de Musgo', { chapter: 5, need: 80, tip: 'Uma rolha de musgo tapa o único buraco na pedra. Primeiro o lodo, depois a água.' }, g => {
    g.floor(30);
    g.basin(2, 1, 5, 2, 'p', { air: 1 }); g.basin(17, 0, 21, 4, 'w');
    g.rect(0, 12, 23, 13, 'R'); g.rect(11, 12, 12, 13, 'm');
    g.pot(10, 27);
    g.bud(17, 8); g.bud(8, 17); g.bud(12, 23);
  }, [{ d: [[3.5, 3.2], [8, 8], [11.5, 11.3]] }, { d: [[19, 5.2], [17.5, 8.5], [12.5, 11.2]], t: 3 }, { d: [[11.5, 14.2], [8.5, 17.5], [12.5, 23.5], [11.5, 27]], t: 9 }]);

  lvl('c6-3', 'Comporta Escondida', { chapter: 5, need: 90, tip: 'O copo vermelho está escondido à direita. Enche-o e a comporta abre.' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w');
    g.rect(0, 16, 23, 16, 'R'); g.rect(10, 16, 13, 16, 'A');
    g.put(20, 14, 'a'); g.rect(18, 15, 22, 15, 'R');
    g.pot(10, 27);
    g.bud(11, 8); g.bud(18, 11); g.bud(11, 22);
  }, [{ d: [[11.5, 4.2], [11.5, 8.5], [18.5, 11.5], [20.5, 13.8]] }, { d: [[11.5, 8.5], [11.5, 15.4]] }, { d: [[11.5, 17], [11.5, 22.5], [11.5, 27]], t: 3 }]);

  lvl('c6-4', 'Chave de Lodo', { chapter: 5, need: 80, tip: 'A água está presa atrás da comporta. Só o lodo pode encher o copo!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w'); g.rect(8, 4, 15, 4, 'R'); g.rect(10, 4, 13, 4, 'A');
    g.basin(1, 1, 4, 2, 'p', { air: 1 });
    g.put(3, 10, 'a'); g.rect(1, 11, 5, 11, 'R');
    g.pot(10, 27);
    g.bud(11, 9); g.bud(16, 15); g.bud(11, 22);
  }, [{ d: [[2.5, 3.2], [3, 9.4]] }, { d: [[11.5, 5.2], [11.5, 9.5], [16.5, 15.5], [11.5, 22.5], [11.5, 27]], t: 1 }]);

  lvl('c6-5', 'Ilhas de Musgo', { chapter: 5, need: 90, tip: 'Ilhas de musgo guloso por todo o lado. Serpenteia entre elas.' }, g => {
    g.floor(30);
    g.basin(1, 0, 6, 3, 'w');
    g.rect(8, 6, 11, 8, 'm'); g.rect(14, 11, 17, 13, 'm'); g.rect(5, 15, 8, 17, 'm'); g.rect(12, 19, 15, 21, 'm');
    g.pot(10, 27);
    g.bud(3, 9); g.bud(19, 12); g.bud(9, 23);
  }, [{ d: [[3.5, 4.2], [3.5, 9.5], [11, 10.2], [18.5, 10.2], [19.5, 12.5], [19.5, 17], [11, 18], [9.5, 23.5], [11.5, 27]] }]);

  lvl('c6-6', 'Duas Comportas', { chapter: 5, need: 100, tip: 'Copo vermelho em cima, copo amarelo em baixo. Uma comporta de cada vez.' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 4, 'w');
    g.rect(0, 10, 23, 10, 'R'); g.rect(10, 10, 13, 10, 'A'); g.put(3, 9, 'a');
    g.rect(0, 20, 23, 20, 'R'); g.rect(10, 20, 13, 20, 'B'); g.put(20, 19, 'b');
    g.pot(10, 27);
    g.bud(6, 6); g.bud(17, 15); g.bud(11, 24);
  }, [{ d: [[11.5, 5.2], [6.5, 6.5], [3.5, 8.8]] }, { d: [[11.5, 5.2], [11.5, 9.4]] }, { d: [[11.5, 11], [17.5, 15.5], [20.5, 18.8]], t: 3 }, { d: [[17.5, 15.5], [11.5, 19.4]], t: 3 }, { d: [[11.5, 21], [11.5, 24.5], [11.5, 27]], t: 7 }]);

  lvl('c6-7', 'Chave Roxa', { chapter: 5, need: 90, tip: 'O lodo abre a primeira comporta; a água abre a segunda.' }, g => {
    g.floor(30);
    g.basin(1, 0, 6, 3, 'w'); g.rect(0, 9, 23, 9, 'R'); g.rect(2, 9, 4, 9, 'A');
    g.basin(18, 1, 21, 2, 'p', { air: 1 }); g.put(19, 6, 'a'); g.rect(17, 7, 21, 7, 'R');
    g.put(4, 16, 'b'); g.rect(2, 17, 6, 17, 'R');
    g.rect(0, 19, 23, 19, 'R'); g.rect(10, 19, 12, 19, 'B');
    g.pot(10, 27);
    g.bud(3, 6); g.bud(8, 14); g.bud(11, 23);
  }, [{ d: [[19.5, 3.2], [19.5, 5.8]] }, { d: [[3.5, 4.2], [3.5, 6.5], [3.5, 8.4]] }, { d: [[3.5, 10], [8.5, 14.5], [4.5, 15.8]], t: 4 }, { d: [[8.5, 14.5], [11, 18.4]], t: 4 }, { d: [[11, 20], [11.5, 23.5], [11.5, 27]], t: 8 }]);

  lvl('c6-8', 'Musgo e Comporta', { chapter: 5, need: 90, tip: 'Enche o copo para soltar o lodo; o lodo mata o musgo; a água lava o lodo. Por esta ordem!' }, g => {
    g.floor(30);
    g.basin(1, 0, 5, 3, 'w');
    g.basin(19, 2, 21, 3, 'p', { air: 2 }); g.rect(18, 4, 22, 4, 'R'); g.rect(19, 4, 21, 4, 'A');
    g.put(3, 9, 'a'); g.rect(1, 10, 5, 10, 'R');
    g.rect(0, 14, 23, 15, 'R'); g.rect(10, 14, 13, 15, 'm');
    g.pot(10, 27);
    g.bud(8, 7); g.bud(10, 11); g.bud(12, 22);
  }, [{ d: [[3.5, 4.2], [3.5, 8.8]] }, { d: [[20.5, 5], [16.5, 10], [12.5, 13.3]] }, { d: [[3.5, 6], [8.5, 7.5], [10.5, 11.5], [11, 13.3]], t: 4 }, { d: [[11.5, 16.2], [12.5, 22.5], [11.5, 27]], t: 13 }]);

  lvl('c6-9', 'Lavagem', { chapter: 5, need: 90, tip: 'Há lodo mesmo por cima do Rebento! Lava-o com muita água antes de escavar até ao vaso.' }, g => {
    g.floor(30);
    g.basin(7, 0, 16, 3, 'w');
    g.basin(9, 20, 13, 22, 'p', { air: 1 });
    g.pot(10, 27);
    g.bud(5, 8); g.bud(18, 12); g.bud(11, 16);
  }, [{ d: [[11.5, 4.2], [5.5, 8.5], [11.5, 11], [18.5, 12.5], [11.5, 16.5], [11.5, 19.2]] }, { d: [[11.5, 23.2], [11.5, 27]], t: 7 }]);

  lvl('c6-10', 'O Laboratório', { chapter: 5, need: 110, tip: 'Lodo na rolha de musgo, água no copo, comporta aberta. Tudo pela ordem certa!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 4, 'w'); g.basin(1, 0, 4, 2, 'p');
    g.rect(0, 10, 23, 11, 'R'); g.rect(4, 10, 5, 11, 'm');
    g.put(3, 17, 'a'); g.rect(1, 18, 5, 18, 'R');
    g.rect(7, 20, 23, 20, 'R'); g.rect(10, 20, 12, 20, 'A');
    g.pot(10, 27);
    g.bud(8, 7); g.bud(5, 14); g.bud(16, 23);
  }, [{ d: [[2.5, 3.2], [4.5, 9.3]] }, { d: [[11.5, 5.2], [8.5, 7.5], [5.5, 9.3]], t: 3 }, { d: [[4.5, 12.2], [5.5, 14.5], [3.5, 16.8]], t: 8 }, { d: [[5.5, 14.5], [11, 19.4]], t: 8 }, { d: [[11, 21], [16.5, 23.5], [11.5, 27]], t: 12 }]);

  /* ═════════ capítulo 7 — Fogo e Vapor ═════════ */
  lvl('c7-1', 'Lava ao Meio', { chapter: 6, need: 100, tip: 'A lava está mesmo por cima do caminho. Traz a água dos dois lados sem lhe tocar.' }, g => {
    g.floor(30);
    g.basin(9, 1, 14, 2, 'l', { air: 1 }); g.basin(1, 0, 5, 3, 'w'); g.basin(18, 0, 22, 3, 'w');
    g.pot(10, 27);
    g.bud(5, 10); g.bud(18, 10); g.bud(11, 21);
  }, [{ d: [[3.5, 4.2], [5.5, 10.5], [11.5, 15]] }, { d: [[20.5, 4.2], [18.5, 10.5], [12, 15]] }, { d: [[11.5, 15], [11.5, 21.5], [11.5, 27]] }]);

  lvl('c7-2', 'Tampa de Pedra', { chapter: 6, need: 80, tip: 'Deita água em cima da lava para a tapar com pedra. Depois sai pelo lado.' }, g => {
    g.floor(30);
    g.basin(8, 0, 15, 3, 'w');
    g.basin(9, 9, 14, 10, 'l', { air: 2 });
    g.pot(10, 27);
    g.bud(17, 13); g.bud(12, 19); g.bud(11, 24);
  }, [{ d: [[11.5, 4.2], [11.5, 7.6]] }, { d: [[15.4, 7.8], [17.5, 9], [17.5, 13.5], [12.5, 19.5], [11.5, 24.5], [11.5, 27]], t: 5 }]);

  lvl('c7-3', 'Fumo Branco', { chapter: 6, need: 90, tip: 'Leva a água até à placa quente; o vapor sobe pela chaminé e a nuvem faz chover no vaso.' }, g => {
    g.floor(31);
    g.basin(1, 0, 5, 3, 'w');
    g.put(11, 28, 'H'); g.put(12, 28, 'H'); g.rect(10, 29, 13, 29, 'R');
    g.air(14, 3, 22, 9); g.rect(13, 2, 23, 2, 'R'); g.rect(13, 3, 13, 10, 'R'); g.rect(23, 3, 23, 11, 'R'); g.rect(15, 3, 21, 3, 'C');
    g.pot(17, 10); g.rect(15, 12, 22, 12, 'R');
    g.bud(3, 9); g.bud(7, 21); g.bud(18, 7);
  }, [{ d: [[3.5, 4.2], [3.5, 9.5], [3.5, 15], [7.5, 21.5], [10.5, 27.5], [11.5, 28.4]] }, { d: [[12, 28], [13.5, 22], [14, 16], [14.5, 13], [14.5, 9]] }]);

  lvl('c7-4', 'Rastilho Comprido', { chapter: 6, need: 70, tip: 'Uma gota de lava acende o musgo; o fogo corre o rastilho todo e abre caminho à água.' }, g => {
    g.floor(30);
    g.basin(20, 1, 20, 1, 'l', { air: 1 });
    g.rect(8, 5, 20, 5, 'm'); g.rect(12, 6, 23, 6, 'R'); g.rect(8, 6, 11, 12, 'm');
    g.rect(0, 12, 7, 12, 'R'); g.rect(12, 12, 23, 12, 'R');
    g.basin(1, 0, 5, 3, 'w');
    g.pot(10, 27);
    g.bud(3, 9); g.bud(10, 17); g.bud(11, 23);
  }, [{ d: [[20.5, 2.2], [20.5, 4.4]] }, { d: [[3, 4.2], [3.5, 9.5], [7.4, 10.5], [9.5, 11]], t: 4 }, { d: [[9.5, 13], [10.5, 17.5], [11.5, 23.5], [11.5, 27]], t: 4 }]);

  lvl('c7-5', 'Lodo Fervido', { chapter: 6, need: 80, tip: 'A lava faz o lodo desaparecer; depois a água arrefece a lava e passa.' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w');
    g.basin(9, 10, 14, 12, 'p', { air: 1 });
    g.basin(1, 1, 3, 2, 'l', { air: 1 });
    g.pot(10, 27);
    g.bud(11, 7); g.bud(16, 17); g.bud(11, 22);
  }, [{ d: [[2, 3.2], [6, 7], [9.5, 9.3]] }, { d: [[11.5, 4.2], [11.5, 7.5], [11.5, 9.3]], t: 6 }, { d: [[15.5, 9.3], [16.5, 12], [16.5, 17.5], [11.5, 22.5], [11.5, 27]], t: 13 }]);

  lvl('c7-6', 'Chaminé Torta', { chapter: 6, need: 90, tip: 'O vapor sobe, mas não atravessa pedra. Abre-lhe um caminho à volta da prateleira até à nuvem.' }, g => {
    g.floor(31);
    g.basin(1, 21, 6, 24, 'w', { air: 2 });
    g.put(10, 28, 'H'); g.put(11, 28, 'H'); g.rect(9, 29, 12, 29, 'R');
    g.air(14, 2, 22, 8); g.rect(13, 1, 23, 1, 'R'); g.rect(13, 2, 13, 10, 'R'); g.rect(23, 2, 23, 10, 'R'); g.rect(15, 2, 21, 2, 'C');
    g.pot(17, 9); g.rect(15, 11, 22, 11, 'R');
    g.rect(9, 24, 16, 24, 'R');
    g.bud(4, 26); g.bud(8, 27); g.bud(18, 6);
  }, [{ d: [[3.5, 25.2], [4.5, 26.5], [8.5, 27.5], [10, 28.4]] }, { d: [[11.5, 27.6], [17.6, 26], [17.6, 22], [15, 16], [14.5, 12], [14.5, 8]] }]);

  lvl('c7-7', 'Ilha do Rebento', { chapter: 6, need: 90, tip: 'O vaso está entre duas bolsas de lava enterradas. Desce bem pelo meio!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w');
    g.basin(1, 1, 4, 2, 'l', { air: 1 }); g.basin(19, 1, 22, 2, 'l', { air: 1 });
    g.rect(1, 24, 7, 28, 'l'); g.rect(16, 24, 22, 28, 'l');
    g.pot(10, 27);
    g.bud(8, 9); g.bud(15, 15); g.bud(11, 21);
  }, [{ d: [[11.5, 4.2], [8.5, 9.5], [11.5, 12], [15.4, 15.5], [11.5, 18], [11.5, 21.5], [11.5, 27]] }]);

  lvl('c7-8', 'A Forja', { chapter: 6, need: 70, tip: 'Um poço largo de lava corta o caminho. Faz-lhe uma tampa de pedra com água e atravessa por cima.' }, g => {
    g.floor(30);
    g.basin(1, 0, 6, 4, 'w');
    g.basin(7, 15, 16, 16, 'l', { air: 2 });
    g.pot(10, 27);
    g.bud(4, 9); g.bud(19, 19); g.bud(12, 24);
  }, [{ d: [[4, 5.2], [4.5, 9.5], [5, 12], [7.5, 13.5]] }, { d: [[16.6, 13.6], [19.5, 14.5], [19.5, 19.5], [12.5, 24.5], [11.5, 27]], t: 7 }]);

  lvl('c7-9', 'Caldeirão', { chapter: 6, need: 110, tip: 'Duas poças, uma placa quente e uma nuvem. Cuidado: há lava à espreita!' }, g => {
    g.floor(31);
    g.basin(1, 20, 5, 23, 'w', { air: 2 }); g.basin(18, 20, 22, 23, 'w', { air: 2 });
    g.put(11, 28, 'H'); g.put(12, 28, 'H'); g.rect(10, 29, 13, 29, 'R');
    g.air(7, 3, 16, 8); g.rect(6, 2, 17, 2, 'R'); g.rect(6, 3, 6, 10, 'R'); g.rect(17, 3, 17, 10, 'R'); g.rect(8, 3, 15, 3, 'C');
    g.pot(10, 9); g.rect(8, 11, 15, 11, 'R');
    g.rect(1, 13, 4, 14, 'l'); g.rect(19, 13, 22, 14, 'l');
    g.bud(4, 26); g.bud(19, 26); g.bud(15, 7);
  }, [{ d: [[3, 24.2], [4.5, 26.5], [11, 28.4]] }, { d: [[20, 24.2], [19.5, 26.5], [12.5, 28.4]] }, { d: [[11.5, 27.6], [9, 21], [7.5, 15], [7.5, 11.6], [7.5, 8]] }, { d: [[12.5, 27.6], [15, 21], [16.5, 15], [16.5, 11.6], [16.5, 8]] }]);

  lvl('c7-10', 'Coração do Vulcão', { chapter: 6, need: 100, tip: 'Lava por cima, lava ao lado, lava por baixo. Pedra, paciência e uma boa ordem!' }, g => {
    g.floor(30);
    g.basin(1, 0, 4, 2, 'l'); g.basin(19, 0, 22, 2, 'l'); g.basin(8, 0, 15, 4, 'w');
    g.air(1, 8, 6, 11); g.rect(0, 12, 7, 12, 'R'); g.air(17, 8, 22, 11); g.rect(16, 12, 23, 12, 'R');
    g.basin(9, 15, 14, 16, 'l', { air: 2 });
    g.pot(10, 27);
    g.bud(11, 8); g.bud(18, 19); g.bud(12, 24);
  }, [{ d: [[2.5, 3.2], [3.5, 8.5]] }, { d: [[20.5, 3.2], [19.5, 8.5]] }, { d: [[11.5, 5.2], [11.5, 8.5], [11.5, 13.6]], t: 2 }, { d: [[14.6, 13.6], [17.5, 15], [18.5, 19.5], [12.5, 24.5], [11.5, 27]], t: 8 }]);

  /* ═════════ capítulo 8 — Mestre da Água ═════════ */
  lvl('c8-1', 'Duas Bombas', { chapter: 7, need: 80, tip: 'Duas camadas de pedra rachada, duas bombas. Rebenta as duas!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 4, 'w');
    g.rect(0, 9, 23, 10, 'R'); g.rect(4, 9, 7, 10, 'k'); g.put(5, 9, 'X');
    g.rect(0, 18, 23, 19, 'R'); g.rect(16, 18, 19, 19, 'k'); g.put(18, 18, 'X');
    g.pot(10, 27);
    g.bud(8, 6); g.bud(10, 15); g.bud(17, 23);
  }, [{ tap: [5.5, 9.5] }, { tap: [18.5, 18.5] }, { d: [[11.5, 5.2], [8.5, 6.5], [5.5, 8.2]], t: .5 }, { d: [[5.5, 11.2], [10.5, 15.5], [17.5, 17.2]], t: .5 }, { d: [[17.5, 20.2], [17.5, 23.5], [11.5, 27]], t: .5 }]);

  lvl('c8-2', 'Válvula do Meio', { chapter: 7, need: 100, tip: 'Três válvulas: duas guardam água e a do meio guarda lodo. Abre só as certas!' }, g => {
    g.floor(30);
    g.basin(1, 0, 6, 3, 'w'); g.rect(0, 4, 7, 4, 'R'); g.rect(2, 4, 5, 4, 'V');
    g.basin(9, 0, 14, 3, 'p'); g.rect(8, 4, 15, 4, 'R'); g.rect(10, 4, 13, 4, 'V');
    g.basin(17, 0, 22, 3, 'w'); g.rect(16, 4, 23, 4, 'R'); g.rect(18, 4, 21, 4, 'V');
    g.pot(10, 27);
    g.bud(5, 10); g.bud(18, 10); g.bud(11, 21);
  }, [{ d: [[3.5, 5.5], [5.5, 10.5], [11, 16]] }, { d: [[19.5, 5.5], [18.5, 10.5], [12, 16]] }, { d: [[11.5, 16], [11.5, 21.5], [11.5, 27]] }, { tap: [3.5, 4.5], t: .3 }, { tap: [19.5, 4.5], t: .3 }]);

  lvl('c8-3', 'Torneira Preguiçosa', { chapter: 7, need: 140, spout: 260, spoutKey: 'A', tip: 'A poça pequena só chega para encher o copo — e o copo liga a torneira grande.' }, g => {
    g.floor(30);
    g.basin(19, 1, 21, 2, 'w', { air: 1 });
    g.put(20, 13, 'a'); g.rect(18, 14, 22, 14, 'R');
    g.put(4, 3, 'O'); g.air(3, 4, 5, 5); g.rect(2, 6, 6, 6, 'R');
    g.pot(10, 27);
    g.bud(20, 8); g.bud(8, 11); g.bud(11, 19);
  }, [{ d: [[20.5, 3.2], [20.5, 8.5], [20.5, 12.4]] }, { d: [[5.6, 5.5], [7.5, 5.7], [7.5, 8], [8.5, 11.5], [11.5, 19.5], [11.5, 27]] }]);

  lvl('c8-4', 'Bomba no Musgo', { chapter: 7, need: 80, tip: 'Não há lodo para matar o musgo… mas há uma bomba mesmo ao lado!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w');
    g.rect(0, 14, 23, 15, 'R'); g.rect(10, 14, 12, 15, 'm'); g.put(11, 14, 'X');
    g.pot(10, 27);
    g.bud(6, 8); g.bud(17, 10); g.bud(11, 21);
  }, [{ tap: [11.5, 14.5] }, { d: [[11.5, 4.2], [6.5, 8.5], [17.5, 10.5], [12.5, 12.6], [11.5, 16], [11.5, 21.5], [11.5, 27]], t: .6 }]);

  lvl('c8-5', 'Torneira Quente', { chapter: 7, need: 90, spout: 260, tip: 'A torneira dá água à placa quente; o vapor sobe até à nuvem por cima do vaso. Foge do lodo!' }, g => {
    g.floor(31);
    g.put(19, 16, 'O'); g.air(18, 17, 20, 18); g.rect(17, 19, 21, 19, 'R');
    g.basin(2, 22, 5, 23, 'p', { air: 1 });
    g.put(11, 28, 'H'); g.put(12, 28, 'H'); g.rect(10, 29, 13, 29, 'R');
    g.air(1, 3, 9, 9); g.rect(0, 2, 10, 2, 'R'); g.rect(0, 3, 0, 11, 'R'); g.rect(10, 3, 10, 11, 'R'); g.rect(2, 3, 8, 3, 'C');
    g.pot(4, 10); g.rect(1, 12, 7, 12, 'R');
    g.bud(22, 22); g.bud(16, 26); g.bud(5, 7);
  }, [{ d: [[20.6, 18.5], [22.5, 18.7], [22.5, 22.5], [16.5, 26.5], [12.5, 28.4]] }, { d: [[11.5, 27.6], [9.5, 22], [8.6, 15], [8.6, 12.6], [8.6, 9]] }]);

  lvl('c8-6', 'Chuva na Comporta', { chapter: 7, need: 90, tip: 'A água grande está presa pela comporta. O copo está lá em cima, debaixo da nuvem… faz chover!' }, g => {
    g.floor(31);
    g.basin(9, 0, 14, 3, 'w'); g.rect(8, 4, 15, 4, 'R'); g.rect(10, 4, 13, 4, 'A');
    g.air(17, 2, 22, 7); g.rect(16, 1, 23, 1, 'R'); g.rect(16, 2, 16, 9, 'R'); g.rect(23, 2, 23, 9, 'R'); g.rect(18, 2, 21, 2, 'C');
    g.put(20, 7, 'a'); g.rect(18, 8, 22, 8, 'R');
    g.basin(1, 22, 5, 24, 'w', { air: 2 });
    g.put(8, 28, 'H'); g.put(9, 28, 'H'); g.rect(7, 29, 10, 29, 'R');
    g.pot(10, 18);
    g.bud(7, 10); g.bud(15, 13); g.bud(4, 27);
  }, [{ d: [[3, 25.2], [4.5, 27.5], [8.5, 28.4]] }, { d: [[9, 27.6], [14, 22], [17.5, 14], [17.5, 8]] }, { d: [[11.5, 5.2], [7.5, 10.5], [15.5, 13.5], [11.5, 16.5], [11.5, 18]] }]);

  lvl('c8-7', 'Bomba e Comporta', { chapter: 7, need: 90, tip: 'A bomba solta a poça pequena para o copo; o copo abre a comporta da poça grande.' }, g => {
    g.floor(30);
    g.basin(2, 0, 6, 3, 'w'); g.rect(1, 4, 7, 5, 'k'); g.put(4, 4, 'X');
    g.put(4, 12, 'a'); g.rect(2, 13, 6, 13, 'R');
    g.basin(10, 9, 14, 13, 'w', { air: 0 }); g.rect(9, 14, 15, 14, 'R'); g.rect(11, 14, 13, 14, 'A');
    g.pot(10, 27);
    g.bud(4, 8); g.bud(17, 19); g.bud(11, 24);
  }, [{ tap: [4.5, 4.5] }, { d: [[4.5, 6.5], [4.5, 8.5], [4.5, 11.4]], t: .5 }, { d: [[12, 15.2], [17.5, 19.5], [11.5, 24.5], [11.5, 27]], t: 3 }]);

  lvl('c8-8', 'Duas Torneiras', { chapter: 7, need: 220, spout: 200, spoutKey: 'A', tip: 'Muita sede! Enche o copo e as duas torneiras abrem-se ao mesmo tempo.' }, g => {
    g.floor(30);
    g.basin(10, 1, 13, 2, 'w', { air: 1 });
    g.put(3, 8, 'a'); g.rect(1, 9, 5, 9, 'R');
    g.put(2, 14, 'O'); g.air(1, 15, 3, 16); g.rect(0, 17, 4, 17, 'R');
    g.put(21, 14, 'O'); g.air(20, 15, 22, 16); g.rect(19, 17, 23, 17, 'R');
    g.pot(10, 27);
    g.bud(8, 6); g.bud(5, 21); g.bud(18, 21);
  }, [{ d: [[11.5, 3.2], [8.5, 6.5], [3.5, 7.4]] }, { d: [[3.6, 16.5], [5.5, 16.7], [5.5, 21.5], [11, 25], [11.5, 27]] }, { d: [[19.4, 16.5], [17.5, 16.7], [18.5, 21.5], [12, 25]] }]);

  lvl('c8-9', 'Engenho de Vapor', { chapter: 7, need: 90, spout: 280, tip: 'A chaminé está tapada por pedra rachada. Rebenta-a e põe o engenho a trabalhar!' }, g => {
    g.floor(31);
    g.put(4, 17, 'O'); g.air(3, 18, 5, 19); g.rect(2, 20, 6, 20, 'R');
    g.put(11, 28, 'H'); g.put(12, 28, 'H'); g.rect(10, 29, 13, 29, 'R');
    g.air(13, 3, 21, 9); g.rect(12, 2, 22, 2, 'R'); g.rect(12, 3, 12, 11, 'R'); g.rect(22, 3, 22, 12, 'R'); g.rect(14, 3, 20, 3, 'C');
    g.pot(16, 10); g.rect(14, 12, 21, 12, 'R');
    g.rect(0, 16, 23, 16, 'R'); g.rect(11, 16, 14, 16, 'k'); g.put(13, 15, 'X');
    g.bud(6, 24); g.bud(9, 26); g.bud(17, 8);
  }, [{ tap: [13.5, 15.5] }, { d: [[5.6, 19.5], [7.5, 19.7], [6.5, 24.5], [9.5, 26.5], [11, 28.4]], t: .5 }, { d: [[11.5, 27.6], [12.5, 20], [12.8, 16], [13.4, 13], [13.5, 9]], t: .5 }]);

  lvl('c8-10', 'Mestre da Água', { chapter: 7, need: 110, tip: 'Lodo na rolha de musgo, bomba na pedra, válvula na água. A última prova do Rebento!' }, g => {
    g.floor(30);
    g.basin(9, 0, 14, 3, 'w'); g.rect(8, 4, 15, 4, 'R'); g.rect(10, 4, 13, 4, 'V');
    g.basin(1, 0, 4, 2, 'p'); g.basin(19, 0, 22, 2, 'l');
    g.rect(0, 12, 23, 13, 'R'); g.rect(10, 12, 12, 13, 'm');
    g.rect(0, 18, 23, 19, 'R'); g.rect(10, 18, 13, 19, 'k'); g.put(11, 18, 'X');
    g.pot(10, 27);
    g.bud(7, 8); g.bud(15, 15); g.bud(11, 23);
  }, [{ d: [[2.5, 3.2], [4, 9], [10.5, 11.3]] }, { tap: [11.5, 18.5] }, { d: [[11.5, 5.5], [7.5, 8.5], [11, 11.3]] }, { tap: [11.5, 4.5], t: 3 }, { d: [[11.5, 14.2], [15.5, 15.5], [11.5, 17], [11.5, 20.5], [11.5, 23.5], [11.5, 27]], t: 12 }]);

  /* um nível pronto a jogar (mapa em texto + dados) */
  function get(i) {
    const D = L[i], g = grid();
    D.build(g);
    return Object.assign({}, D, { index: i, map: g.m.map(r => r.join('')), seed: 7 + i * 13 });
  }

  return { LEVELS: L, CHAPTERS, get, grid };
})();
if (typeof module !== 'undefined') module.exports = DripLevels;
