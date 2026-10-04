/* ══════════════════════════════════════════════════════════════════
   Mundos de Pip — níveis (4 mundos × 3; o Escaravelho-Rei fica sempre no fim).
   A ordem do array é a ordem de desbloqueio; os ids (L1…L12) não mudam
   por causa dos recordes guardados.
   Cada nível é construído com um pequeno "construtor" que escreve o
   mapa de tiles (o mesmo formato de texto que o motor lê):

     .  ar            #  terra (relva/areia/neve em cima)   %  pedra
     B  tijolo        ?  bloco-estrela (moeda)   P  poder (fogo/coração)
     !  estrela       H  coração       h  bloco escondido (5 moedas)
     =  plataforma de passagem (só por cima)
     / \  rampas 45°   a b  rampa suave a subir   c d  a descer
     ^  picos         ~  lava          F  parede falsa (atravessa-se)
     S  início  G  meta (arco)  K  lanterna   o  moeda   *  pena dourada
     e  lagarta  s  castanha-espinhosa  f  abelha  l  salpico de lava  W  Escaravelho-Rei
     u  mola    R  acelerador   O  loop (centro, no chão)
     m  plataforma ↔   v  plataforma ↕   x  plataforma que cai
     T  roda de cristais   X Y Z  portas (aos pares)

   Coordenadas: x = coluna, y = linha (0 em cima). Altura 18 linhas;
   o chão "normal" tem o topo na linha 15.
══════════════════════════════════════════════════════════════════ */
const PIP_LEVELS = (function () {
  'use strict';
  const H = 18;

  function build(meta, w, fn) {
    const t = Array.from({ length: H }, () => Array(w).fill('.'));
    const set = (x, y, ch) => { if (x >= 0 && x < w && y >= 0 && y < H) t[y][x] = ch; };
    const b = {
      set,
      rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); },
      /* chão de x0 a x1 com o topo na linha `top` */
      ground(x0, x1, top, ch) { b.rect(x0, top, x1, H - 1, ch || '#'); },
      str(x, y, s) { [...s].forEach((c, i) => { if (c !== ' ') set(x + i, y, c); }); },
      /* rampa de 45° a subir n degraus, a começar num chão com topo `top` (devolve o novo topo) */
      up(x, top, n) { for (let i = 0; i < n; i++) { set(x + i, top - 1 - i, '/'); b.rect(x + i, top - i, x + i, H - 1, '#'); } return top - n; },
      down(x, top, n) { for (let i = 0; i < n; i++) { set(x + i, top + i, '\\'); b.rect(x + i, top + i + 1, x + i, H - 1, '#'); } return top + n; },
      /* rampa suave: sobe 1 linha a cada 2 colunas */
      upG(x, top, n) { for (let i = 0; i < n; i++) { set(x + 2 * i, top - 1 - i, 'a'); set(x + 2 * i + 1, top - 1 - i, 'b'); b.rect(x + 2 * i, top - i, x + 2 * i + 1, H - 1, '#'); } return top - n; },
      downG(x, top, n) { for (let i = 0; i < n; i++) { set(x + 2 * i, top + i, 'c'); set(x + 2 * i + 1, top + i, 'd'); b.rect(x + 2 * i, top + i + 1, x + 2 * i + 1, H - 1, '#'); } return top + n; },
      /* escadaria de blocos (fim de nível) */
      stairs(x, top, n, ch, dir) { for (let i = 0; i < n; i++) { const h = dir === -1 ? n - i : i + 1; b.rect(x + i, top - h, x + i, top - 1, ch || '%'); } },
      coins(x0, x1, y) { for (let x = x0; x <= x1; x++) set(x, y, 'o'); },
      /* arco de moedas por cima de um salto */
      arc(x0, x1, y, hgt) { const n = x1 - x0; for (let i = 0; i <= n; i++) { const k = n ? i / n : .5; set(x0 + i, Math.round(y - Math.sin(k * Math.PI) * hgt), 'o'); } },
      /* sala fechada (paredes de pedra) — interior de x0+1..x1-1, y0+1..y1-1 */
      room(x0, y0, x1, y1, ch) { b.rect(x0, y0, x1, y1, ch || '%'); b.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, '.'); },
    };
    fn(b);
    return Object.assign({ map: t.map(r => r.join('')) }, meta);
  }

  return [
    /* ════════════ MUNDO 1 · PRADO VERDE ════════════ */
    build({ id: 'L1', world: 0, name: 'Prado das Papoilas', par: 110 }, 196, b => {
      b.ground(0, 24, 15);
      b.str(3, 14, 'S');
      b.coins(8, 11, 11);
      b.str(14, 11, '?BPB?');
      b.str(16, 7, '?');
      b.str(22, 14, 'e');
      /* primeiro buraco (3) */
      b.arc(24, 29, 12, 2);
      b.ground(28, 40, 15);
      /* mola → saliência alta com a 1.ª pena dourada */
      b.str(30, 14, 'u');
      b.rect(32, 7, 39, 7, '%');
      b.coins(33, 36, 6); b.str(38, 6, '*');
      b.str(36, 14, 'e');
      /* colina: sobe, planalto, desce até ao loop */
      let top = b.up(41, 15, 3);
      b.ground(44, 50, top);
      b.coins(45, 49, top - 3);
      b.str(48, top - 1, 'e');
      top = b.down(51, top, 3);
      b.ground(54, 78, 15);
      b.str(59, 14, 'R');
      b.str(64, 14, 'O');
      b.str(64, 9, 'o'); b.str(61, 10, 'o'); b.str(67, 10, 'o'); b.str(59, 13, 'o'); b.str(60, 13, 'o');
      b.str(74, 14, 'e');
      b.str(77, 14, 'K');
      /* plataformas sobre um barranco */
      b.rect(81, 12, 83, 12, '=');
      b.rect(86, 10, 88, 10, '=');
      b.rect(91, 12, 93, 12, '=');
      b.coins(81, 83, 11); b.coins(86, 88, 9); b.coins(91, 93, 11);
      b.str(87, 6, 'f');
      b.ground(96, 132, 15);
      /* colina com túnel secreto por baixo (parede falsa) */
      b.rect(104, 10, 112, 14, '#');
      b.rect(103, 13, 113, 14, 'F');
      b.rect(100, 12, 101, 12, '=');
      b.coins(99, 102, 14);
      b.str(108, 14, '*');
      b.str(105, 14, 'o'); b.str(111, 14, 'o');
      b.str(107, 9, 'e');
      b.coins(105, 111, 7);
      /* bloco escondido */
      b.str(118, 11, 'h');
      b.str(122, 11, '?B?B?');
      b.str(126, 14, 'e');
      /* porta para a sala de bónus */
      b.str(130, 14, 'X');
      /* reta final: rampas suaves, inimigos e escadaria */
      top = b.upG(133, 15, 2);
      b.ground(137, 141, top);
      top = b.downG(142, top, 2);
      b.ground(146, 172, 15);
      b.str(140, top - 4, 'f');
      b.str(150, 14, 'e'); b.str(154, 14, 'e');
      b.str(150, 11, '?');
      b.stairs(157, 15, 5, '%');
      b.coins(158, 161, 8);
      b.str(167, 14, 'G');
      /* sala de bónus (escondida à direita do mapa) */
      b.room(176, 4, 195, 16);
      b.ground(177, 194, 15, '%');
      b.str(178, 14, 'X');
      b.coins(181, 192, 13); b.coins(182, 191, 10); b.coins(183, 190, 7);
      b.rect(184, 11, 189, 11, '=');
      b.str(186, 6, '*');
      b.rect(183, 8, 190, 8, '=');
    }),

    build({ id: 'L2', world: 0, name: 'Vale do Vento', par: 100 }, 214, b => {
      b.ground(0, 12, 6);
      b.str(2, 5, 'S');
      b.coins(5, 9, 3);
      /* grande descida inicial: embalo! */
      let top = b.down(13, 6, 6);
      top = b.downG(19, top, 3);
      b.ground(25, 52, 15);
      b.str(25, 14, 'R');
      b.str(29, 14, 'O');
      b.str(29, 9, 'o'); b.str(26, 11, 'o'); b.str(32, 11, 'o');
      b.str(38, 14, 'e'); b.str(42, 14, 'e');
      b.str(40, 11, '?P?');
      b.str(46, 14, 'u');
      b.coins(46, 46, 9); b.coins(46, 46, 6); b.coins(46, 46, 3);
      b.rect(49, 4, 54, 4, '=');
      b.str(52, 3, '*');
      b.ground(56, 60, 15);
      b.arc(52, 57, 12, 2);
      top = b.up(61, 15, 4);
      b.ground(65, 70, top);
      b.str(68, top - 1, 's');
      top = b.down(71, top, 4);
      b.ground(75, 104, 15);
      b.str(81, 14, 'R');
      b.str(86, 14, 'O');
      b.str(86, 9, 'o'); b.str(83, 11, 'o'); b.str(89, 11, 'o');
      b.str(96, 14, 'K');
      /* abelhas sobre plataformas */
      b.rect(107, 12, 109, 12, '=');
      b.rect(112, 10, 114, 10, '=');
      b.rect(117, 12, 119, 12, '=');
      b.str(113, 6, 'f'); b.str(118, 8, 'f');
      b.coins(107, 109, 11); b.coins(112, 114, 9); b.coins(117, 119, 11);
      b.ground(122, 150, 15);
      /* segredo: caixotes por cima com uma pena dourada atrás */
      b.rect(128, 9, 136, 9, 'B');
      b.str(130, 9, '?'); b.str(134, 9, '!');
      b.rect(140, 5, 146, 5, '%');
      b.str(143, 4, '*');
      b.rect(138, 9, 139, 9, '=');
      b.rect(124, 12, 126, 12, '=');
      b.str(126, 14, 'e'); b.str(132, 14, 's'); b.str(144, 14, 'e');
      /* rampas suaves e segundo grupo de loops */
      top = b.upG(151, 15, 3);
      b.ground(157, 160, top);
      top = b.down(161, top, 3);
      b.ground(164, 200, 15);
      b.str(170, 14, 'R');
      b.str(175, 14, 'O');
      b.str(175, 9, '*');
      b.str(183, 14, 'e'); b.str(186, 14, 'e');
      b.stairs(189, 15, 4, '%');
      b.str(196, 14, 'G');
      b.coins(190, 193, 9);
    }),

    build({ id: 'L9', world: 0, name: 'Bosque das Molas', par: 120 }, 206, b => {
      b.ground(0, 22, 15);
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      b.str(14, 14, 'e');
      b.coins(16, 20, 12);
      /* mola → trilho alto por cima das copas (pena no fim) */
      b.str(21, 14, 'u');
      b.rect(23, 7, 33, 7, '=');
      b.coins(24, 31, 6);
      b.str(33, 6, '*');
      b.str(29, 3, 'f');
      b.ground(23, 36, 15);
      b.str(27, 14, 'e'); b.str(33, 14, 's');
      /* barranco com plataforma móvel */
      b.str(40, 12, 'm');
      b.coins(39, 45, 10);
      b.ground(50, 72, 15);
      b.str(52, 14, 'K');
      /* colina íngreme com caixas por cima */
      let top = b.up(56, 15, 4);
      b.ground(60, 66, top);
      b.str(64, top - 1, 'e');
      b.str(61, top - 4, '?B?');
      top = b.down(67, top, 4);
      b.ground(71, 96, 15);
      b.str(74, 14, 'R');
      b.str(80, 14, 'O');
      b.str(80, 9, 'o'); b.str(77, 11, 'o'); b.str(83, 11, 'o');
      b.str(89, 14, 'e'); b.str(93, 14, 'e');
      b.str(91, 11, 'h');
      /* poço com plataforma vertical → saliência alta com a 2.ª pena */
      b.str(98, 11, 'v');
      b.ground(103, 130, 15);
      b.rect(103, 7, 109, 7, '%');
      b.str(107, 6, '*');
      b.coins(104, 106, 6);
      b.str(113, 14, 's'); b.str(119, 14, 'e');
      b.str(116, 11, 'B?B');
      /* porta para a toca secreta */
      b.str(125, 14, 'X');
      /* rampa suave e tábuas sobre um buraco largo (com mola para as moedas de cima) */
      top = b.upG(131, 15, 2);
      b.ground(135, 138, top);
      b.str(137, top - 1, 'u');
      b.rect(141, 11, 143, 11, '='); b.rect(147, 10, 149, 10, '=');
      b.coins(141, 143, 10); b.coins(147, 149, 9);
      b.arc(138, 150, 5, 2);
      b.str(146, 4, 'f');
      b.ground(153, 180, 15);
      b.str(157, 14, 'e'); b.str(161, 14, 'e'); b.str(165, 14, 's');
      b.str(159, 11, '?B?');
      b.stairs(168, 15, 5, '%');
      b.coins(169, 172, 8);
      b.str(177, 14, 'G');
      /* toca secreta */
      b.room(184, 4, 205, 16);
      b.ground(185, 204, 15, '%');
      b.str(186, 14, 'X');
      b.coins(189, 201, 14);
      b.rect(190, 11, 193, 11, '='); b.rect(196, 8, 199, 8, '=');
      b.coins(190, 193, 10);
      b.str(198, 7, '*');
      b.str(201, 14, 'e');
    }),

    /* ════════════ MUNDO 2 · DESERTO DOURADO ════════════ */
    build({ id: 'L3', world: 1, name: 'Dunas Douradas', par: 130 }, 220, b => {
      b.ground(0, 18, 15);
      b.str(2, 14, 'S');
      let top = b.upG(19, 15, 2);
      b.ground(23, 26, top);
      top = b.downG(27, top, 2);
      b.ground(31, 44, 15);
      b.str(24, top - 5, '?'); b.str(25, top - 5, 'P');
      b.str(36, 14, 's'); b.str(41, 14, 'e');
      /* buracos de areia com plataformas móveis */
      b.str(47, 12, 'm');
      b.coins(47, 52, 11);
      b.ground(58, 70, 15);
      /* plataformas que caem */
      b.str(73, 13, 'x'); b.str(75, 12, 'x'); b.str(77, 11, 'x'); b.str(79, 12, 'x'); b.str(81, 13, 'x');
      b.coins(73, 81, 9);
      b.ground(84, 110, 15);
      b.str(86, 14, 'K');
      /* pirâmide com porta para dentro */
      b.stairs(92, 15, 8, '%');
      b.stairs(100, 15, 8, '%', -1);
      b.str(98, 6, 'e');
      b.str(90, 14, 'Y');
      b.str(96, 4, 'o'); b.str(99, 4, 'o'); b.str(102, 4, 'o');
      b.str(109, 14, 's');
      /* interior da pirâmide (sala à parte, em baixo à direita) */
      b.room(186, 3, 219, 16);
      b.ground(187, 218, 15, '%');
      b.str(188, 14, 'Y');
      b.rect(192, 12, 195, 12, 'B'); b.str(193, 12, 'h');
      b.coins(197, 202, 14);
      b.rect(200, 10, 205, 10, '='); b.rect(207, 8, 211, 8, '=');
      b.str(209, 7, '*');
      b.str(214, 14, 's'); b.str(203, 14, 'e');
      b.coins(201, 204, 9); b.coins(213, 216, 11);
      b.str(216, 14, 'Z');
      /* saída da pirâmide → mais à frente no deserto */
      b.ground(112, 128, 15);
      b.str(113, 14, 'Z');
      b.str(118, 14, 'e'); b.str(122, 14, 'e');
      b.str(120, 11, 'B?B');
      /* plataforma vertical para uma saliência alta */
      b.str(131, 11, 'v');
      b.rect(136, 7, 142, 7, '%');
      b.str(140, 6, '*');
      b.coins(137, 139, 6);
      b.ground(136, 160, 15);
      b.str(146, 14, 's'); b.str(150, 14, 'e');
      top = b.up(152, 15, 3);
      b.ground(155, 158, top);
      top = b.down(159, top, 3);
      b.ground(162, 182, 15);
      b.str(164, 14, 'R');
      b.str(173, 12, '?');
      b.str(171, 9, '*');
      b.rect(170, 10, 172, 10, '=');
      b.str(178, 14, 'G');
    }),

    build({ id: 'L4', world: 1, name: 'Templo do Sol', par: 150 }, 210, b => {
      b.ground(0, 14, 15);
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      /* picos no chão do templo */
      b.ground(15, 30, 15);
      b.rect(19, 14, 21, 14, '^');
      b.rect(26, 14, 27, 14, '^');
      b.rect(18, 11, 22, 11, '=');
      b.coins(18, 22, 10);
      b.str(24, 14, 's');
      b.ground(31, 34, 15);
      /* sequência de plataformas que caem sobre um fosso */
      b.str(36, 13, 'x'); b.str(38, 13, 'x'); b.str(40, 12, 'x'); b.str(42, 11, 'x'); b.str(44, 12, 'x'); b.str(46, 13, 'x');
      b.coins(36, 46, 10);
      b.ground(49, 70, 15);
      b.str(52, 14, 'e'); b.str(58, 14, 's'); b.str(64, 14, 'e');
      b.rect(55, 10, 61, 10, 'B'); b.str(58, 10, 'H');
      b.str(57, 6, 'h');
      b.str(69, 14, 'K');
      /* coluna alta com plataforma vertical e pena dourada */
      b.ground(73, 75, 15);
      b.str(77, 10, 'v');
      b.rect(81, 5, 86, 5, '%');
      b.str(84, 4, '*');
      b.ground(81, 98, 15);
      b.rect(88, 12, 90, 14, '%');
      b.rect(93, 10, 95, 14, '%');
      b.str(91, 14, 'e');
      b.str(96, 14, 's');
      b.coins(93, 95, 9);
      b.str(94, 5, '*');
      /* corredor com abelhas e plataformas móveis */
      b.str(101, 12, 'm');
      b.str(103, 7, 'f');
      b.ground(110, 140, 15);
      b.str(112, 14, 'R');
      let top = b.up(118, 15, 3);
      b.ground(121, 123, top);
      top = b.down(124, top, 3);
      b.ground(127, 140, 15);
      b.str(131, 14, 'e'); b.str(135, 14, 'e');
      /* parede falsa: atalho com a 3.ª pena dourada */
      b.rect(141, 12, 146, 14, '%');
      b.rect(141, 13, 146, 14, 'F');
      b.str(144, 14, '*');
      b.coins(139, 140, 14);
      b.ground(141, 170, 15);
      b.coins(142, 145, 7);
      b.str(150, 14, 's'); b.str(155, 14, 's');
      b.rect(152, 10, 154, 10, '=');
      b.str(153, 9, 'o');
      b.str(160, 11, '?B?');
      b.stairs(163, 15, 5, '%');
      b.ground(168, 185, 15);
      b.str(178, 14, 'G');
    }),

    build({ id: 'L10', world: 1, name: 'Oásis Escondido', par: 140 }, 214, b => {
      b.ground(0, 16, 15);
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      b.str(13, 14, 's');
      /* duna grande: embalo para o loop */
      let top = b.upG(17, 15, 3);
      b.ground(23, 27, top);
      b.coins(23, 27, top - 3);
      top = b.down(28, top, 3);
      b.ground(31, 56, 15);
      b.str(32, 14, 'R');
      b.str(38, 14, 'O');
      b.str(38, 9, 'o'); b.str(35, 11, 'o'); b.str(41, 11, 'o');
      b.str(46, 14, 'e'); b.str(51, 14, 's');
      b.str(48, 11, 'B?B');
      b.str(54, 14, 'K');
      /* areias movediças: plataformas que caem, com uma pena lá em cima */
      b.str(58, 13, 'x'); b.str(60, 12, 'x'); b.str(62, 11, 'x'); b.str(64, 11, 'x'); b.str(66, 12, 'x'); b.str(68, 13, 'x');
      b.coins(58, 61, 9); b.coins(65, 68, 9);
      b.str(63, 7, '*');
      b.ground(71, 90, 15);
      /* palmeira: mola até às tâmaras (moedas) */
      b.str(74, 14, 'u');
      b.rect(73, 5, 77, 5, '=');
      b.coins(73, 74, 4); b.str(76, 4, '*');
      b.str(81, 14, 's'); b.str(86, 14, 'e');
      /* fosso com plataforma móvel */
      b.str(93, 12, 'm');
      b.coins(93, 99, 9);
      b.ground(105, 132, 15);
      b.str(109, 14, 'e'); b.str(114, 14, 's');
      /* porta para o oásis escondido (antes da pirâmide) */
      b.str(118, 14, 'X');
      b.stairs(120, 15, 6, '%');
      b.stairs(126, 15, 6, '%', -1);
      b.str(125, 8, 'e');
      b.arc(120, 131, 7, 2);
      b.ground(132, 172, 15);
      b.str(136, 14, 's'); b.str(141, 14, 'e');
      /* picos com tábuas por cima */
      b.rect(145, 14, 151, 14, '^');
      b.rect(144, 11, 152, 11, '=');
      b.coins(145, 151, 10);
      b.str(156, 14, 'R');
      top = b.up(160, 15, 3);
      b.ground(163, 166, top);
      b.str(165, top - 4, '?');
      top = b.down(167, top, 3);
      b.str(171, 14, 'e');
      b.ground(170, 186, 15);
      b.stairs(176, 15, 4, '%');
      b.coins(177, 179, 9);
      b.str(183, 14, 'G');
      /* o oásis (sala secreta) */
      b.room(190, 3, 213, 16);
      b.ground(191, 212, 15, '%');
      b.str(192, 14, 'X');
      b.coins(195, 208, 14);
      b.rect(196, 11, 199, 11, '='); b.rect(203, 8, 206, 8, '=');
      b.coins(196, 199, 10);
      b.str(205, 7, '*');
      b.str(201, 14, 's');
    }),

    /* ════════════ MUNDO 3 · PICOS GELADOS ════════════ */
    build({ id: 'L5', world: 2, name: 'Encosta Gelada', par: 130 }, 200, b => {
      b.ground(0, 16, 15);
      b.str(2, 14, 'S');
      b.str(9, 11, '?P?');
      b.str(14, 14, 'e');
      /* gelo: o Pip escorrega — trava cedo! */
      b.ground(19, 26, 15);
      b.ground(29, 40, 15);
      b.arc(26, 29, 12, 2);
      b.str(33, 14, 'e'); b.str(37, 14, 'e');
      let top = b.up(41, 15, 4);
      b.ground(45, 50, top);
      b.str(48, top - 1, 's');
      b.rect(46, top - 4, 49, top - 4, 'B'); b.str(47, top - 4, '!');
      top = b.down(51, top, 4);
      b.ground(55, 62, 15);
      b.ground(66, 70, 13);
      b.ground(73, 77, 11);
      b.coins(66, 70, 11); b.coins(73, 77, 9);
      b.str(75, 6, '*');
      b.rect(74, 7, 76, 7, '=');
      b.ground(80, 96, 15);
      b.str(82, 14, 'K');
      b.str(88, 8, 'f'); b.str(92, 14, 'e');
      /* ponte de gelo que cai */
      b.str(98, 13, 'x'); b.str(99, 13, 'x'); b.str(100, 13, 'x'); b.str(101, 13, 'x'); b.str(102, 13, 'x'); b.str(103, 13, 'x'); b.str(104, 13, 'x');
      b.coins(98, 104, 11);
      b.ground(107, 130, 15);
      b.str(110, 14, 'R');
      b.str(122, 14, 'O');
      b.str(122, 9, 'o'); b.str(119, 11, 'o'); b.str(125, 11, 'o');
      b.str(129, 14, 'e');
      /* bloco escondido por cima do fosso com pena dourada */
      b.ground(134, 150, 15);
      b.str(132, 11, 'h');
      b.rect(137, 8, 139, 8, '=');
      b.str(138, 4, '*');
      b.str(138, 7, 'u');
      b.str(142, 14, 's'); b.str(146, 14, 'e');
      b.str(144, 11, '?B?');
      top = b.upG(151, 15, 3);
      b.ground(157, 162, top);
      b.str(160, top - 1, 'e');
      top = b.downG(163, top, 3);
      b.ground(169, 199, 15);
      b.rect(172, 11, 174, 11, 'B'); b.str(173, 11, '?');
      b.str(177, 14, 's');
      b.stairs(180, 15, 4, '%');
      b.str(176, 6, '*');
      b.rect(175, 7, 177, 7, '=');
      b.str(190, 14, 'G');
    }),

    build({ id: 'L6', world: 2, name: 'Gruta de Cristal', par: 150 }, 206, b => {
      /* teto baixo de gelo ao longo do nível */
      b.rect(0, 0, 205, 2, '%');
      b.ground(0, 14, 15);
      b.str(2, 14, 'S');
      b.str(7, 11, '?P?');
      b.ground(17, 22, 15);
      b.rect(24, 13, 26, 13, '=');
      b.ground(29, 38, 15);
      b.str(33, 14, 'e'); b.str(36, 14, 's');
      /* plataforma vertical num poço */
      b.str(41, 13, 'v');
      b.rect(46, 7, 51, 7, '%');
      b.ground(46, 60, 15);
      b.str(49, 6, '*');
      b.coins(47, 48, 6);
      b.rect(52, 12, 54, 14, '%');
      b.str(57, 14, 'e');
      b.str(59, 14, 'K');
      /* picos e plataformas que caem */
      b.ground(61, 80, 15);
      b.rect(63, 14, 78, 14, '^');
      b.str(64, 12, 'x'); b.str(66, 11, 'x'); b.str(68, 11, 'x'); b.str(70, 10, 'x'); b.str(72, 11, 'x'); b.str(74, 11, 'x'); b.str(76, 12, 'x');
      b.coins(64, 76, 8);
      b.ground(81, 98, 15);
      b.str(86, 14, 's'); b.str(92, 14, 'e');
      b.str(88, 10, '?B?B?');
      b.str(83, 7, 'f');
      /* porta para uma câmara de cristal */
      b.str(96, 14, 'X');
      b.room(170, 3, 205, 16);
      b.ground(171, 204, 15, '%');
      b.str(172, 14, 'X');
      b.coins(175, 200, 14);
      b.rect(178, 11, 181, 11, '='); b.rect(185, 9, 188, 9, '='); b.rect(192, 7, 195, 7, '=');
      b.str(194, 6, '*');
      b.coins(185, 188, 8); b.coins(178, 181, 10);
      b.ground(101, 125, 15);
      b.str(103, 13, 'm');
      b.rect(101, 14, 112, 14, '.'); b.rect(101, 15, 112, 17, '.');
      b.ground(113, 125, 15);
      b.str(118, 14, 'e'); b.str(121, 14, 'e');
      let top = b.up(126, 15, 3);
      b.ground(129, 135, top);
      b.str(132, top - 1, 's');
      top = b.down(136, top, 3);
      b.ground(139, 168, 15);
      b.str(141, 14, 'R');
      b.str(150, 14, 'O');
      b.str(150, 9, 'o'); b.str(147, 11, 'o'); b.str(153, 11, 'o');
      b.str(158, 14, 'e');
      b.str(160, 11, 'h');
      b.str(160, 7, '*');
      b.str(164, 14, 'G');
    }),

    build({ id: 'L11', world: 2, name: 'Lago Congelado', par: 140 }, 210, b => {
      b.ground(0, 16, 15);
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      b.str(13, 14, 'e');
      /* lago: blocos de gelo baixos separados por água gelada */
      b.ground(19, 23, 15); b.ground(26, 29, 14); b.ground(32, 35, 13); b.ground(38, 41, 14);
      b.arc(23, 26, 12, 2); b.arc(29, 32, 11, 2); b.arc(35, 38, 11, 2); b.arc(41, 44, 12, 2);
      b.str(39, 13, 'e');
      b.ground(44, 62, 15);
      b.str(50, 14, 'K');
      b.str(55, 8, 'f'); b.str(58, 14, 's');
      /* gruta de gelo com teto */
      b.rect(63, 6, 85, 8, '%');
      b.ground(63, 104, 15);
      b.str(68, 14, 'e'); b.str(74, 14, 's'); b.str(80, 14, 'e');
      b.str(70, 11, '?B?');
      b.rect(77, 12, 79, 12, '=');
      b.coins(66, 72, 13);
      /* parede com passagem falsa: pena escondida */
      b.rect(86, 12, 91, 14, '%');
      b.rect(86, 13, 88, 14, 'F');
      b.str(87, 14, '*');
      b.coins(88, 91, 10);
      b.str(97, 14, 'e');
      /* plataformas verticais sobre o abismo */
      b.str(106, 12, 'v'); b.str(112, 10, 'v');
      b.coins(106, 108, 6); b.coins(112, 114, 4);
      b.str(113, 2, '*');
      b.ground(118, 140, 15);
      b.str(122, 14, 'R');
      b.str(128, 14, 'O');
      b.str(128, 9, 'o'); b.str(125, 11, 'o'); b.str(131, 11, 'o');
      b.str(137, 14, 'e');
      /* ponte de gelo que cai com abelhas */
      b.str(142, 13, 'x'); b.str(143, 13, 'x'); b.str(144, 13, 'x'); b.str(145, 13, 'x'); b.str(146, 13, 'x'); b.str(147, 13, 'x'); b.str(148, 13, 'x'); b.str(149, 13, 'x'); b.str(150, 13, 'x');
      b.coins(142, 150, 11);
      b.str(146, 8, 'f');
      b.ground(153, 192, 15);
      b.str(155, 14, 'X');
      b.str(158, 14, 's');
      let top = b.upG(162, 15, 3);
      b.ground(168, 172, top);
      b.str(170, top - 1, 's');
      b.str(169, top - 4, '?!?');
      top = b.downG(173, top, 3);
      b.str(181, 14, 'e');
      b.stairs(183, 15, 4, '%');
      b.coins(184, 186, 9);
      b.str(190, 14, 'G');
      /* caverna de gelo secreta */
      b.room(195, 4, 209, 16);
      b.ground(196, 208, 15, '%');
      b.str(197, 14, 'X');
      b.coins(199, 207, 14);
      b.rect(199, 11, 201, 11, '='); b.rect(204, 8, 206, 8, '=');
      b.str(205, 7, '*');
      b.coins(199, 201, 10);
    }),

    /* ════════════ MUNDO 4 · CASTELO DE LAVA ════════════ */
    build({ id: 'L7', world: 3, name: 'Muralhas de Fogo', par: 160 }, 210, b => {
      b.ground(0, 14, 15, '%');
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      /* lava com bolas a saltar */
      b.rect(15, 16, 19, 17, '~');
      b.str(17, 16, 'l');
      b.ground(20, 34, 15, '%');
      b.str(28, 12, 'T');
      b.str(31, 14, 's');
      b.rect(35, 16, 46, 17, '~');
      b.str(38, 16, 'l'); b.str(43, 16, 'l');
      b.str(37, 12, 'm');
      b.coins(37, 42, 10);
      b.ground(47, 66, 15, '%');
      b.str(50, 14, 'e'); b.str(54, 14, 'e');
      b.str(52, 11, 'B?B');
      b.str(58, 10, 'T');
      b.str(61, 14, 's');
      b.str(65, 14, 'K');
      /* castelo: corredor com teto e barras de fogo */
      b.rect(67, 4, 100, 6, '%');
      b.ground(67, 100, 15, '%');
      b.str(72, 11, 'T'); b.str(80, 9, 'T'); b.str(88, 11, 'T');
      b.str(76, 14, 'e'); b.str(84, 14, 's'); b.str(92, 14, 'e');
      b.coins(70, 98, 13);
      b.str(96, 8, '*');
      b.rect(95, 9, 97, 9, '=');
      b.rect(92, 12, 93, 12, '=');
      /* fosso de lava com plataformas que caem */
      b.rect(101, 16, 120, 17, '~');
      b.str(108, 16, 'l'); b.str(115, 16, 'l');
      b.str(102, 13, 'x'); b.str(105, 12, 'x'); b.str(108, 11, 'x'); b.str(111, 12, 'x'); b.str(114, 13, 'x'); b.str(117, 12, 'x');
      b.ground(121, 140, 15, '%');
      b.str(126, 14, 's'); b.str(132, 14, 'e');
      b.str(129, 10, 'h');
      /* segredo: parede falsa à esquerda de uma torre */
      b.rect(141, 11, 148, 14, '%');
      b.rect(141, 13, 143, 14, 'F');
      b.str(142, 14, '*');
      b.rect(138, 12, 139, 12, '=');
      b.ground(141, 175, 15, '%');
      b.str(152, 14, 'e'); b.str(156, 14, 's'); b.str(160, 14, 'e');
      b.str(157, 10, 'T');
      b.rect(163, 16, 168, 17, '~'); b.rect(163, 15, 168, 15, '.');
      b.str(165, 16, 'l');
      b.str(165, 11, 'm');
      b.ground(169, 190, 15, '%');
      b.str(175, 11, '?!?');
      b.str(180, 9, '*');
      b.rect(179, 10, 181, 10, '=');
      b.stairs(182, 15, 4, '%');
      b.str(188, 14, 'G');
    }),

    build({ id: 'L12', world: 3, name: 'Forja Ardente', par: 160 }, 192, b => {
      b.ground(0, 14, 15, '%');
      b.str(2, 14, 'S');
      b.str(8, 11, '?P?');
      b.rect(15, 16, 20, 17, '~');
      b.str(17, 16, 'l');
      b.ground(21, 36, 15, '%');
      b.str(26, 11, 'T');
      b.str(31, 14, 's'); b.str(34, 14, 'e');
      /* pilares sobre um lago de lava */
      b.rect(37, 16, 60, 17, '~');
      b.str(43, 16, 'l'); b.str(48, 16, 'l'); b.str(53, 16, 'l');
      b.rect(40, 12, 41, 15, '%'); b.rect(45, 10, 46, 15, '%'); b.rect(50, 12, 51, 15, '%'); b.rect(55, 11, 56, 15, '%');
      b.coins(40, 41, 11); b.coins(45, 46, 9); b.coins(50, 51, 11); b.coins(55, 56, 10);
      b.str(45, 5, '*');
      b.ground(61, 78, 15, '%');
      b.str(64, 14, 'K');
      b.str(68, 14, 'e'); b.str(72, 14, 's');
      b.str(70, 10, 'T');
      b.str(75, 11, 'B?B');
      /* forja: corredor com teto, barra de fogo e plataforma móvel sobre lava */
      b.rect(79, 4, 120, 6, '%');
      b.ground(79, 90, 15, '%');
      b.str(84, 11, 'T');
      b.rect(91, 16, 104, 17, '~');
      b.str(95, 16, 'l'); b.str(101, 16, 'l');
      b.str(93, 12, 'm');
      b.coins(93, 99, 10);
      b.ground(105, 120, 15, '%');
      b.str(108, 14, 's'); b.str(112, 14, 'e');
      b.str(116, 10, 'T');
      b.coins(106, 110, 13);
      /* fosso com plataformas que caem (pena lá em cima) */
      b.rect(121, 16, 138, 17, '~');
      b.str(126, 16, 'l'); b.str(133, 16, 'l');
      b.str(122, 13, 'x'); b.str(125, 12, 'x'); b.str(128, 11, 'x'); b.str(131, 11, 'x'); b.str(134, 12, 'x'); b.str(137, 13, 'x');
      b.str(129, 7, '*');
      b.ground(139, 190, 15, '%');
      b.str(142, 14, 'K');
      b.str(146, 14, 'e'); b.str(150, 14, 's'); b.str(154, 14, 'e');
      /* torre com uma passagem falsa do lado de lá */
      b.rect(155, 12, 156, 12, '=');
      b.rect(157, 11, 164, 14, '%');
      b.rect(162, 13, 164, 14, 'F');
      b.str(163, 14, '*');
      b.str(160, 10, 'e');
      b.str(169, 14, 's');
      b.str(172, 11, '?!?');
      b.stairs(176, 15, 4, '%');
      b.coins(177, 179, 9);
      b.str(184, 14, 'G');
    }),

    build({ id: 'L8', world: 3, name: 'Sala do Trono', par: 150 }, 150, b => {
      b.ground(0, 16, 15, '%');
      b.str(2, 14, 'S');
      b.str(7, 11, '?P?');
      b.rect(17, 16, 26, 17, '~');
      b.str(21, 16, 'l');
      b.str(19, 12, 'm');
      b.ground(27, 44, 15, '%');
      b.str(32, 11, 'T'); b.str(40, 11, 'T');
      b.str(36, 14, 's');
      b.rect(30, 9, 32, 9, '='); b.str(31, 8, '*');
      b.rect(28, 12, 29, 12, '=');
      b.rect(45, 16, 58, 17, '~');
      b.str(48, 16, 'l'); b.str(54, 16, 'l');
      b.str(46, 13, 'x'); b.str(49, 12, 'x'); b.str(52, 12, 'x'); b.str(55, 13, 'x');
      b.ground(59, 72, 15, '%');
      b.str(62, 14, 'e'); b.str(66, 14, 'e');
      b.str(64, 11, 'H');
      b.str(64, 7, '*');
      b.str(70, 14, 'K');
      /* sala do trono: arena fechada (o chefe guarda a meta) */
      b.rect(73, 2, 74, 9, '%');
      b.ground(73, 128, 15, '%');
      b.rect(73, 2, 128, 3, '%');
      b.rect(81, 10, 84, 10, '='); b.rect(117, 10, 120, 10, '=');
      b.str(99, 10, '*');
      b.rect(97, 11, 101, 11, '=');
      b.str(106, 14, 'W');
      b.coins(88, 112, 13);
      b.str(124, 14, 'G');
      b.rect(129, 2, 149, 17, '%');
    }),
  ];
})();
