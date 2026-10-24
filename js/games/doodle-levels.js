/* ══════════════════════════════════════════════════════════════════
   Traço a Traço — níveis. Coordenadas em px lógicos (480×720, y para
   baixo); objetos com x,y = centro (exceto 'ground': polígono, 'spikes':
   canto esquerdo da base, 'cup': centro do fundo).

   Cada nível traz `sol` (uma solução verificada em Node por
   node_modules/.doodle-check.cjs) e `par` = [traços, tinta] para as
   estrelas: ★ resolver · ★ com ≤ par[0] traços · ★ com ≤ par[1] de tinta.
══════════════════════════════════════════════════════════════════ */
const DoodleLevels = (function () {
  'use strict';

  /* ── ajudas de autor ── */
  const box = (x0, y0, x1, y1, mat) => ({ k: 'ground', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], mat });
  const gnd = (pts, mat) => ({ k: 'ground', pts, mat });
  const ball = (x, y, role, o) => Object.assign({ k: 'ball', x, y, r: 15, role: role || 'hero' }, o || {});
  const star = (x, y) => ({ k: 'star', x, y });
  const line = (...pts) => ({ d: pts });
  /* forma fechada (volta ao início) */
  const shape = (...pts) => ({ d: pts.concat([pts[0]]) });
  const circ = (cx, cy, r, n) => { const P = []; n = n || 14; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return { d: P }; };
  const at = (t, a) => Object.assign({ t }, a);
  const peg = (x, y, w, h) => ({ k: 'rect', x, y, w: w || 14, h: h || 14, mat: 'metal' });
  const marble = (x, y) => ({ k: 'ball', x, y, r: 12, role: 'ball' });
  const pin = (x, y) => ({ pin: [x, y] });
  const rope = (a, b) => ({ rope: [a, b] });
  const cup = (x, y, w, h) => ({ k: 'cup', x, y, w: w || 96, h: h || 64 });

  const CHAPTERS = [
    { name: 'Primeiros Traços', icon: '✏️', desc: 'Tudo o que desenhas cai, rola e choca. Pontes, rampas e empurrões.', grad: ['#ff9a5a', '#f2617a'] },
    { name: 'Amigos', icon: '💞', desc: 'A Bolota e a Lua querem estar juntas. Leva uma até à outra.', grad: ['#4fa8ff', '#8b5cf6'] },
    { name: 'Cestos', icon: '🧺', desc: 'Berlindes por todo o lado. Guia-os até ao cesto com rampas, funis e tabelas.', grad: ['#13a77a', '#00a6c8'] },
    { name: 'Pinos', icon: '📌', desc: 'Um pino prende ao fundo e deixa rodar; dois pinos seguram de vez. Martelos, baloiços e rampas no ar.', grad: ['#ff6b4a', '#c2185b'] },
    { name: 'Cordas', icon: '🪢', desc: 'Arrasta uma corda entre dois pontos: segura, balança, pendura pontes e bolas de demolição.', grad: ['#c98a3a', '#7a4a1e'] },
    { name: 'Desafios', icon: '🏆', desc: 'Pedras a cair, botões, portas e caixas teimosas. Tudo o que aprendeste, junto.', grad: ['#5b6170', '#23202b'] },
  ];

  const LEVELS = [
    /* ───────────── capítulo 1 ───────────── */
    { id: 'c1-1', chapter: 0, name: 'A Ponte', goal: 'star', ink: 400, par: [1, 170],
      tip: 'Desenha uma ponte sobre o buraco para a Bolota chegar à estrela.',
      objs: [gnd([[0, 330], [190, 400], [190, 720], [0, 720]]), box(300, 420, 480, 720), ball(40, 330), star(420, 392)],
      sol: [line([170, 384], [316, 406])] },
    { id: 'c1-2', chapter: 0, name: 'Empurrão', goal: 'star', ink: 400, par: [1, 70],
      tip: 'A Bolota está parada. Deixa cair qualquer coisa ao lado dela para a empurrar.',
      objs: [box(0, 440, 120, 720), gnd([[140, 440], [200, 440], [480, 520], [480, 720], [140, 720]]), ball(176, 424), star(430, 488)],
      sol: [line([130, 360], [168, 396])] },
    { id: 'c1-3', chapter: 0, name: 'O Salto', goal: 'star', ink: 400, par: [1, 120],
      tip: 'O muro trava a Bolota. Encosta-lhe uma rampa!',
      objs: [gnd([[0, 250], [250, 470], [300, 470], [300, 400], [480, 400], [480, 720], [0, 720]]), ball(30, 262), star(420, 370)],
      sol: [line([196, 410], [298, 392])] },
    { id: 'c1-4', chapter: 0, name: 'Picos!', goal: 'star', ink: 400, par: [1, 270],
      tip: 'A Bolota vai cair. Tapa o buraco dos picos com uma tampa inclinada.',
      objs: [gnd([[0, 400], [60, 400], [190, 560], [190, 720], [0, 720]]), box(300, 460, 480, 720), box(190, 600, 300, 720), { k: 'spikes', x: 190, y: 600, w: 110 },
        ball(130, 140), star(425, 430)],
      sol: [line([92, 424], [318, 450])] },
    { id: 'c1-5', chapter: 0, name: 'Catapulta', goal: 'star', ink: 500, par: [1, 250],
      tip: 'Formas fechadas ficam cheias e pesam mais. Deixa cair uma do lado de lá do baloiço.',
      objs: [box(0, 640, 480, 720), { k: 'plank', x: 240, y: 560, w: 320, h: 14, pivot: [240, 560], post: 80, lip: 'l' }, ball(100, 538), star(282, 372)],
      sol: [circ(360, 200, 34)] },
    { id: 'c1-6', chapter: 0, name: 'Zona Riscada', goal: 'star', ink: 500, par: [1, 340],
      tip: 'Não podes desenhar na zona riscada… mas o que desenhares por cima pode cair lá para dentro.',
      objs: [gnd([[0, 330], [190, 400], [190, 720], [0, 720]]), box(190, 450, 290, 720), box(290, 400, 480, 720), { k: 'nodraw', x: 240, y: 360, w: 104, h: 150 },
        ball(40, 330), star(420, 370)],
      sol: [shape([197, 200], [283, 200], [283, 258], [197, 258])] },

    /* ───────────── capítulo 2: juntar a Bolota e a Lua ───────────── */
    { id: 'c2-1', chapter: 1, name: 'Encontro', goal: 'touch', ink: 400, par: [1, 170],
      tip: 'A Bolota e a Lua querem encontrar-se. Não as deixes cair nos picos!',
      objs: [gnd([[0, 330], [180, 420], [180, 720], [0, 720]]), box(300, 420, 480, 720), box(180, 620, 300, 720), { k: 'spikes', x: 180, y: 620, w: 120 },
        ball(36, 332), ball(336, 405, 'hero2')],
      sol: [line([168, 404], [312, 408])] },
    { id: 'c2-2', chapter: 1, name: 'Lá de Cima', goal: 'touch', ink: 400, par: [1, 150],
      tip: 'A Bolota vai cair pelo buraco. Desvia-a para o lado da Lua.',
      objs: [box(0, 380, 200, 720), box(280, 430, 480, 720), ball(240, 130), ball(420, 415, 'hero2')],
      sol: [line([184, 360], [292, 420])] },
    { id: 'c2-3', chapter: 1, name: 'A Torre', goal: 'touch', ink: 400, par: [1, 60],
      tip: 'Derruba a caixa e a Bolota cai ao pé da Lua.',
      objs: [box(0, 470, 200, 720), gnd([[200, 560], [440, 600], [480, 600], [480, 720], [200, 720]]), box(466, 520, 480, 600), { k: 'crate', x: 150, y: 400, w: 50, h: 140 }, ball(150, 315), ball(450, 585, 'hero2')],
      sol: [line([96, 262], [140, 290])] },
    { id: 'c2-4', chapter: 1, name: 'Voo da Lua', goal: 'touch', ink: 500, par: [1, 250],
      tip: 'A Lua está no baloiço. Lança-a até à Bolota!',
      objs: [box(0, 640, 480, 720), { k: 'plank', x: 240, y: 560, w: 320, h: 14, pivot: [240, 560], post: 80, lip: 'l' }, box(416, 507, 480, 524), ball(100, 538, 'hero2'), ball(452, 492)],
      sol: [circ(360, 200, 34)] },
    { id: 'c2-5', chapter: 1, name: 'Visita', goal: 'touch', ink: 400, par: [1, 100],
      tip: 'Empurra a Lua da prateleira — a Bolota está lá em baixo à espera.',
      objs: [gnd([[0, 560], [120, 640], [200, 640], [200, 720], [0, 720]]), box(200, 640, 480, 720), box(250, 420, 480, 450), ball(160, 625), ball(266, 405, 'hero2')],
      sol: [circ(290, 330, 13)] },
    { id: 'c2-6', chapter: 1, name: 'Duas Pontes', goal: 'touch', ink: 350, par: [2, 260],
      tip: 'Dois buracos, pouca tinta. Uma ponte para cada uma.',
      objs: [gnd([[0, 300], [140, 380], [140, 720], [0, 720]]), box(220, 420, 260, 720), gnd([[340, 720], [340, 380], [480, 300], [480, 720]]),
        ball(30, 302), ball(450, 302, 'hero2')],
      sol: [line([128, 362], [226, 410]), line([352, 362], [254, 410])] },

    /* ───────────── capítulo 3: cestos ───────────── */
    { id: 'c3-1', chapter: 2, name: 'Cesto', goal: 'cup', need: 3, ink: 450, par: [1, 340],
      tip: 'Os berlindes vão rolar para o lado errado. Apoia uma rampa nos pinos de metal.',
      objs: [gnd([[300, 200], [480, 170], [480, 210], [300, 230]]), gnd([[40, 690], [380, 650], [380, 720], [40, 720]]), box(380, 650, 480, 720), box(466, 330, 480, 650), cup(420, 650, 90),
        peg(170, 412), peg(360, 480), marble(330, 182), marble(370, 175), marble(410, 168)],
      sol: [line([148, 380], [420, 479])] },
    { id: 'c3-2', chapter: 2, name: 'Tabela', goal: 'cup', need: 3, ink: 650, par: [1, 490],
      tip: 'Os berlindes saltam por cima do cesto. Põe-lhes uma parede no caminho.',
      objs: [gnd([[0, 250], [170, 380], [170, 720], [0, 720]]), box(170, 650, 480, 720), cup(268, 650),
        marble(26, 252), marble(56, 274), marble(86, 297)],
      sol: [shape([322, 480], [372, 480], [372, 640], [322, 640])] },
    { id: 'c3-3', chapter: 2, name: 'Comporta', goal: 'cup', need: 3, ink: 400, par: [1, 180],
      tip: 'Uma porta segura os berlindes. Algo pesado no botão abre-a.',
      objs: [gnd([[0, 300], [300, 340], [300, 370], [0, 330]]), box(0, 650, 480, 720), cup(410, 650),
        { k: 'gate', x: 306, y: 300, w: 12, h: 80, btn: { x: 120, y: 650, w: 50 } },
        marble(60, 293), marble(120, 301), marble(180, 309)],
      sol: [circ(120, 520, 24)] },
    { id: 'c3-4', chapter: 2, name: 'Buraco Guloso', goal: 'cup', need: 3, ink: 400, par: [1, 170],
      tip: 'O cesto está enterrado no chão. Faz os berlindes passar o buraco grande.',
      objs: [gnd([[0, 300], [190, 400], [190, 720], [0, 720]]), box(310, 420, 350, 720), box(350, 474, 450, 720), box(450, 420, 480, 720), cup(400, 474, 100, 54),
        marble(30, 304), marble(60, 320), marble(90, 336)],
      sol: [line([176, 380], [320, 407])] },
    { id: 'c3-5', chapter: 2, name: 'Zigue-Zague', goal: 'cup', need: 3, ink: 950, par: [2, 710],
      tip: 'O cesto está lá em baixo, do outro lado. Duas rampas em zigue-zague!',
      objs: [gnd([[0, 140], [150, 170], [150, 190], [0, 160]]), box(466, 160, 480, 384), box(0, 640, 140, 720), gnd([[140, 640], [480, 690], [480, 720], [140, 720]]), cup(70, 640, 110, 60),
        peg(196, 262), peg(396, 336), peg(420, 436), peg(230, 500), marble(40, 136), marble(70, 142), marble(100, 148)],
      sol: [line([170, 236], [430, 326]), line([472, 397], [150, 510])] },

    /* ───────────── capítulo 4: pinos ───────────── */
    { id: 'c4-1', chapter: 3, name: 'Rampa no Ar', goal: 'star', ink: 500, pins: 2, plan: true, par: [1, 370],
      tip: 'Com dois pinos, um traço fica preso no ar. Põe os pinos, desenha por cima e carrega ▶.',
      objs: [box(0, 650, 140, 720), ball(70, 130), star(404, 424)],
      sol: [pin(80, 276), pin(290, 362), line([40, 260], [330, 378])] },
    { id: 'c4-2', chapter: 3, name: 'Martelo', goal: 'star', ink: 600, pins: 1, plan: true, par: [1, 430],
      tip: 'Um só pino deixa a peça rodar. Desenha uma barra no ar, prende-lhe uma ponta e ela cai como um martelo.',
      objs: [box(0, 330, 260, 720), box(320, 420, 480, 720), ball(196, 315), star(420, 392)],
      sol: [shape([96, 168], [256, 168], [256, 192], [96, 192]), pin(244, 180)] },
    { id: 'c4-3', chapter: 3, name: 'Baloiço Caseiro', goal: 'star', ink: 400, pins: 1, plan: true, par: [1, 230],
      tip: 'A tábua está solta. Prende-a no topo do poste com um pino e deixa cair algo pesado do outro lado.',
      objs: [box(0, 640, 480, 720), gnd([[226, 640], [240, 560], [254, 640]]), { k: 'plank', x: 240, y: 554, w: 320, h: 12, lip: 'l' }, ball(100, 533), star(172, 446)],
      sol: [pin(240, 554), circ(370, 300, 32)] },
    { id: 'c4-4', chapter: 3, name: 'Funil Suspenso', goal: 'cup', need: 3, ink: 550, pins: 2, plan: true, par: [1, 410],
      tip: 'Os berlindes caem a direito. Prende uma rampa no ar que os leve até ao cesto.',
      objs: [gnd([[0, 690], [360, 650], [360, 720], [0, 720]]), box(360, 650, 480, 720), box(466, 300, 480, 650), cup(410, 650, 100, 64),
        marble(60, 120), marble(90, 90), marble(120, 60)],
      sol: [pin(80, 262), pin(280, 388), line([30, 230], [330, 420])] },
    { id: 'c4-5', chapter: 3, name: 'Tacada', goal: 'star', ink: 650, pins: 1, plan: true, par: [1, 490],
      tip: 'A Bolota tem de passar o monte. Um martelo pesado dá-lhe a tacada certa.',
      objs: [box(0, 560, 300, 720), gnd([[300, 560], [330, 538], [360, 560], [480, 590], [480, 720], [300, 720]]), ball(196, 545), star(436, 560)],
      sol: [shape([34, 358], [216, 358], [216, 386], [34, 386]), pin(204, 372)] },

    /* ───────────── capítulo 5: cordas ───────────── */
    { id: 'c5-1', chapter: 4, name: 'Segura!', goal: 'star', ink: 400, ropes: 1, plan: true, par: [1, 250],
      tip: 'Arrasta uma corda de um ponto vazio até à Bolota: a ponta solta fica pregada no ar.',
      objs: [gnd([[0, 250], [440, 560], [480, 560], [480, 720], [0, 720]]), { k: 'spikes', x: 380, y: 560, w: 100 }, ball(40, 262), star(340, 382)],
      sol: [rope([240, 200], [40, 262])] },
    { id: 'c5-2', chapter: 4, name: 'Tarzan', goal: 'star', ink: 450, ropes: 1, plan: true, par: [1, 330],
      tip: 'A Bolota vai cair no fosso. Uma corda presa lá em cima faz dela um pêndulo.',
      objs: [gnd([[0, 330], [110, 370], [110, 720], [0, 720]]), box(110, 640, 480, 720), { k: 'spikes', x: 110, y: 640, w: 370 }, ball(40, 330), star(400, 360)],
      sol: [rope([240, 130], [40, 330])] },
    { id: 'c5-3', chapter: 4, name: 'Ponte Suspensa', goal: 'star', ink: 700, ropes: 2, plan: true, par: [3, 510],
      tip: 'As margens estão riscadas. Pendura uma ponte com duas cordas.',
      objs: [gnd([[0, 330], [190, 400], [190, 720], [0, 720]]), box(350, 400, 480, 720), { k: 'nodraw', x: 180, y: 380, w: 40, h: 100 }, { k: 'nodraw', x: 360, y: 380, w: 40, h: 100 },
        ball(40, 330), star(430, 372)],
      sol: [line([208, 408], [332, 408]), rope([196, 250], [212, 408]), rope([344, 250], [328, 408])] },
    { id: 'c5-4', chapter: 4, name: 'Bola de Demolição', goal: 'off', offY: 600, ink: 600, ropes: 1, plan: true, par: [2, 450],
      tip: 'Deita a caixa abaixo da linha vermelha. Uma bola pesada pendurada numa corda tem muita força.',
      objs: [box(300, 360, 380, 720), { k: 'crate', x: 324, y: 330, w: 44, h: 60, role: 'target' }, { k: 'line', y: 600 }],
      sol: [circ(100, 170, 30), rope([290, 120], [100, 170])] },
    { id: 'c5-5', chapter: 4, name: 'Por Cima do Muro', goal: 'star', ink: 400, ropes: 1, plan: true, par: [1, 220],
      tip: 'A Bolota vai cair nos picos. Apanha-a com uma corda e balança-a por cima do muro.',
      objs: [box(0, 640, 480, 720), { k: 'spikes', x: 0, y: 640, w: 225 }, { k: 'spikes', x: 255, y: 640, w: 225 },
        box(225, 470, 255, 720), ball(60, 200), star(392, 312)],
      sol: [rope([250, 200], [60, 200])] },

    /* ───────────── capítulo 6: desafios ───────────── */
    { id: 'c6-1', chapter: 5, name: 'Chuva de Pedras', goal: 'protect', hold: 6, ink: 450, par: [1, 330],
      tip: 'Vêm aí pedras! Desenha um telhado por cima do ovo antes que caiam.',
      objs: [box(0, 640, 480, 720), { k: 'egg', x: 240, y: 622 }, { k: 'rocks', x0: 170, x1: 310, y: -30, n: 6, t: 1.2 }],
      sol: [line([172, 626], [172, 566], [204, 534], [276, 534], [308, 566], [308, 626])] },
    { id: 'c6-2', chapter: 5, name: 'Pista de Gelo', goal: 'off', offY: 600, ink: 300, par: [1, 160],
      tip: 'Deita a caixa abaixo da linha vermelha. No gelo tudo escorrega…',
      objs: [gnd([[0, 200], [200, 330], [330, 330], [330, 352], [0, 352]], 'ice'), box(330, 660, 480, 720), { k: 'crate', x: 262, y: 305, w: 50, h: 50, role: 'target' }, { k: 'line', y: 600 }],
      sol: [circ(60, 150, 22)] },
    { id: 'c6-3', chapter: 5, name: 'Botão Pesado', goal: 'star', ink: 400, par: [1, 160],
      tip: 'A porta só abre com peso no botão.',
      objs: [gnd([[0, 300], [200, 360], [200, 380], [0, 330]]), box(0, 640, 480, 720), { k: 'gate', x: 206, y: 320, w: 12, h: 80, btn: { x: 380, y: 640, w: 60 } },
        box(250, 480, 480, 500), ball(40, 302), star(430, 455)],
      sol: [circ(380, 560, 22)] },
    { id: 'c6-4', chapter: 5, name: 'Guarda-Chuva', goal: 'protect', hold: 6, ink: 300, pins: 2, plan: true, par: [1, 190],
      tip: 'O ovo está num poste e não há onde apoiar um telhado. Prende-o no ar com pinos!',
      objs: [box(220, 560, 260, 720), { k: 'egg', x: 240, y: 542 }, { k: 'rocks', x0: 196, x1: 284, y: -30, n: 6, t: 1 }],
      sol: [line([176, 488], [206, 456], [240, 446], [274, 456], [304, 488]), pin(196, 462), pin(284, 462)] },
    { id: 'c6-5', chapter: 5, name: 'Golpe Certeiro', goal: 'star', ink: 500, ropes: 1, plan: true, par: [2, 350],
      tip: 'A porta abre com o botão lá em cima, mas não se pode desenhar por cima dele. Uma bola numa corda chega lá.',
      objs: [gnd([[0, 300], [200, 360], [200, 380], [0, 330]]), gnd([[0, 640], [480, 680], [480, 720], [0, 720]]), { k: 'gate', x: 206, y: 320, w: 12, h: 80, btn: { x: 430, y: 300, w: 60 } },
        box(380, 300, 480, 320), { k: 'nodraw', x: 410, y: 140, w: 140, h: 280 }, ball(40, 302), star(400, 640)],
      sol: [circ(270, 132, 22), rope([430, 118], [270, 132])] },
  ];

  return { CHAPTERS, LEVELS, get: i => LEVELS[i] };
})();
if (typeof module !== 'undefined') module.exports = DoodleLevels;
