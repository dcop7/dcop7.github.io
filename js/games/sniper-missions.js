/* ══════════════════════════════════════════════════════════════════
   Operação Soneca — missões 6 a 30 (out/2026)
   Cada missão nova é uma VARIANTE de um dos mundos (mesmo cenário,
   outra hora do dia, outro tempo, outra gente e outros objetivos) ou
   decorre num dos dois mundos novos (Praia da Bigodeira e Terra da Neve).
   As variantes herdam o mundo base (terreno, ninho, prédios) e trocam
   a gente com cast(P, B, G); more(B, G) acrescenta cenário; post(G)
   corre depois de tudo montado; script(G, dt) corre a cada passo.
   Mecânicas novas usadas aqui: escolta (role 'ally'), missão silenciosa
   (stealth: alarme = falha), sósias (civis iguais ao alvo), carro de
   fuga com pneus, comboio em andamento, teleférico, neve a cair.
══════════════════════════════════════════════════════════════════ */
const SniperMissions = (function () {
  'use strict';
  return function (A) {
    const { worlds: BW, outfit, hint, setPip, reveal, fail, sfx, emote, boatEscape, takeCar, isAwake, float3, rand, clamp, lerp, TAU } = A;
    const K = A.K, PP = A.PP;
    const LV = [];
    /* variante de um mundo: herda o mundo; a lógica da missão base (guião, alarme, tempo) não passa */
    const V = (world, o) => Object.assign({}, BW[world], { world, cast: null, more: null, post: null, onAlarm: null, script: null, onTimer: null, timer: 0, stealth: false, snow: 0, timeoutMsg: null, tags: null }, o);
    const without = (P, ...tags) => P.filter(p => !tags.includes(p.tag));
    const zz = (G, tag) => G.people.filter(p => p.tag === tag && p.sleep).length;
    const who = (G, tag) => G.people.find(p => p.tag === tag);
    const objN = (id, tag, k, text, o) => Object.assign({ id, text, check: G => zz(G, tag) >= k, prog: G => Math.min(k, zz(G, tag)) + '/' + k }, o);
    const obj1 = (tag, text, o) => Object.assign({ id: tag, text, check: G => G.people.some(p => p.tag === tag && p.sleep) }, o);
    const objC = (k, text) => ({ id: 'collect', text, opt: true, check: G => G.got >= k, prog: G => G.got + '/' + k });
    const objMark = (tag, text) => ({ id: 'find', text, check: G => G.people.some(p => p.tag === tag && (p.marked || p.sleep)) });
    /* caminhos (para barcos e carros feitos à mão) */
    const pLen = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
    const pAt = (P, s) => { for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (s <= l || i === P.length - 1) { const k = clamp(s / l, 0, 1); return [lerp(P[i - 1][0], P[i][0], k), lerp(P[i - 1][1], P[i][1], k), P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]]; } s -= l; } return [P[0][0], P[0][1], 1, 0]; };
    /* noite: luzes a sério (sem sombras) e brilho das lanternas dos guardas no chão */
    function nightLights(G, pts, c, I, R) { pts.forEach(p => { const l = new THREE.PointLight(c || '#ffcf90', I || 60, R || 34, 1.4); l.position.set(p[0], p[1], p[2]); G.r3.scene.add(l); }); G.r3.hemi.intensity *= 1.35; }
    function lamps(G) {
      G.people.forEach(p => {
        if (p.look.prop !== 'light') return;
        if (!p.lamp) { p.lamp = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18), new THREE.MeshBasicMaterial({ map: Arcade3D.glowTex(), color: '#fff2c0', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); p.lamp.rotation.x = -Math.PI / 2; G.r3.scene.add(p.lamp); p.lampS = new THREE.Sprite(Arcade3D.glowSprite('#fff6d0')); p.lampS.scale.setScalar(1.2); G.r3.scene.add(p.lampS); }
        const on = !p.sleep && !p.hidden; p.lamp.visible = p.lampS.visible = on; if (!on) return;
        const a = p.yaw + (p.headYaw || 0) * .5; p.lamp.position.set(p.x + Math.sin(a) * 4.5, p.y + .06, p.z + Math.cos(a) * 4.5); if (p.j) p.lampS.position.copy(p.j.haR);
      });
    }
    /* barco conduzido à mão ao longo de um caminho (anda para −z local) */
    function steerBoat(G, b, x, z, dx, dz, v, dt) {
      b.position.x = x; b.position.z = z; const want = Math.atan2(-dx, -dz); b.rotation.y += Math.atan2(Math.sin(want - b.rotation.y), Math.cos(want - b.rotation.y)) * Math.min(1, dt * 2.5);
      const a = b.rotation.y; G.dyn && G.dyn.push({ x, y: .3, z, hx: 1.35, hy: .85, hz: 4, c: Math.cos(a), s: Math.sin(a), k: 'boat' });
      if (v > 2 && Math.random() < dt * 30) G.r3.smoke.spawn({ x: x + Math.sin(a) * 4, y: .3, z: z + Math.cos(a) * 4, vx: rand(-1, 1), vy: rand(.5, 1.5), vz: rand(-1, 1), life: rand(1, 2), s0: .5, s1: 2.4, c0: '#f2f8ff', a: .55, drag: 1 });
    }
    const bossLook = R => outfit(R, 'guard', { shirt: '#5a2a6a', pants: '#3a1a4a', over: 'lapel', overC: '#ffffff', hat: 'fedora', hatC: '#2a1a2a', face: 'mustache', hairC: '#1a1a1a', glasses: null, build: 1.15, belly: 1.25, prop: 'case', propC: '#6a3a1a' });

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 2 — Regresso ao Cais
    ════════════════════════════════════════════════════════════════ */
    /* ── 6. Nevoeiro Cerrado: três senhores iguais, só um é o Contabilista ── */
    LV.push(V('cais', {
      id: 'cais-nevoeiro', chapter: 1, name: 'Nevoeiro Cerrado', icon: '🌫️', tod: 'overcast', grad: ['#9aa8b4', '#3a4652'], tags: 'sósias · nevoeiro',
      brief: 'O Contabilista da Liga veio ao cais conferir as contas do contrabando. Há três senhores de chapéu e mala — só o verdadeiro usa óculos escuros e gravata vermelha. Marca-o com os binóculos antes de disparar.',
      wind: [.5, 1.5], windDir: .6, darts: 16, fog: [70, 640], timer: 300, timeoutMsg: 'O Contabilista desapareceu no nevoeiro.',
      cast(P, B) {
        const R = B.R; P = without(P, 'boss');
        const suit = real => outfit(R, 'guard', { shirt: '#2a2a34', pants: '#24242c', over: 'tie', overC: real ? '#d82a2a' : '#2a64d8', hat: 'fedora', hatC: '#3a3a40', glasses: real ? 'sun' : null, face: 'mustache', hairC: '#2a2a2a', prop: 'case', propC: '#5a3a1a', long: true });
        const routes = [
          [{ go: [-90, -170] }, { do: 'phone', d: 9 }, { go: [-20, -182] }, { do: 'look', d: 6 }, { go: [28, -184] }, { do: 'talk', d: 8, yaw: 0 }, { go: [-36, -200] }, { go: [-36, -232] }, { do: 'look', d: 6 }, { go: [-36, -200] }],
          [{ go: [90, -175] }, { do: 'look', d: 7 }, { go: [140, -178] }, { do: 'phone', d: 8 }, { go: [112, -190] }, { go: [112, -255] }, { do: 'arms', d: 6 }, { go: [112, -190] }],
          [{ go: [-137.5, -190] }, { do: 'arms', d: 7 }, { go: [-137.5, -262] }, { do: 'phone', d: 8 }, { go: [-165, -262] }, { do: 'look', d: 6 }, { go: [-137.5, -262] }],
        ];
        const real = Math.floor(R() * 3);
        routes.forEach((st, i) => P.push(i === real
          ? { role: 'boss', tag: 'acct', name: 'Contabilista', look: suit(true), beh: { type: 'seq', speed: 1.1, steps: st }, vip: true, aware: true, range: 30 }
          : { role: 'civ', tag: 'twin', name: 'Inspetor do porto', look: suit(false), beh: { type: 'seq', speed: 1.1, steps: st } }));
        return P;
      },
      onAlarm(G) { G.timer = Math.min(G.timer, 45); hint(G, 'O Contabilista assustou-se — vai-se embora daqui a pouco!', 3, true); },
      objectives: [
        objMark('acct', 'Descobre o Contabilista (óculos escuros, gravata vermelha)'),
        obj1('acct', 'Adormece o Contabilista antes que se vá embora', { timer: true }),
        objN('guards', 'guard', 5, 'Adormece os 5 guardas', { opt: true }),
        objC(3, 'Encontra 3 patos de borracha'),
      ],
      bot: ['acct'],
    }));

    /* ── 7. Contrabando à Noite: a carrinha parte quando o tempo acabar ── */
    function vanGo(G) {
      const D = who(G, 'driver2'), car = G.cars.find(c => c.tag === 'escape'); if (!D || !car || !isAwake(D) || D.inCar) return;
      D.inCar = true; takeCar(G, D, car, 'O Motorista fugiu com o contrabando!', C => [[C.x, -78], [C.x + 30, -66], [C.x + 30, -30]]);
      setPip(G, D, 'O Motorista arrancou com a carrinha!', 4, 3); hint(G, 'A carrinha arrancou — fura-lhe 2 pneus!', 3, true);
      G.obj.find(o => o.id === 'tires').shown = true;
    }
    LV.push(V('cais', {
      id: 'cais-noite', chapter: 1, name: 'Contrabando à Noite', icon: '🌙', tod: 'night', grad: ['#2a3a6a', '#0a0e1e'], tags: 'noite · carro de fuga',
      brief: 'À noite, a Liga carrega caixotes de contrabando numa carrinha à porta do Armazém 7. Adormece o Motorista antes que arranque — se fugir, fura dois pneus à carrinha. Usa a visão noturna (N).',
      wind: [1, 2.5], windDir: 1.9, darts: 18, fog: [260, 2200], timer: 200,
      cast(P, B, G) {
        const R = B.R; P = P.filter(p => p.tag !== 'boss' && p.name !== 'Cliente' && p.name !== 'Transeunte');
        P.forEach(p => { if (p.tag === 'guard') p.look = outfit(R, 'henchman', { prop: 'light', propC: '#3a3a3a' }); });
        P.push({ role: 'boss', tag: 'driver2', name: 'Motorista', look: outfit(R, 'henchman', { hat: 'beanie', hatC: '#1a1a1a', gun: null, face: 'beard' }), beh: { type: 'stand', x: -75.5, z: -158, yaw: -Math.PI / 2, act: 'phone' }, vip: true, aware: true, range: 30 });
        for (let i = 0; i < 3; i++) P.push({ role: 'guard', tag: 'loader', name: 'Carregador', look: outfit(R, 'henchman', { gun: null, prop: 'case', propC: '#8a6a3a', hat: 'beanie', hatC: '#2a2a2a' }), beh: { type: 'seq', speed: 1.2, steps: [{ go: [-114 + i * 1.6, -123.5] }, { do: 'arms', d: 3 + i }, { go: [-77, -161.5 + i * 1.3] }, { do: 'look', d: 3 }] }, aware: true, range: 28 });
        G.carsDef = (G.carsDef || []).concat([{ path: [[-80, -161], [-80, -112], [-62, -92], [260, -92]], n: 1, parked: true, at: 0, tag: 'escape', type: 'van', color: '#2a2a2e', speed: 11 }]);
        return P;
      },
      post(G) { nightLights(G, [[-130, 8, -122], [-80, 8, -150], [-30, 8, -190], [20, 8, -230], [-60, 8, -260], [60, 8, -270], [110, 8, -170], [-160, 8, -200]]); },
      script(G) { lamps(G); },
      onTimer: vanGo, onAlarm: vanGo,
      objectives: [
        obj1('driver2', 'Adormece o Motorista da carrinha', { timer: true }),
        { id: 'tires', text: 'Fura 2 pneus à carrinha', after: '__never', opt: true, check: G => { const c = G.cars.find(c => c.tag === 'escape'); return c && c.flat >= 2; } },
        objN('loaders', 'loader', 3, 'Adormece os 3 carregadores', { opt: true }),
        objC(3, 'Encontra 3 patos de borracha'),
      ],
      bot: ['driver2'],
    }));

    /* ── 8. A Lancha do Chefe: chega pelo mar e vai fechar-se no armazém ── */
    LV.push(V('cais', {
      id: 'cais-lancha', chapter: 1, name: 'A Lancha do Chefe', icon: '🚤', tod: 'noon', grad: ['#5ab0e0', '#1a4a6a'], tags: 'alvo em movimento',
      brief: 'O Chefe Bigodes vem do mar na lancha roxa. Adormece-o ainda a bordo, ou no caminho do cais até ao Armazém 7 — se lá entrar, fecha-se a sete chaves.',
      wind: [1.5, 3], windDir: 1.2, darts: 16, fog: [500, 3200],
      cast(P, B, G) {
        const R = B.R; P = without(P, 'boss'); const b = G.escapeBoat;
        P.push({ role: 'boss', tag: 'boss', name: 'Chefe Bigodes', look: bossLook(R), beh: { type: 'ride', obj: b, seat: b.userData.seat, rot: Math.PI, act: 'drive' }, vip: true, aware: true, marked: true });
        [[-5, -301, 'arms'], [5, -301, 'radio']].forEach(([x, z, a]) => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman'), beh: { type: 'stand', x, z, yaw: Math.PI, act: a }, aware: true }));
        return P;
      },
      post(G) {
        const b = G.escapeBoat, c = G.cols.find(q => q.dyn === b); if (c) c.gone = true;
        G.lancha = { s: 0, v: 9, path: [[-320, -820], [-170, -540], [-40, -360], [0, -318], [4, -312]] }; G.lancha.L = pLen(G.lancha.path);
        b.position.set(-320, 0, -820); b.rotation.y = Math.atan2(150, 280);
        hint(G, '🚤 A lancha do Chefe vem lá ao fundo, do mar.', 4, true);
      },
      script(G, dt) {
        const Lc = G.lancha, b = G.escapeBoat, P = who(G, 'boss'); if (!Lc || !P || Lc.st === 'dock') return;
        const left = Lc.L - Lc.s; Lc.v = P.sleep ? Math.max(0, Lc.v - dt * 2.5) : clamp(left * .22, 1.4, 9); Lc.s = Math.min(Lc.L, Lc.s + Lc.v * dt);
        const [x, z, dx, dz] = pAt(Lc.path, Lc.s); steerBoat(G, b, x, z, dx, dz, Lc.v, dt);
        if (P.sleep && !Lc.zz) { Lc.zz = 1; G.boatSleep = true; }
        if (!P.sleep && left < .05) {
          Lc.st = 'dock'; P.fy = null; P.x = 2; P.z = -304; P.sitting = false;
          P.beh = { type: 'path', speed: 1.5, path: [[2, -304], [-20, -285], [-75, -280], [-75, -195], [-100, -160], [-100, -123], [-114, -123], [-115.3, -126.5]], end: (G, P) => { P.hidden = true; fail(G, 'O Chefe Bigodes fechou-se no Armazém 7!'); } }; P.wi = 1;
          setPip(G, P, 'O Chefe Bigodes desembarcou!', 4, 2); hint(G, 'Desembarcou — vai a pé para o Armazém 7!', 3, true);
        }
      },
      onAlarm(G) { const P = who(G, 'boss'); if (P && P.beh && P.beh.type === 'path') P.beh.speed = 3.4; },
      objectives: [
        obj1('boss', 'Adormece o Chefe Bigodes antes de entrar no Armazém 7'),
        { id: 'boat', text: 'Adormece-o ainda na lancha', opt: true, check: G => !!G.boatSleep },
        objN('guards', 'guard', 7, 'Adormece os 7 guardas', { opt: true }),
        objC(3, 'Encontra 3 patos de borracha'),
      ],
      bot: ['boss'],
    }));

    /* ── 9. Escolta no Cais: o agente Pardal tem de chegar ao navio sem ser visto ── */
    const PARDAL = [[96, -300]];
    LV.push(V('cais', {
      id: 'cais-escolta', chapter: 1, name: 'Escolta no Cais', icon: '🕵️', tod: 'afternoon', grad: ['#f0b878', '#3a4a6a'], tags: 'escolta · silenciosa', stealth: true,
      brief: 'O agente Pardal (marcador verde), disfarçado de estivador, tem de atravessar o cais até ao navio. Adormece os guardas que o possam ver antes de ele passar. Missão silenciosa: um alarme estraga tudo.',
      wind: [1, 2.5], windDir: -.8, darts: 18, fog: [400, 2600],
      cast(P, B) {
        const R = B.R; P = without(P, 'boss');
        P.forEach(p => { if (p.name === 'Vigia') p.allyR = 45; });
        P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman'), beh: { type: 'stand', x: -97, z: -161, yaw: Math.PI * .85, act: 'arms', turn: 1 }, aware: true });
        P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman'), beh: { type: 'stand', x: 80, z: -293, yaw: -Math.PI / 2, act: 'radio', turn: 1 }, aware: true });
        P.push({ role: 'ally', tag: 'ally', name: 'agente Pardal', allyTxt: 'agente Pardal', marked: true, look: outfit(R, 'worker', { hatC: '#f2c230', overC: '#ff7a1a', glasses: 'sun', face: null }),
          beh: { type: 'seq', speed: 1.55, steps: [{ do: 'look', d: 20 }, { go: [-115, -165] }, { go: [-90, -165] }, { go: [-80, -190] }, { do: 'look', d: 5 }, { go: [-36, -195] }, { go: [-36, -262] }, { do: 'look', d: 5 }, { go: [-20, -287] }, { go: [60, -298] }, { go: PARDAL[0] }, { do: 'wave', d: 1e9, yaw: Math.PI }] }, x: -170, z: -160 });
        P[P.length - 1].beh.x = -170; P[P.length - 1].beh.z = -160;
        return P;
      },
      post(G) { hint(G, 'O agente Pardal arranca daqui a 20 segundos — prepara o caminho!', 5, true); },
      script(G) { const a = who(G, 'ally'); if (a && !a.safe && Math.hypot(a.x - PARDAL[0][0], a.z - PARDAL[0][1]) < 2.5) { a.safe = a.arrived = true; } },
      objectives: [
        { id: 'ally', text: 'Leva o agente Pardal até ao navio sem ser descoberto', check: G => { const a = who(G, 'ally'); return !!(a && a.arrived); } },
        objN('guards', 'guard', 7, 'Adormece os 7 guardas', { opt: true }),
        objC(3, 'Encontra 3 patos de borracha'),
      ],
      bot: ['guard'],
    }));

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 3 — Arraial e Mercado
    ════════════════════════════════════════════════════════════════ */
    const aldeiaNight = G => nightLights(G, [[-20, 28, -236], [20, 28, -236], [-20, 28, -206], [20, 28, -206], [0, 28, -190], [60, 26, -222], [-60, 26, -216]], '#ffc88a', 70, 40);
    /* ── 10. Arraial à Noite: o Mestre dos Disfarces dança no meio do povo ── */
    LV.push(V('aldeia', {
      id: 'aldeia-noite', chapter: 2, name: 'Arraial à Noite', icon: '🏮', tod: 'night', grad: ['#3a2a6a', '#120a22'], tags: 'sósias · noite',
      brief: 'O Mestre dos Disfarces da Liga está a dançar no arraial. É o único com boina roxa E bigode — há quem tenha uma coisa ou outra. Descobre-o com os binóculos e adormece-o antes que fuja.',
      wind: [1.5, 3], windDir: -.6, darts: 15, fog: [300, 2600], timer: 260,
      cast(P, B, G) {
        const R = B.R, cz = -222; P = without(P, 'thief');
        const look = (beret, mus) => outfit(R, 'villager', { hat: 'beret', hatC: beret ? '#7a2a9a' : '#1a1a2a', face: mus ? 'mustache' : null, hair: mus ? 'short' : 'long', shirt: R() < .5 ? '#e8d0a0' : '#c8d8e8', long: true });
        P.push({ role: 'thief', tag: 'master', name: 'Mestre dos Disfarces', look: look(true, true), beh: { type: 'dance', x: 6, z: cz - 6, yaw: Math.PI, act: 'dance' }, vip: true, aware: true, range: 24 });
        [[-8, cz - 10, 1, 0], [10, cz - 12, 1, 0], [-4, cz - 4, 0, 1], [2, cz - 14, 0, 1]].forEach(([x, z, b, m]) => P.push({ role: 'civ', tag: 'twin', name: 'Festeiro', look: look(b, m), beh: { type: 'dance', x, z, yaw: Math.PI + rand(-.4, .4), act: 'dance' } }));
        G.collect = { kind: 'lantern', name: 'lanternas', list: [[-18, 26.4, -238], [18, 26.4, -238], [-22, 26.4, -206], [22, 26.4, -206], [0, 26.6, -222], [-30, 26, -222]] };
        return P;
      },
      post: aldeiaNight,
      objectives: [
        objMark('master', 'Descobre o Mestre dos Disfarces (boina roxa e bigode)'),
        obj1('master', 'Adormece o Mestre antes que fuja', { timer: true }),
        objN('look', 'lookout', 2, 'Adormece os 2 vigias de boné vermelho', { opt: true }),
        objC(6, 'Apaga 6 lanternas de papel'),
      ],
      bot: ['master'],
    }));

    /* ── 11. Manhã de Mercado: os Irmãos Riscas trabalham em dupla ── */
    LV.push(V('aldeia', {
      id: 'aldeia-mercado', chapter: 2, name: 'Manhã de Mercado', icon: '🧺', tod: 'morning', grad: ['#ffd8a0', '#6a8a4a'], tags: 'dois alvos',
      brief: 'Os Irmãos Riscas, carteiristas da Liga, andam pelo mercado da manhã. Se um vir o outro a dormir, dá o alarme e fogem os dois — adormece-os um logo a seguir ao outro.',
      wind: [1, 3], windDir: .4, darts: 15, fog: [380, 3200], timer: 300,
      cast(P, B) {
        const R = B.R, cz = -222;
        P = P.filter(p => p.tag !== 'thief' && p.tag !== 'band' && !(p.beh && p.beh.type === 'dance'));
        for (let i = 0; i < 14; i++) P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, R() < .5 ? 'villager' : 'tourist', { prop: R() < .35 ? 'case' : R() < .3 ? 'phone' : null, propC: '#c8a060' }), beh: { type: 'wander', area: [-26, cz - 14, 26, cz + 24], acts: ['talk', 'look', 'cup', 'listen', 'point', 'vendor'] } });
        const riscas = () => outfit(R, 'villager', { shirt: '#f4f1ea', over: 'stripes', overC: '#1a1a1a', hat: 'beanie', hatC: '#1a1a1a', face: 'mustache', hairC: '#1a1a1a', pants: '#2a2a3a', long: true });
        ['Riscas Mais Velho', 'Riscas Mais Novo'].forEach((nm, i) => P.push({ role: 'thief', tag: 'thief', name: nm, look: riscas(), beh: { type: 'wander', area: i ? [0, cz - 12, 24, cz + 22] : [-24, cz - 12, 0, cz + 22], acts: ['look', 'hips', 'point', 'phone'], speed: 1.15, pick: true }, aware: true, vip: true, range: 40 }));
        return P;
      },
      objectives: [
        objN('thief', 'thief', 2, 'Adormece os dois Irmãos Riscas', { timer: true }),
        objN('look', 'lookout', 2, 'Adormece os 2 vigias de boné vermelho', { opt: true }),
        objC(6, 'Rebenta 6 balões das bancas'),
      ],
      bot: ['thief'],
    }));

    /* ── 12. Vigias aos Pares: quem vê o colega a dormir dá o alarme ── */
    LV.push(V('aldeia', {
      id: 'aldeia-pares', chapter: 2, name: 'Vigias aos Pares', icon: '👥', tod: 'afternoon', grad: ['#f2b26a', '#6a3a2a'], tags: 'silenciosa · puzzle', stealth: true,
      brief: 'Sete vigias guardam o Tesoureiro da Liga, quase todos aos pares a conversar. Se um vir o par a dormir, chama pelo rádio: adormece os dois de seguida e escolhe bem a ordem. Depois apanha o Tesoureiro.',
      wind: [2, 3.5], windDir: -.6, darts: 16, fog: [380, 3200],
      cast(P, B) {
        const R = B.R, v = (x, z, yaw, act) => ({ role: 'guard', tag: 'vigia', name: 'Vigia', look: outfit(R, 'villager', { hat: 'cap', hatC: '#d82a2a', face: R() < .6 ? 'mustache' : null, shirt: '#2a2a3a', glasses: 'sun', gun: 'rifle', band: 'red', bandC: '#e0342c', long: true }), beh: { type: 'stand', x, z, yaw, act }, aware: true, range: 34 });
        P = P.filter(p => p.tag !== 'thief' && p.tag !== 'lookout');
        const face = (x, z, x2, z2) => Math.atan2(x2 - x, z2 - z);
        [[-14, -209, -12, -210.6], [24, -240, 26, -241.4], [2, -160, 3.6, -161.6]].forEach(([x, z, x2, z2]) => { P.push(v(x, z, face(x, z, x2, z2), 'talk')); P.push(v(x2, z2, face(x2, z2, x, z), 'listen')); });
        P.push(v(-32.5, -228, Math.PI / 2, 'arms'));
        P.push({ role: 'boss', tag: 'treasurer', name: 'Tesoureiro', hidden: true, vip: true, aware: true, range: 30, look: outfit(R, 'guard', { shirt: '#3a5a3a', over: 'lapel', overC: '#f4f4f0', hat: 'fedora', hatC: '#2a3a2a', face: 'mustache', glasses: null, prop: 'case', propC: '#d8a040', build: 1.1, belly: 1.3 }),
          beh: { type: 'path', speed: 1.15, path: [[35, -218], [20, -216], [0, -211], [-25, -212], [-35, -228]], end: (G, P) => { P.hidden = true; fail(G, 'O Tesoureiro escondeu-se na igreja com o dinheiro!'); } } });
        return P;
      },
      objectives: [
        objN('vigias', 'vigia', 7, 'Adormece os 7 vigias sem alarme'),
        obj1('treasurer', 'Adormece o Tesoureiro antes de chegar à igreja', { after: 'vigias', onShow: G => reveal(G, 'treasurer', 'O Tesoureiro saiu da tasca!') }),
        objC(6, 'Rebenta 6 balões das bancas'),
      ],
      bot: ['vigia', 'treasurer'],
    }));

    /* ── 13. Chapéus ao Ar: tirar os chapéus aos capangas, depois o Chapeleiro ── */
    const hats = G => G.people.filter(p => p.tag === 'hench' && p.hatOff).length;
    LV.push(V('aldeia', {
      id: 'aldeia-chapeus', chapter: 2, name: 'Chapéus ao Ar', icon: '👒', tod: 'noon', grad: ['#ffe08a', '#c86a2a'], tags: 'pontaria fina',
      brief: 'Oito capangas da Liga (braçadeira vermelha) vieram à festa de chapéu de palha: é o sinal para o Chapeleiro aparecer. Faz voar os 8 chapéus com dardos — de raspão, sem os adormecer — e depois adormece o Chapeleiro.',
      wind: [1, 2.5], windDir: -.3, darts: 24, fog: [380, 3400],
      cast(P, B) {
        const R = B.R, cz = -222; P = P.filter(p => p.tag !== 'thief' && p.tag !== 'lookout');
        for (let i = 0; i < 8; i++) P.push({ role: 'guard', tag: 'hench', name: 'Capanga', look: outfit(R, 'villager', { hat: 'straw', hatC: '#ecd48a', band: 'red', bandC: '#e0342c', face: R() < .7 ? 'mustache' : 'beard', long: false, shirt: B.pick(['#f4f1ea', '#e8b030', '#5ab0c8', '#e86a6a']) }), beh: { type: 'wander', area: [-26, cz - 12, 26, cz + 24], acts: ['look', 'arms', 'talk', 'hips', 'clap'], speed: 1 }, aware: true, range: 20 });
        P.push({ role: 'boss', tag: 'hatter', name: 'Chapeleiro', hidden: true, vip: true, aware: true, range: 30, look: outfit(R, 'guard', { shirt: '#6a2a8a', pants: '#2a1a3a', over: 'lapel', overC: '#f4f1ea', hat: 'top', hatC: '#1a1a1a', face: 'mustache', glasses: null, build: 1.05, belly: 1.2 }),
          beh: { type: 'seq', speed: 1.1, steps: [{ go: [-30, -228] }, { go: [-12, -232] }, { go: [0, -236.5] }, { do: 'sing', d: 1e9, yaw: 0 }] }, x: -35, z: -228 });
        P[P.length - 1].beh.x = -35; P[P.length - 1].beh.z = -228;
        return P;
      },
      objectives: [
        { id: 'hats', text: 'Faz voar os chapéus de palha aos 8 capangas', check: G => hats(G) >= 8, prog: G => hats(G) + '/8' },
        obj1('hatter', 'Adormece o Chapeleiro', { after: 'hats', onShow: G => reveal(G, 'hatter', 'O Chapeleiro saiu da igreja!') }),
        objC(6, 'Rebenta 6 balões das bancas'),
      ],
      bot: ['hats', 'hatter'],
    }));

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 4 — A Cidade (mundo dos telhados)
    ════════════════════════════════════════════════════════════════ */
    const RY = 20.25;   /* telhados do quarteirão-alvo (6 pisos) */
    const henchSuit = (R, o) => outfit(R, 'henchman', o);
    /* ── 14. Terraço ao Meio-Dia: o Hacker almoça num terraço, entre clientes parecidos ── */
    LV.push(V('telhados', {
      id: 'telhados-dia', chapter: 3, name: 'Terraço ao Meio-Dia', icon: '☀️', tod: 'noon', grad: ['#7ac8f0', '#3a5a8a'], tags: 'sósias',
      brief: 'O Hacker Bigodinho almoça num dos terraços do quarteirão com a pen da Liga. Usa boné verde e óculos escuros — há outros clientes de boné verde. Descobre-o e adormece-o antes que acabe o almoço.',
      wind: [2, 4], windDir: 2.2, darts: 16, fog: [500, 3600], timer: 240, timeoutMsg: 'O Hacker acabou o almoço e desceu com a pen.',
      cast(P, B) {
        const R = B.R; P = P.filter(p => p.tag !== 'courier' && p.tag !== 'buyer' && p.tag !== 'guard');
        /* esplanadas nos telhados 1 e 3 */
        const T1 = [[-30, -279], [-22, -279], [-14, -279], [-30, -287], [-22, -287]], T3 = [[14, -318], [22, -318], [30, -318], [22, -326]];
        [...T1, ...T3].forEach(([x, z], i) => { B.cafeTable(x, z, RY); B.umbrella(x, z, RY, ['#2a8a4a', '#e8503a', '#f2c230', '#2a64b8'][i % 4]); });
        const seats = []; [...T1, ...T3].forEach(([x, z]) => { seats.push([x - .78, z, Math.PI / 2]); seats.push([x + .78, z, -Math.PI / 2]); });
        const hk = Math.floor(R() * 5) * 2 + 1, cap = (real) => outfit(R, 'tourist', { hat: 'cap', hatC: '#2a9a4a', glasses: real ? 'sun' : null, shirt: real ? '#3a3a3a' : B.pick(['#f4f4f0', '#3a3a3a', '#c83a3a']), over: null, face: real ? 'mustache' : null, prop: 'phone' });
        let twins = 0;
        seats.forEach(([x, z, yaw], i) => {
          const act = ['cup', 'talk', 'phone', 'listen'][i % 4];
          if (i === hk) P.push({ role: 'boss', tag: 'hacker', name: 'Hacker Bigodinho', look: cap(true), beh: { type: 'sit', x, z, y: RY, yaw, act: 'phone' }, vip: true, aware: true, range: 30 });
          else if (twins < 3 && i % 3 === 0) { twins++; P.push({ role: 'civ', tag: 'twin', name: 'Cliente', look: cap(false), beh: { type: 'sit', x, z, y: RY, yaw, act } }); }
          else P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, B.pick(['tourist', 'villager'])), beh: { type: 'sit', x, z, y: RY, yaw, act } });
        });
        P.push({ role: 'civ', tag: 'civ', name: 'Empregado', look: outfit(R, 'chef', { hat: null }), beh: { type: 'seq', y: RY, speed: 1.1, steps: [{ go: [-26, -283] }, { do: 'vendor', d: 6 }, { go: [-10, -283] }, { do: 'look', d: 4 }] } });
        [[33, -282, -Math.PI / 2], [-30, -320, Math.PI / 2], [12, -288, -.4]].forEach(([x, z, yaw]) => P.push({ role: 'guard', tag: 'guard', name: 'Vigia', look: henchSuit(R), beh: { type: 'stand', x, z, y: RY, yaw, act: 'bino', turn: 1 }, aware: true, range: 50 }));
        return P;
      },
      onAlarm(G) { G.timer = Math.min(G.timer, 30); hint(G, 'Alarme! O Hacker vai sair dentro de momentos!', 3, true); },
      objectives: [
        objMark('hacker', 'Descobre o Hacker (boné verde e óculos escuros)'),
        obj1('hacker', 'Adormece o Hacker antes que acabe o almoço', { timer: true }),
        objN('guards', 'guard', 3, 'Adormece os 3 vigias sem alarme', { opt: true, check: G => !G.alarm && zz(G, 'guard') >= 3 }),
        objC(3, 'Encontra 3 gnomos nos telhados'),
      ],
      bot: ['hacker'],
    }));

    /* ── 15. Corrida nos Telhados: o estafeta corre em círculos pelas pranchas ── */
    const RUN = [[-30, -276], [-3, -282], [3, -282], [30, -278], [22, -292], [22, -311], [30, -328], [3, -322], [-3, -322], [-30, -328], [-22, -311], [-22, -292]];
    LV.push(V('telhados', {
      id: 'telhados-corrida', chapter: 3, name: 'Corrida nos Telhados', icon: '🏃', tod: 'sunset', grad: ['#ff8a4a', '#3a2a5a'], tags: 'alvo a correr',
      brief: 'Bigodes Júnior anda às voltas a correr pelos quatro telhados, à espera da hora de entregar a mala. Adianta a mira à frente dele (o dardo demora a chegar) e adormece-o antes que desça.',
      wind: [2.5, 4.5], windDir: 2.2, darts: 18, fog: [420, 3400], timer: 150, timeoutMsg: 'Bigodes Júnior desceu pelas escadas e desapareceu.',
      cast(P, B) {
        const R = B.R; P = P.filter(p => p.tag !== 'courier');
        P.push({ role: 'boss', tag: 'courier', name: 'Bigodes Júnior', look: outfit(R, 'guard', { shirt: '#c83a3a', over: 'lapel', overC: '#ffffff', hat: 'fedora', hatC: '#1a1a1a', face: 'mustache', glasses: null, prop: 'case', propC: '#3a2a1a' }), beh: { type: 'patrol', speed: 3.1, y: RY, path: RUN.map(p => [p[0], p[1], .01]) }, vip: true, aware: true, range: 30 });
        [[30, -332, Math.PI], [-31, -270, 0]].forEach(([x, z, yaw]) => P.push({ role: 'guard', tag: 'guard', name: 'Vigia', look: henchSuit(R), beh: { type: 'stand', x, z, y: RY, yaw, act: 'bino', turn: 1 }, aware: true, range: 50 }));
        return P;
      },
      onAlarm(G) { G.timer = Math.min(G.timer, 25); hint(G, 'Alarme! Bigodes Júnior vai fugir pelas escadas!', 3, true); },
      objectives: [
        obj1('courier', 'Adormece Bigodes Júnior a correr', { timer: true }),
        objN('guards', 'guard', 4, 'Adormece os 4 vigias', { opt: true }),
        { id: 'buyer', text: 'Adormece o Comprador', opt: true, check: G => zz(G, 'buyer') >= 1 },
        objC(3, 'Encontra 3 gnomos nos telhados'),
      ],
      bot: ['courier'],
    }));

    /* ── 16. Carrinha Blindada: dá voltas ao bairro; fura os pneus e apanha-o a pé ── */
    LV.push(V('telhados', {
      id: 'telhados-carrinha', chapter: 3, name: 'Carrinha Blindada', icon: '🚐', tod: 'afternoon', grad: ['#f2c27a', '#2a3a5a'], tags: 'pneus · trânsito',
      brief: 'Bigodes Júnior conduz uma carrinha preta blindada às voltas pelo bairro — os dardos não passam o vidro. Fura dois pneus quando ela passar na avenida em frente, e adormece-o quando sair a correr.',
      wind: [1.5, 3], windDir: 2.2, darts: 20, fog: [500, 3600], timer: 260, timeoutMsg: 'A carrinha perdeu-se no trânsito da cidade.',
      cast(P, B, G) {
        const R = B.R; P = P.filter(p => p.tag !== 'courier' && p.tag !== 'buyer');
        G.carsDef = [{ path: [[-370, -183], [370, -183]], loop: 'ping', n: 4, speed: 11 }, { path: [[138, -520], [138, -20]], loop: 'ping', n: 3, speed: 9 }, { path: [[-370, -36], [370, -36]], loop: 'ping', n: 2, speed: 8, lane: 3.6 },
          { path: [[-330, -40], [330, -40], [330, -110], [-330, -110], [-330, -40]], loop: 'loop', n: 1, speed: 10, tag: 'escape', type: 'van', color: '#16181c',
            driver: { role: 'boss', tag: 'courier', name: 'Bigodes Júnior', vip: true, aware: true, range: 30, marked: true, look: outfit(R, 'guard', { shirt: '#c83a3a', over: 'lapel', overC: '#ffffff', hat: null, face: 'mustache', glasses: 'sun' }) } }];
        return P;
      },
      post(G) {
        const car = G.cars.find(c => c.tag === 'escape'); car.go = true; car.carrier = car.drv; car.s = 30;
        car.runPath = C => { const sx = C.x < 0 ? -1 : 1; return [[C.x, C.z + 8.5], [C.x + sx * 45, C.z + 8.5], [C.x + sx * 45, C.z + 30]]; };
        setPip(G, car.drv, 'A carrinha preta de Bigodes Júnior', 4, 2);
      },
      objectives: [
        obj1('courier', 'Adormece Bigodes Júnior', { timer: true }),
        { id: 'tires', text: 'Fura 2 pneus à carrinha preta', check: G => { const c = G.cars.find(c => c.tag === 'escape'); return c && c.flat >= 2; } },
        objC(3, 'Encontra 3 gnomos nos telhados'),
      ],
      bot: ['tires', 'courier'],
    }));

    /* ── 17. Cidade à Noite: seis vigias de lanterna nos telhados, sem alarmes ── */
    LV.push(V('telhados', {
      id: 'telhados-noite', chapter: 3, name: 'Cidade à Noite', icon: '🌃', tod: 'night', grad: ['#2a2a6a', '#0a0a1a'], tags: 'noite · silenciosa', stealth: true,
      brief: 'À noite, seis vigias de lanterna guardam os telhados onde Bigodes Júnior vai entregar a Receita Secreta. Adormece-os sem que ninguém dê pelo colega a dormir; depois aparecem o estafeta e o comprador.',
      wind: [1.5, 3.5], windDir: 2.2, darts: 18, fog: [380, 3000],
      cast(P, B) {
        const R = B.R; P = P.filter(p => p.tag !== 'courier' && p.tag !== 'buyer' && p.tag !== 'guard');
        P = P.filter((p, i) => p.name !== 'Transeunte' || i % 2);
        const vg = (x, z, yaw, path) => ({ role: 'guard', tag: 'guard', name: 'Vigia', look: henchSuit(R, { prop: 'light', propC: '#3a3a3a' }), beh: path ? { type: 'patrol', y: RY, speed: 1, path } : { type: 'stand', x, z, y: RY, yaw, act: 'light', turn: 1 }, aware: true, range: 34 });
        P.push(vg(-35, -276, .6), vg(36, -276, -.6), vg(36, -330, -2.5), vg(-35, -331, 2.5));
        P.push(vg(0, 0, 0, [[-30, -283, 4, 'light'], [-30, -289, 4, 'look']]), vg(0, 0, 0, [[12, -320, 4, 'light'], [12, -316, 4, 'look']]));
        P.push({ role: 'boss', tag: 'courier', name: 'Bigodes Júnior', hidden: true, vip: true, aware: true, range: 30, look: outfit(R, 'guard', { shirt: '#c83a3a', over: 'lapel', overC: '#ffffff', hat: 'fedora', hatC: '#1a1a1a', face: 'mustache', glasses: null, prop: 'case', propC: '#3a2a1a' }),
          beh: { type: 'seq', y: RY, speed: 1.2, steps: [{ go: [-6, -291] }, { go: [-22, -296] }, { go: [-22, -312] }, { go: [-6, -316] }, { do: 'talk', d: 12, yaw: Math.PI / 2 }] }, x: -4, z: -291 });
        P[P.length - 1].beh.x = -4; P[P.length - 1].beh.z = -291;
        P.push({ role: 'guard', tag: 'buyer', name: 'Comprador', hidden: true, aware: true, range: 30, look: outfit(R, 'guard', { shirt: '#2a4a3a', hat: 'fedora', hatC: '#3a3a2a' }), beh: { type: 'seq', y: RY, speed: 1.1, steps: [{ go: [-2, -316] }, { do: 'arms', d: 1e9, yaw: -Math.PI / 2 }] }, x: -4, z: -312 });
        P[P.length - 1].beh.x = -4; P[P.length - 1].beh.z = -312;
        return P;
      },
      post(G) { nightLights(G, [[0, 26, -300], [-40, 8, -252], [40, 8, -252], [0, 8, -196], [-120, 8, -252], [120, 8, -252]], '#ffd8a0', 50, 46); },
      script(G) { lamps(G); },
      objectives: [
        objN('guards', 'guard', 6, 'Adormece os 6 vigias sem alarme'),
        { id: 'deal', text: 'Adormece Bigodes Júnior e o Comprador', after: 'guards', onShow: G => { reveal(G, 'courier', 'Bigodes Júnior e o Comprador chegaram ao telhado!'); reveal(G, 'buyer'); }, check: G => zz(G, 'courier') + zz(G, 'buyer') >= 2, prog: G => (zz(G, 'courier') + zz(G, 'buyer')) + '/2' },
        objC(3, 'Encontra 3 gnomos nos telhados'),
      ],
      bot: ['guard', 'courier', 'buyer'],
    }));

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 5 — Montanha e Carris
    ════════════════════════════════════════════════════════════════ */
    const baronLook = (R, sun) => outfit(R, 'tourist', { shirt: '#f2a020', over: null, shorts: true, hat: 'top', hatC: '#1a1a1a', face: 'mustache', hairC: '#2a1a1a', glasses: sun ? 'sun' : null, build: 1.12, belly: 1.35, skin: '#f0c8a8', shoes: '#f2f2f2' });
    const heli = (G, dt) => BW.vila.script(G, dt);
    /* ── 18. Festa na Piscina: o Barão e o irmão gémeo ── */
    LV.push(V('vila', {
      id: 'vila-festa', chapter: 4, name: 'Festa na Piscina', icon: '🍹', tod: 'sunset', grad: ['#ff9a6a', '#2a3a5a'], tags: 'sósia · longe',
      brief: 'O Barão Bigodes dá uma festa ao pôr do sol — e o irmão gémeo, que não tem nada a ver com a Liga, também lá está. O Barão verdadeiro usa óculos escuros. Marca-o com os binóculos: a mais de 500 m, vê bem antes de disparar.',
      wind: [3, 5.5], windDir: 1.57, darts: 14, fog: [700, 5200],
      cast(P, B) {
        const R = B.R;
        P.forEach(p => { if (p.tag === 'baron') p.look = baronLook(R, true); });
        P.push({ role: 'civ', tag: 'twin', name: 'Irmão gémeo', look: baronLook(R, false), beh: { type: 'seq', speed: 1.1, steps: [{ recline: 1, x: 9, z: -510, yaw: Math.PI, d: 40 }, { go: [12, -514] }, { do: 'cup', d: 16, yaw: Math.PI / 2 }, { go: [4, -527] }, { do: 'talk', d: 10 }, { go: [9, -511] }] } });
        for (let i = 0; i < 10; i++) P.push({ role: 'civ', tag: 'civ', name: 'Convidado', look: outfit(R, 'tourist', { glasses: R() < .5 ? 'sun' : null, hat: null }), beh: { type: 'dance', x: -11 + (i % 5) * 5.5, z: -526 - Math.floor(i / 5) * 4, yaw: rand(-1, 1), act: R() < .7 ? 'dance' : 'cup' } });
        P.push({ role: 'civ', tag: 'civ', name: 'DJ', look: outfit(R, 'tourist', { hat: 'cap', hatC: '#1a1a1a', glasses: 'sun' }), beh: { type: 'stand', x: -15, z: -532, yaw: Math.PI * .8, act: 'drum' } });
        return P;
      },
      objectives: [
        objMark('baron', 'Descobre o Barão verdadeiro (óculos escuros)'),
        obj1('baron', 'Adormece o Barão Bigodes'),
        objN('guards', 'guard', 6, 'Adormece os 6 guardas sem alarme', { opt: true, check: G => !G.alarm && zz(G, 'guard') >= 6 }),
        objC(3, 'Acerta em 3 gnomos dourados'),
      ],
      script: heli,
      bot: ['baron'],
    }));

    /* ── 19. Helicóptero a Postos: o Barão vai a caminho do helicóptero ── */
    const HELI = [44, -521];
    LV.push(V('vila', {
      id: 'vila-heli', chapter: 4, name: 'Helicóptero a Postos', icon: '🚁', tod: 'noon', grad: ['#8ad0f8', '#3a6a3a'], tags: 'contra o relógio',
      brief: 'O Barão Bigodes vai partir: o helicóptero já tem o motor ligado e ele sai da vivenda com dois guarda-costas. Tens o caminho até ao heliporto para o adormecer. Mede a distância e conta com o vento!',
      wind: [2, 4], windDir: 1.57, darts: 14, fog: [700, 5200],
      cast(P, B) {
        const R = B.R; P = without(P, 'baron');
        const steps = dx => [{ do: 'phone', d: 7, yaw: 0 }, { go: [12 + dx, -531] }, { do: 'talk', d: 9 }, { go: [26 + dx, -526] }, { go: [HELI[0] - 3 + dx, HELI[1] + 1] }, { do: 'look', d: 1e9 }];
        P.push({ role: 'boss', tag: 'baron', name: 'Barão Bigodes', look: baronLook(R, true), vip: true, aware: true, range: 30, beh: { type: 'seq', speed: 1, steps: steps(0).map((s, i) => i === 4 ? { go: HELI } : s), x: 6.4, z: -533.4 } });
        [-1.6, 1.6].forEach((dz, i) => P.push({ role: 'guard', tag: 'escort', name: 'Guarda-costas', look: henchSuit(R, { build: 1.2 }), aware: true, range: 36, beh: { type: 'seq', speed: 1, steps: steps(i ? 1.5 : -1.5).map(s => s.go ? { go: [s.go[0], s.go[1] + dz] } : s), x: 6.4 + (i ? 1.5 : -1.5), z: -533.4 + dz } }));
        return P;
      },
      post(G) { G.heliIdle = true; hint(G, '🚁 O helicóptero já está a aquecer o motor!', 4, true); },
      script(G, dt) {
        const h = G.heli; if (G.heliGo == null && G.heliIdle) h.rotor.rotation.y += dt * 9;
        const B = who(G, 'baron'); if (B && isAwake(B) && !B.inHeli && Math.hypot(B.x - HELI[0], B.z - HELI[1]) < 1.5) { B.inHeli = true; G.escapeEnd(G, B); }
        heli(G, dt);
      },
      objectives: [
        obj1('baron', 'Adormece o Barão antes de entrar no helicóptero'),
        objN('escort', 'escort', 2, 'Adormece os 2 guarda-costas', { opt: true }),
        objC(3, 'Acerta em 3 gnomos dourados'),
      ],
      bot: ['baron'],
    }));

    /* ── 20. Neblina na Montanha: nove guardas no nevoeiro, depois o Barão ── */
    LV.push(V('vila', {
      id: 'vila-nevoeiro', chapter: 4, name: 'Neblina na Montanha', icon: '🌁', tod: 'overcast', grad: ['#a8b4bc', '#3a4a3a'], tags: 'longe · nevoeiro',
      brief: 'A neblina subiu ao vale e a vivenda mal se vê. Adormece os 9 guardas do Barão — no nevoeiro só se vê bem com a mira — e ele sai de casa para ver o que se passa.',
      wind: [3, 6], windDir: 1.57, darts: 18, fog: [240, 1500],
      cast(P, B) {
        const R = B.R; P = without(P, 'baron');
        [[-46, -532, 0, 'arms'], [-31, -488, Math.PI, 'radio'], [38, -511, -.5, 'look']].forEach(([x, z, yaw, act]) => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: henchSuit(R), beh: { type: 'stand', x, z, yaw, act, turn: 1 }, aware: true, range: 36 }));
        P.push({ role: 'boss', tag: 'baron', name: 'Barão Bigodes', hidden: true, look: baronLook(R, true), vip: true, aware: true, range: 30, beh: { type: 'seq', speed: 1.1, steps: [{ go: [4, -528] }, { do: 'look', d: 8 }, { go: [-4, -524] }, { do: 'hips', d: 8 }, { go: [6.4, -533.4] }] }, x: 6.4, z: -533.4 });
        P[P.length - 1].beh.x = 6.4; P[P.length - 1].beh.z = -533.4;
        return P;
      },
      objectives: [
        objN('guards', 'guard', 9, 'Adormece os 9 guardas'),
        obj1('baron', 'Adormece o Barão Bigodes', { after: 'guards', onShow: G => reveal(G, 'baron', 'O Barão saiu de casa!') }),
        objC(3, 'Acerta em 3 gnomos dourados'),
      ],
      script: heli,
      bot: ['guard', 'baron'],
    }));

    /* ── estação: comboio feito à mão (chega, pára, parte; ou passa sem parar) ── */
    function trainMove(G, T, dt) { T.g.position.x = T.x; if (T.light) T.light.position.x = T.x - 40; }
    const conLook = R => outfit(R, 'guard', { shirt: '#3a2a5a', over: 'lapel', overC: '#d8c070', hat: 'top', hatC: '#2a1a3a', face: 'mustache', glasses: null, build: 1.08, belly: 1.2, prop: 'case', propC: '#2a1a12' });
    /* ── 21. Comboio da Manhã: o Conde chega de comboio e vai para o carro ── */
    LV.push(V('estacao', {
      id: 'estacao-manha', chapter: 4, name: 'Comboio da Manhã', icon: '🌅', tod: 'morning', grad: ['#ffd0a0', '#4a6a8a'], tags: 'janela · carro de fuga',
      brief: 'O Conde Bigodes chega no comboio da manhã, sentado à janela da segunda carruagem. Adormece-o pela janela quando o comboio abrandar, ou no cais a caminho do carro que o espera. Se arrancar, fura-lhe os pneus!',
      wind: [1, 2.5], windDir: -2.4, darts: 16, fog: [400, 3200],
      cast(P, B, G) {
        const R = B.R; P = P.filter(p => p.tag !== 'madame' && p.tag !== 'body');
        P.forEach(p => { if (p.tag === 'guard') p.look = henchSuit(R); });
        P.push({ role: 'boss', tag: 'conde', name: 'Conde Bigodes', look: conLook(R), vip: true, aware: true, range: 30, marked: true, beh: { type: 'stand', x: 0, z: -197, yaw: 0, act: 'listen' } });
        G.carsDef = (G.carsDef || []).concat([{ path: [[-20, -156], [-52, -158], [-80, -170], [-450, -170]], n: 1, parked: true, at: 0, tag: 'escape', type: 'sedan', color: '#1a1a22', speed: 12 }]);
        return P;
      },
      post(G) {
        const T = G.train, C = who(G, 'conde'); T.x = 760; T.st = 'wait'; T.t = 0;
        C.beh = { type: 'ride', obj: T.g, seat: T.seats[11].slice(), yaw: Math.PI / 2, act: 'phone' }; C.seatI = 11; C.boarded = true;
      },
      script(G, dt) {
        const T = G.train, C = who(G, 'conde'); T.t += dt;
        if (T.st === 'wait' && T.t > 6) { T.st = 'arrive'; hint(G, '🚂 O comboio está a chegar — o Conde vem à janela da 2.ª carruagem.', 3.5, true); setPip(G, C, 'O Conde Bigodes vem no comboio', 4, 2); }
        if (T.st === 'arrive') { T.v = clamp((T.x - 70) * .3, 1.2, 18); T.x -= T.v * dt; if (T.x <= 70.05) { T.x = 70; T.st = 'stop'; T.t = 0; } }
        if (T.st === 'stop' && T.t > 50) { T.st = 'leave'; T.v = 0; }
        if (T.st === 'leave') { T.v = Math.min(24, T.v + dt * 1.5); T.x -= T.v * dt; }
        trainMove(G, T, dt);
        if (C && C.boarded) { const s = T.seats[C.seatI]; C.beh.seat = [s[0] + .05, 1.92, s[2]]; if (C.sleep && T.st !== 'stop') G.trainSleep = true; }
        if (C && C.boarded && !C.sleep && T.st === 'stop' && T.t > 3) {
          const dx = T.x - 2 * 21 + 9; C.boarded = false; C.sitting = false; C.fy = 3;
          C.beh = { type: 'path', speed: 1.3, path: [[C.x, C.z], [dx, -193.2], [dx, -191.3], [-20, -191.3], [-20, -186.6], [-20, -179], [-20, -158]], end: (G, P) => { const car = G.cars.find(c => c.tag === 'escape'); takeCar(G, P, car, 'O Conde Bigodes fugiu de carro!', Cp => [[Cp.x - 10, Cp.z], [Cp.x - 60, Cp.z]]); setPip(G, P, 'O Conde meteu-se no carro preto!', 4, 3); hint(G, 'Fura 2 pneus ao carro preto!', 3, true); } }; C.wi = 1;
          setPip(G, C, 'O Conde saiu do comboio!', 4, 2);
        }
        /* no cais anda à altura do cais; fora dele, no chão */
        if (C && !C.boarded && C.beh.type === 'path') C.fy = Math.abs(C.z + 190.5) < 3 && Math.abs(C.x) < 110 ? 3 : null;
      },
      objectives: [
        obj1('conde', 'Adormece o Conde Bigodes antes que fuja de carro'),
        { id: 'window', text: 'Adormece-o pela janela do comboio', opt: true, check: G => !!G.trainSleep },
        objN('guards', 'guard', 6, 'Adormece os 6 guardas', { opt: true }),
        objC(3, 'Apaga 3 lanternas de papel'),
      ],
      bot: ['conde'],
    }));

    /* ── 22. Expresso das Seis: três espiões sentados num comboio que não pára ── */
    LV.push(V('estacao', {
      id: 'estacao-expresso', chapter: 4, name: 'Expresso das Seis', icon: '🚄', tod: 'sunset', grad: ['#ff9a5a', '#2a2a4a'], tags: 'alvos em movimento',
      brief: 'O expresso passa pela estação sem parar, ida e volta, três vezes. Lá dentro vão três espiões da Liga de braçadeira vermelha, à janela, entre passageiros normais. Adormece os três antes da última passagem.',
      wind: [1, 2.5], windDir: -2.4, darts: 18, fog: [400, 3200],
      cast(P, B) {
        const R = B.R; P = P.filter(p => p.tag !== 'madame' && p.tag !== 'body' && p.tag !== 'guard');
        const spies = [3, 12, 19], pass = [0, 5, 7, 9, 14, 16, 21, 23];
        spies.forEach(si => P.push({ role: 'guard', tag: 'pass', name: 'Espião da Liga', look: outfit(R, 'guard', { shirt: '#3a4a66', band: 'red', bandC: '#e0342c', long: false, hat: 'fedora', hatC: '#2a2a2a', face: 'mustache' }), seatI: si, beh: { type: 'stand', x: 0, z: -197 }, aware: true, range: 20 }));
        pass.forEach(si => P.push({ role: 'civ', tag: 'civ', name: 'Passageiro', look: outfit(R, B.pick(['tourist', 'villager'])), seatI: si, beh: { type: 'stand', x: 0, z: -197 } }));
        return P;
      },
      post(G) {
        const T = G.train; T.x = 420; T.dir = -1; T.pass = 0; T.st = 'run'; T.v = 8.5;
        G.people.forEach(p => { if (p.seatI != null) p.beh = { type: 'ride', obj: T.g, seat: T.seats[p.seatI].slice(), yaw: Math.PI / 2, act: p.role === 'civ' ? 'listen' : 'phone' }; });
        hint(G, '🚄 O expresso vem aí — três passagens, três espiões!', 4, true);
      },
      script(G, dt) {
        const T = G.train; if (T.st === 'done') return;
        if (T.st === 'pause') { T.t += dt; if (T.t > 5) { T.st = 'run'; T.dir = -T.dir; } }
        else { T.x += T.dir * T.v * dt; if ((T.dir < 0 && T.x < -330) || (T.dir > 0 && T.x > 420)) { T.pass++; T.st = T.pass >= 3 ? 'done' : 'pause'; T.t = 0; if (T.st === 'pause') hint(G, `🚄 Passagem ${T.pass + 1} de 3 — o expresso vai voltar!`, 3, true); else if (zz(G, 'pass') < 3) fail(G, 'O expresso levou os espiões da Liga.'); } }
        trainMove(G, T, dt);
        G.people.forEach(p => { if (p.seatI != null && p.beh.type === 'ride') { const s = T.seats[p.seatI]; p.beh.seat = [s[0] + .05, 1.92, s[2]]; } });
      },
      objectives: [
        objN('pass', 'pass', 3, 'Adormece os 3 espiões do expresso (braçadeira vermelha)'),
        objC(3, 'Apaga 3 lanternas de papel'),
      ],
      bot: ['pass'],
    }));

    /* ── 23. Nevoeiro na Estação: noite e nevoeiro, oito guardas, depois a Madame ── */
    LV.push(V('estacao', {
      id: 'estacao-nevoeiro', chapter: 4, name: 'Nevoeiro na Estação', icon: '🌫️', tod: 'night', grad: ['#3a4a6a', '#0a1018'], tags: 'noite · silenciosa', stealth: true,
      brief: 'Noite de nevoeiro na estação. Oito guardas de lanterna protegem a Madame Bigodes, escondida na cafetaria. Adormece-os sem alarmes (visão noturna com N) e apanha a Madame quando ela sair para o cais.',
      wind: [.5, 2], windDir: -2.4, darts: 18, fog: [90, 900],
      cast(P, B) {
        const R = B.R; P = P.filter(p => p.tag !== 'madame' && p.tag !== 'body');
        P.push(...[[30, -213.5], [-30, -213.5]].map(([x, z]) => ({ role: 'guard', tag: 'guard', name: 'Guarda', look: henchSuit(R, { prop: 'light', propC: '#3a3a3a' }), beh: { type: 'stand', x, z, y: 3, yaw: Math.PI, act: 'light', turn: 1 }, aware: true, range: 26 })));
        P.push({ role: 'boss', tag: 'madame', name: 'Madame Bigodes', hidden: true, vip: true, aware: true, range: 25, look: outfit(R, 'tourist', { hair: 'bun', hairC: '#c8c8c0', shirt: '#7a2a8a', long: true, face: 'mustache', hat: 'beret', hatC: '#c83a5a', glasses: 'sun', prop: 'case', propC: '#d8a040', build: 1.05 }),
          beh: { type: 'path', speed: 1.2, y: 3, path: [[58, -213.5], [40, -213.5], [0, -213.5], [-60, -213.5], [-95, -213.5]], end: (G, P) => { P.hidden = true; fail(G, 'A Madame desapareceu no nevoeiro.'); } } });
        return P;
      },
      script(G) { lamps(G); },
      objectives: [
        objN('guards', 'guard', 8, 'Adormece os 8 guardas sem alarme'),
        obj1('madame', 'Adormece a Madame Bigodes', { after: 'guards', onShow: G => reveal(G, 'madame', 'A Madame saiu da cafetaria!') }),
        objC(3, 'Apaga 3 lanternas de papel'),
      ],
      bot: ['guard', 'madame'],
    }));

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 6 — Praia da Bigodeira (mundo novo)
       Hotel à beira-mar (ninho no telhado), paredão com quiosques e
       palmeiras, areal com chapéus de sol, nadadores-salvadores, rede
       de voleibol, pontão de madeira com barcos e o mar.
    ════════════════════════════════════════════════════════════════ */
    const shoreZ = x => -205 - x * x * .00012;
    const PIER_X = 180, PIER_Y = 3.6;
    const onPier = (x, z) => (Math.abs(x - PIER_X) < 2.6 && z < -73 && z > -318) || (Math.abs(x - PIER_X) < 7.2 && z <= -318 && z > -330.5);
    const TOWERS = [[-150, -150], [30, -158], [250, -160]];
    const PRAIA = {
      id: 'praia', bseed: 211, pseed: 311, chapter: 5, name: 'Praia da Bigodeira', icon: '🏖️', tod: 'noon', grad: ['#5ad0f0', '#e8b878'],
      water: '#2a86a8', shallow: '#5ad0c8',
      wind: [2, 4], windDir: 1.2, darts: 16,
      nest: { x: 0, y: 36, z: 13.3, yaw: 0, yawR: 1.2, pMin: -.6, pMax: .2, look: [0, 1, -150] },
      fog: [600, 4200],
      terrain: { seed: 71, hills: 7, base: 0, size: 4200, n: 260, sandH: 4.45, pal: { grass: '#7a9a4a', grass2: '#94a85a', sand: '#ecdcae', dirt: '#b89a6a' },
        fn: (x, z, h) => {
          const sz = shoreZ(x), cliff = Math.max(0, Math.abs(x) - 380) * .35;
          if (z > -28) return 4.2 + Math.max(0, z + 28) * .13 + h * .5 + cliff;
          if (z > -74) return 4.2 + cliff * .5;
          if (z > sz) return lerp(3.7, -.35, (-74 - z) / (-74 - sz)) + h * .03 + cliff;
          return Math.max(-24, -.35 - (sz - z) * .075) + h * .1 + cliff * .8;
        },
        flats: [{ x: 0, z: -52, w: 1000, d: 44, h: 4.2, f: 3 }, { x: 0, z: 22, w: 36, d: 24, h: 10, f: 22 }] },
      walkY: (x, z) => onPier(x, z) ? PIER_Y : null,
      build(B, G) {
        const P = [], R = B.R, hy = (x, z) => B.frame(x, z).y;
        /* hotel do ninho (frente para o mar) e casario na encosta */
        B.house({ x: 0, z: 22, yaw: Math.PI, w: 30, d: 18, floors: 8, y: 10, roof: 'flat', wall: '#f4f1ea', allBalc: true, noLaundry: true, shop: { c: '#2a8aa8', t: 'HOTEL BIGODEIRA' } });
        const WL = B.WALLS;
        for (let x = -420; x <= 420; x += 26) { if (Math.abs(x) < 34) continue; const z = 8 + (Math.abs(x) % 3) * 9; B.house({ x, z, yaw: Math.PI, w: 14 + (Math.abs(x) % 4) * 2, d: 12, floors: 3 + (Math.abs(x / 26) % 4), y: hy(x, z) - .2, roof: R() < .6 ? 'flat' : 'gable', wall: WL[Math.abs(Math.round(x / 26)) % WL.length], shop: R() < .4 ? { c: B.pick(['#c83a3a', '#2a64b8', '#2a8a4a', '#e8a020', '#e85a8a']), t: B.pick(['CAFÉ', 'SURF', 'GELADOS', 'MARISCOS', 'FARMÁCIA', null]) } : null }); }
        /* estrada, passeio e paredão */
        B.ground('asphalt', 0, -38, 1000, 12, 0, 4.2, '#ffffff', 6); B.roadMarks(-480, -38, 480, -38, 4.2);
        B.ground('concrete', 0, -29.5, 1000, 5, 0, 4.22, '#d8d2c6', 2);
        B.ground('cobble', 0, -60.5, 1000, 25, 0, 4.2, '#f0e6d2', 3);
        for (let i = 0; i < 40; i++) B.ground('plain', -480 + i * 25, -60.5, .35, 25, 0, 4.23, '#d8c8a8');
        B.box(B.frame(0, -73.6, 0, 2.9), 'stone', 1000, 1.45, .6, 0, 0, 0, '#d8d0c0', { uv: 2, col: 'low' });
        for (let i = 0; i < 34; i++) { const x = -495 + i * 30; B.lamp(x, -71.5, Math.PI, 4.2); if (i % 2) B.bench(x + 15, -70.6, Math.PI, 4.2); }
        [[40, 'GELADOS', '#e85a8a'], [-70, 'BEBIDAS', '#2a8ae8'], [150, 'SURF', '#f2a020'], [-160, 'JORNAIS', '#2a6a4a'], [260, 'GELADOS', '#c83a3a']].forEach(([x, t, c]) => B.kiosk(x, -51.5, Math.PI, 4.2, t, c));
        for (let i = 0; i < 4; i++) { B.cafeTable(-82 + i * 4, -56, 4.2); B.umbrella(-82 + i * 4, -56, 4.2, ['#2a8ae8', '#f4f4f4', '#2a8ae8', '#f4f4f4'][i]); }
        /* bar da praia */
        B.house({ x: -110, z: -86, yaw: Math.PI, w: 12, d: 8, floors: 1, y: hy(-110, -86) + .1, roof: 'flat', wall: '#f4f1ea', shop: { c: '#2a8a8a', t: 'BAR DA PRAIA' }, noLaundry: true });
        /* chapéus de sol e espreguiçadeiras em filas */
        const ROWS = [-102, -118, -134, -150], chairs = [];
        ROWS.forEach((z0, r) => { for (let x = -250 + (r % 2) * 7; x <= 250; x += 14) {
          if (Math.abs(x - PIER_X) < 12 || (Math.abs(x - 90) < 13 && z0 > -136 && z0 < -100) || TOWERS.some(t => Math.abs(x - t[0]) < 8 && Math.abs(z0 - t[1]) < 9) || Math.abs(x + 110) < 9 && z0 > -110 || R() < .18) continue;
          const xx = x + (R() - .5) * 3, zz = z0 + (R() - .5) * 2, y = hy(xx, zz), c = B.pick(['#e83a3a', '#2a8ae8', '#f2c230', '#3ac07a', '#f4f4f4', '#e86aa0', '#ff8a3a']);
          B.umbrella(xx, zz, y, c);
          [-.8, .8].forEach(dx => { const cx = xx + dx, cz = zz + 1.4; B.deckchair(cx, cz, Math.PI, hy(cx, cz) + .02, R() < .5 ? '#f4f4f4' : c); chairs.push([cx, cz]); });
        } });
        /* toalhas */
        const towels = []; for (let i = 0; i < 46; i++) { const x = rand(-240, 240), z = rand(-185, -96); if (Math.abs(x - PIER_X) < 9 || Math.abs(x - 90) < 13 && z > -136) continue; const yaw = rand(-.4, .4) + (R() < .5 ? 0 : Math.PI); B.ground('plain', x, z, .95, 1.9, yaw, hy(x, z), B.pick(['#e83a5a', '#2a8ae8', '#f2c230', '#3ac07a', '#f4f4f4', '#8a5ab0', '#ff8a3a']), 1); towels.push([x, z, yaw]); }
        /* torres dos nadadores-salvadores */
        TOWERS.forEach(([x, z]) => {
          const F = B.frame(x, z, 0, hy(x, z));
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B.box(F, 'wood', .14, 2.7, .14, a * 1.05, 0, b * 1.05, '#f2f2f2'));
          B.box(F, 'wood', 2.5, .16, 2.5, 0, 2.6, 0, '#ffffff', { uv: 1 }); B.box(F, 'plain', 2.1, 1.7, 1.2, 0, 2.76, -.55, '#f4f4f4', { col: 'solid' }); B.box(F, 'paint', 2.12, .3, 1.22, 0, 3.6, -.55, '#e8302a');
          B.box(F, 'paint', 2.6, .12, 2.6, 0, 4.5, 0, '#e8302a'); for (const s of [-1, 1]) B.box(F, 'metal', .06, 1.8, .06, s * 1.2, 2.76, 1.2, '#d8d8d8');
          for (let k = 0; k < 6; k++) B.box(F, 'wood', .7, .06, .14, 0, .3 + k * .42, 1.6 - k * .08, '#e8e0d0');
          B.flag(x + 1.4, z + .4, hy(x, z) + 4.6, 3, ['#e8302a', '#f2c230']);
        });
        G.towerTops = TOWERS.map(([x, z]) => [x, hy(x, z) + 2.76, z + .65]);
        /* rede de voleibol */
        { const F = B.frame(90, -120, 0, hy(90, -120)); for (const s of [-1, 1]) B.box(F, 'metal', .1, 2.6, .1, s * 4.6, 0, 0, '#3a3a3a'); B.box(F, 'cloth', 9.2, .9, .03, 0, 1.6, 0, '#f4f4f4'); B.box(F, 'paint', 9.3, .06, .05, 0, 2.5, 0, '#2a64b8'); }
        /* pontão de madeira com plataforma, postes e candeeiros */
        { const F = B.frame(PIER_X, -196, 0, PIER_Y - .3); B.box(F, 'wood', 5, .3, 245, 0, 0, 0, '#ffffff', { uv: 1, col: 'solid' }); for (const s of [-1, 1]) { B.box(F, 'wood', .1, 1, 245, s * 2.45, .3, 0, '#e8dcc0'); }
          for (let k = 0; k < 21; k++) for (const s of [-1, 1]) B.geo(F, 'wood', new THREE.CylinderGeometry(.16, .18, 12, 8), s * 2.2, -6, -120 + k * 12, '#7a6048');
          const E = B.frame(PIER_X, -324.5, 0, PIER_Y - .3); B.box(E, 'wood', 14.4, .3, 12.6, 0, 0, 0, '#ffffff', { uv: 1, col: 'solid' }); for (const [a, b, w, d] of [[0, -6.25, 14.4, .1], [-7.15, 0, .1, 12.6], [7.15, 0, .1, 12.6]]) B.box(E, 'wood', w, 1, d, a, .3, b, '#e8dcc0');
          for (let k = 0; k < 9; k++) B.lamp(PIER_X + (k % 2 ? 2.2 : -2.2), -90 - k * 26, k % 2 ? -Math.PI / 2 : Math.PI / 2, PIER_Y); }
        /* barcos, boias, rochedos */
        G.boats = [[-140, -300, .4, '#c83a3a'], [40, -340, -.3, '#2a64b8'], [-280, -290, .9, '#3a8a4a'], [320, -300, -.6, '#e8a020'], [168, -322, Math.PI / 2, '#2a8a8a']].map(([x, z, r, c]) => B.boat(x, z, r, { c, flag: '#f4f1ea' }));
        G.escapeBoat = B.boat(PIER_X + 9, -330, Math.PI / 2, { c: '#7a3ab0', speed: true });
        for (let i = 0; i < 26; i++) { const x = -260 + i * 20; B.geo(B.frame(x, 0, 0, 0), 'paint', new THREE.SphereGeometry(.35, 10, 8), 0, .1, shoreZ(x) - 34, i % 2 ? '#ff7a1a' : '#f4f4f4'); }
        for (let i = 0; i < 26; i++) { const s = R() < .5 ? -1 : 1, x = s * (350 + R() * 120), z = rand(-260, -70); B.rock(x, z, 2 + R() * 5); }
        /* palmeiras no paredão e pinheiros na encosta */
        const T = []; for (let x = -486; x <= 486; x += 18) if (Math.abs(x) > 16) T.push({ x, z: -47, y: 4.2, k: 'palm', s: .55 + R() * .2 });
        for (let i = 0; i < 260; i++) { const x = rand(-1400, 1400), z = rand(50, 900); if (Math.abs(x) < 40 && z < 60) continue; T.push({ x, z, k: R() < .6 ? 'pine' : 'leaf', s: .7 + R() * .6 }); }
        G.treeList = T;
        /* gente: banhistas nas espreguiçadeiras e toalhas, na água, à beira-mar, no paredão */
        chairs.forEach(([x, z], i) => { if (R() < .5) P.push({ role: 'civ', tag: 'civ', name: 'Banhista', look: outfit(R, 'beach'), beh: { type: 'recline', x, z, yaw: Math.PI } }); });
        towels.forEach(([x, z, yaw], i) => { if (i % 2 === 0) P.push({ role: 'civ', tag: 'civ', name: 'Banhista', look: outfit(R, 'beach'), beh: { type: 'recline', x, z: z + Math.cos(yaw) * .1, yaw, y: hy(x, z) - .36 } }); });
        for (let i = 0; i < 14; i++) { const x = rand(-220, 220); if (Math.abs(x - PIER_X) < 6) continue; const z = shoreZ(x) - rand(8, 26); P.push({ role: 'civ', tag: 'civ', name: 'Nadador', look: outfit(R, 'beach', { hat: null, glasses: null }), beh: { type: 'stand', x, z, y: -1.05, yaw: rand(-1, 1) + (R() < .5 ? 0 : Math.PI), act: B.pick(['swim', 'wave', 'arms', 'talk']) } }); }
        for (let i = 0; i < 12; i++) { const x0 = rand(-230, 120), z = shoreZ(x0) + rand(1, 4); P.push({ role: 'civ', tag: 'civ', name: 'Banhista', look: outfit(R, 'beach'), beh: { type: 'path', path: R() < .5 ? [[x0, z], [x0 + 90, z - 1]] : [[x0 + 90, z - 1], [x0, z]], loop: 'ping', speed: rand(.9, 1.3) } }); }
        for (let i = 0; i < 6; i++) { const x = rand(-200, 140), z = shoreZ(x) + rand(3, 10); P.push({ role: 'civ', tag: 'civ', name: 'Criança', s: .62 + R() * .1, look: outfit(R, 'kid', { shorts: true, long: false, shoes: '#f0c8a8' }), beh: { type: 'kneel', x, z, yaw: rand(0, TAU), act: 'dig' } }); B.geo(B.frame(x + .5, z + .4, 0), 'plain', new THREE.ConeGeometry(.3, .55, 7), 0, .27, 0, '#e2cc98'); }
        [[86, -116], [94, -116], [86, -124], [94, -124]].forEach(([x, z], i) => P.push({ role: 'civ', tag: 'civ', name: 'Jogador', look: outfit(R, 'beach', { hat: null }), beh: { type: 'stand', x, z, yaw: z > -120 ? Math.PI : 0, act: B.pick(['cheer', 'clap', 'arms', 'wave']) } }));
        for (let i = 0; i < 16; i++) { const z = -54 - (i % 4) * 4.5, d = R() < .5; P.push({ role: 'civ', tag: 'civ', name: 'Transeunte', look: outfit(R, B.pick(['tourist', 'tourist', 'beach']), { prop: R() < .25 ? 'ice' : R() < .2 ? 'phone' : null }), beh: { type: 'path', path: d ? [[-460, z], [460, z]] : [[460, z], [-460, z]], loop: 'ping', speed: rand(1, 1.5), act: 'phone' }, s: R() < .15 ? .65 : undefined }); }
        for (let i = 0; i < 3; i++) P.push({ role: 'civ', tag: 'civ', name: 'Corredor', look: outfit(R, 'tourist', { shorts: true, hat: 'cap', hatC: '#f4f4f4' }), beh: { type: 'path', path: [[-450, -66 + i], [450, -66 + i]], loop: 'ping', speed: 3 + i * .3 } });
        for (let i = 0; i < 8; i++) P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, 'tourist'), beh: { type: 'sit', x: -82 + (i % 4) * 4 + (i < 4 ? -.78 : .78), z: -56, y: 4.2, yaw: i < 4 ? Math.PI / 2 : -Math.PI / 2, act: ['cup', 'ice', 'talk', 'phone'][i % 4] } });
        [40, -70, 150, -160, 260].forEach(x => P.push({ role: 'civ', tag: 'vendor', name: 'Vendedor', look: outfit(R, 'vendor'), beh: { type: 'stand', x, z: -53.6, y: 4.2, yaw: Math.PI, act: 'vendor' } }));
        for (let i = 0; i < 5; i++) P.push({ role: 'civ', tag: 'civ', name: 'Pescador', look: outfit(R, 'fisher'), beh: { type: 'stand', x: PIER_X + (i % 2 ? 2 : -2), z: -110 - i * 38, yaw: i % 2 ? Math.PI / 2 : -Math.PI / 2, act: 'arms' } });
        G.carsDef = [{ path: [[-480, -38], [480, -38]], loop: 'ping', n: 4, speed: 9 }];
        G.birds = { n: 22, kind: 'gull', centers: [[0, 24, -220], [-160, 18, -260], [170, 26, -300]], perch: [[PIER_X - 2.4, PIER_Y + 1, -150], [PIER_X + 2.4, PIER_Y + 1, -210], [-150, hy(-150, -150) + 4.6, -150]] };
        G.collect = { kind: 'ball', name: 'bolas de praia', list: [[-62, hy(-62, -128) + .42, -128], [24, hy(24, -170) + .42, -170], [118, hy(118, -110) + .42, -110], [-200, hy(-200, -165) + .42, -165], [205, hy(205, -140) + .42, -140]] };
        G.escapePath = P => [[P.x, P.z], [PIER_X - 1, -76], [PIER_X - 1, -318], [PIER_X + 6, -326]];
        G.escapeEnd = (G, P) => boatEscape(G, P);
        return P;
      },
    };
    const W2 = (base, o) => Object.assign({}, base, { cast: null, more: null, post: null, onAlarm: null, script: null, onTimer: null, timer: 0, stealth: false, snow: 0, timeoutMsg: null, tags: null }, o);
    const ADMIRAL = (R) => outfit(R, 'beach', { shirt: '#f4f4f4', over: 'stripes', overC: '#1a2a5a', pants: '#1a2a5a', hat: 'guard', hatC: '#f4f4f4', face: 'mustache', hairC: '#d8d8d0', glasses: null, build: 1.12, belly: 1.3 });
    const LIFEGUARD = (R) => outfit(R, 'beach', { shirt: '#e8302a', pants: '#f2c230', hat: 'cap', hatC: '#e8302a', glasses: 'sun', band: 'red', bandC: '#1a1a1a', face: 'mustache', build: 1.1 });
    /* ── 24. Praia da Bigodeira: quatro nadadores-salvadores falsos e o Almirante ── */
    LV.push(W2(PRAIA, {
      tags: 'mundo novo · multidão',
      brief: 'Na praia, quatro capangas disfarçados de nadadores-salvadores (t-shirt vermelha, calções amarelos e bigode) vigiam o Almirante Bigodes, que apanha sol de boné branco. Cuidado com os banhistas!',
      cast(P, B, G) {
        const R = B.R;
        G.towerTops.forEach(([x, y, z], i) => P.push({ role: 'guard', tag: 'lifeguard', name: 'Nadador-salvador falso', look: LIFEGUARD(R), beh: { type: 'stand', x, z, y, yaw: Math.PI, act: 'bino', turn: 1 }, aware: true, range: 44 }));
        P.push({ role: 'guard', tag: 'lifeguard', name: 'Nadador-salvador falso', look: LIFEGUARD(R), beh: { type: 'patrol', path: [[-60, shoreZ(-60) + 3, 4, 'look'], [60, shoreZ(60) + 3, 4, 'radio']], speed: 1.1 }, aware: true, range: 36 });
        P.push({ role: 'boss', tag: 'admiral', name: 'Almirante Bigodes', look: ADMIRAL(R), beh: { type: 'recline', x: 11.2, z: -116.6, yaw: Math.PI }, vip: true, aware: true, range: 30 });
        B.umbrella(10.4, -118, B.frame(10.4, -118).y, '#1a2a5a'); B.deckchair(11.2, -116.6, Math.PI, B.frame(11.2, -116.6).y + .02, '#f4f4f4');
        return P;
      },
      objectives: [
        objN('lifeguard', 'lifeguard', 4, 'Adormece os 4 nadadores-salvadores falsos'),
        obj1('admiral', 'Adormece o Almirante Bigodes (boné branco)'),
        objC(5, 'Acerta em 5 bolas de praia'),
      ],
      bot: ['lifeguard', 'admiral'],
    }));

    /* ── 25. Gelados Roubados: o gatuno foge para o pontão quando o tempo acabar ── */
    LV.push(W2(PRAIA, {
      id: 'praia-gelados', name: 'Gelados Roubados', icon: '🍦', tod: 'afternoon', grad: ['#ffc8a0', '#3a8ab0'], tags: 'sósias · fuga de barco', timer: 200,
      brief: 'O Gatuno dos Gelados roubou a caixa dos quiosques e passeia-se pela praia. Usa camisola às riscas azuis e boné branco — há quem tenha riscas, há quem tenha boné. Encontra-o antes que corra para a lancha do pontão.',
      cast(P, B) {
        const R = B.R, riscas = (blue, cap) => outfit(R, 'tourist', { shirt: '#f4f4f4', over: 'stripes', overC: blue ? '#2a4ab8' : '#c83a3a', hat: cap ? 'cap' : null, hatC: '#f4f4f4', shorts: true, face: 'mustache', prop: 'case', propC: '#f4f4f4' });
        const area = [-150, -175, 150, -100];
        P.push({ role: 'thief', tag: 'thief', name: 'Gatuno dos Gelados', look: riscas(true, true), beh: { type: 'wander', area, acts: ['look', 'hips', 'ice', 'phone'], speed: 1.1 }, vip: true, aware: true, range: 28 });
        [[1, 0], [0, 1], [1, 0], [0, 1]].forEach(([b, c]) => P.push({ role: 'civ', tag: 'twin', name: 'Banhista', look: riscas(b, c), beh: { type: 'wander', area, acts: ['look', 'ice', 'talk'], speed: 1.1 } }));
        [[-40, -96, 0], [70, -96, 0]].forEach(([x, z, yaw]) => P.push({ role: 'guard', tag: 'lookout', name: 'Vigia', look: LIFEGUARD(R), beh: { type: 'stand', x, z, yaw, act: 'bino', turn: 1 }, aware: true, range: 36 }));
        return P;
      },
      onTimer(G) { const T = who(G, 'thief'); if (T && isAwake(T)) { T.fleeing = true; T.beh = { type: 'path', path: G.escapePath(T), speed: 3.2, end: G.escapeEnd }; T.wi = 1; T.marked = true; hint(G, 'O gatuno está a correr para o pontão!', 3, true); setPip(G, T, 'O gatuno vai fugir de lancha!', 4, 3); } },
      objectives: [
        objMark('thief', 'Descobre o Gatuno (riscas azuis e boné branco)'),
        obj1('thief', 'Adormece o Gatuno dos Gelados', { timer: true }),
        objN('look', 'lookout', 2, 'Adormece os 2 vigias', { opt: true }),
        objC(5, 'Acerta em 5 bolas de praia'),
      ],
      bot: ['thief'],
    }));

    /* ── 26. Pontão ao Pôr do Sol: o negócio acaba e o chefe parte de lancha ── */
    LV.push(W2(PRAIA, {
      id: 'praia-pontao', name: 'Pontão ao Pôr do Sol', icon: '🌅', tod: 'sunset', grad: ['#ff9a5a', '#3a2a5a'], tags: 'longe · contra o relógio', timer: 160,
      brief: 'Ao fundo do pontão, o Capitão Bigodes faz negócio com um comprador, protegido por três guarda-costas. Quando o negócio acabar, parte de lancha. Adormece o Capitão e o Comprador — a quase 400 m, com vento do mar.',
      wind: [3, 5], windDir: 1.2, darts: 16,
      cast(P, B) {
        const R = B.R, E = -324.5;
        P.push({ role: 'boss', tag: 'captain', name: 'Capitão Bigodes', look: ADMIRAL(R), beh: { type: 'stand', x: PIER_X - 1, z: E + 1, y: PIER_Y, yaw: Math.PI / 2, act: 'talk' }, vip: true, aware: true, range: 30 });
        P.push({ role: 'guard', tag: 'buyer', name: 'Comprador', look: outfit(R, 'guard', { shirt: '#2a4a3a', hat: 'fedora', hatC: '#3a3a2a', prop: 'case', propC: '#2a2a2a' }), beh: { type: 'stand', x: PIER_X + 1.2, z: E + 1, y: PIER_Y, yaw: -Math.PI / 2, act: 'listen' }, aware: true, range: 30 });
        [[-5, -3], [5, -2], [0, 5]].forEach(([dx, dz]) => P.push({ role: 'guard', tag: 'body', name: 'Guarda-costas', look: henchSuit(R, { build: 1.2 }), beh: { type: 'stand', x: PIER_X + dx, z: E + dz, y: PIER_Y, yaw: Math.atan2(dx, dz), act: 'arms', turn: 1 }, aware: true, range: 30 }));
        return P;
      },
      onTimer(G) { const C = who(G, 'captain'); if (C && isAwake(C)) { C.fleeing = true; C.beh = { type: 'path', path: [[C.x, C.z], [PIER_X + 6, -326]], speed: 2, end: G.escapeEnd }; C.wi = 1; hint(G, 'Negócio feito — o Capitão vai para a lancha!', 3, true); } },
      onAlarm(G) { G.timer = Math.min(G.timer, 8); },
      objectives: [
        { id: 'deal', text: 'Adormece o Capitão Bigodes e o Comprador', timer: true, check: G => zz(G, 'captain') + zz(G, 'buyer') >= 2, prog: G => (zz(G, 'captain') + zz(G, 'buyer')) + '/2' },
        objN('body', 'body', 3, 'Adormece os 3 guarda-costas', { opt: true }),
        objC(5, 'Acerta em 5 bolas de praia'),
      ],
      bot: ['captain', 'buyer'],
    }));

    /* ── 27. Noite de Verão: fogueira na praia, seis capangas de lanterna ── */
    LV.push(W2(PRAIA, {
      id: 'praia-noite', name: 'Noite de Verão', icon: '🔥', tod: 'night', grad: ['#2a2a5a', '#0a0a18'], tags: 'noite · silenciosa', stealth: true,
      brief: 'Há uma festa à volta da fogueira na praia e seis capangas de lanterna procuram o tesouro do Capitão na areia. Adormece-os sem alarmes (visão noturna com N); depois o Capitão sai do bar da praia.',
      wind: [1, 2.5], windDir: 1.2, darts: 18, fog: [400, 3000],
      cast(P, B, G) {
        const R = B.R; P = P.filter(p => p.name !== 'Nadador' && p.name !== 'Jogador' && !(p.beh && p.beh.type === 'recline') && p.name !== 'Criança');
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; P.push({ role: 'civ', tag: 'civ', name: 'Festeiro', look: outfit(R, 'beach'), beh: { type: 'dance', x: -40 + Math.cos(a) * 5, z: -150 + Math.sin(a) * 4, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), act: R() < .6 ? 'dance' : 'clap' } }); }
        const area = [[-200, -110], [-90, -120], [-60, -180], [40, -170], [110, -130], [200, -160]];
        area.forEach(([x, z], i) => P.push({ role: 'guard', tag: 'guard', name: 'Capanga', look: henchSuit(R, { prop: 'light', propC: '#3a3a3a', shirt: '#2a3448' }), beh: { type: 'patrol', speed: .9, path: [[x, z, 5, 'light'], [x + 22, z - 10, 5, 'look'], [x + 6, z - 22, 5, 'light']] }, aware: true, range: 30 }));
        G.collect = { kind: 'lantern', name: 'lanternas', list: [[-116, B.frame(-116, -82).y + 4.4, -82], [-104, B.frame(-104, -82).y + 4.4, -82], [PIER_X, PIER_Y + 3.2, -250], [PIER_X - 6, PIER_Y + 3, -330]] };
        P.push({ role: 'boss', tag: 'captain', name: 'Capitão Bigodes', hidden: true, look: ADMIRAL(R), vip: true, aware: true, range: 30, beh: { type: 'path', speed: 1.2, path: [[-110, -92], [-60, -110], [60, -112], [PIER_X - 1, -100], [PIER_X - 1, -318], [PIER_X + 6, -326]], end: (G, P) => boatEscape(G, P) } });
        return P;
      },
      post(G) {
        /* fogueira: chamas (brilhos), fumo e uma luz quente */
        const y = G.hAt(-40, -150); G.fire = { p: [-40, y + .4, -150], s: [] };
        for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(Arcade3D.glowSprite(['#ffb040', '#ff7a1a', '#ffd070', '#ff5a1a'][i])); s.position.set(-40 + rand(-.3, .3), y + .5 + i * .25, -150 + rand(-.3, .3)); G.r3.scene.add(s); G.fire.s.push(s); }
        const l = new THREE.PointLight('#ff9a4a', 120, 30, 1.3); l.position.set(-40, y + 2, -150); G.r3.scene.add(l); G.fire.l = l;
        nightLights(G, [[0, 9, -62], [120, 9, -62], [-120, 9, -62], [PIER_X, 8, -200], [PIER_X, 8, -320]], '#ffd8a0', 50, 40);
      },
      script(G, dt) {
        lamps(G); const F = G.fire; if (!F) return;
        F.s.forEach((s, i) => s.scale.setScalar(1.6 + Math.sin(G.gt * (7 + i) + i) * .5 + i * .3)); F.l.intensity = 110 + Math.sin(G.gt * 13) * 25;
        if (Math.random() < dt * 14) G.r3.smoke.spawn({ x: F.p[0] + rand(-.3, .3), y: F.p[1] + 1, z: F.p[2] + rand(-.3, .3), vx: rand(-.2, .2), vy: rand(1.2, 2), vz: rand(-.2, .2), life: rand(2, 3.5), s0: .5, s1: 3, c0: '#6a6a6a', a: .3, drag: .3 });
        if (Math.random() < dt * 20) G.r3.spark.spawn({ x: F.p[0], y: F.p[1] + .5, z: F.p[2], vx: rand(-.6, .6), vy: rand(2, 4), vz: rand(-.6, .6), life: rand(.6, 1.2), s0: .12, s1: 0, c0: '#ffb040', a: 1, grav: -1 });
      },
      objectives: [
        objN('guards', 'guard', 6, 'Adormece os 6 capangas sem alarme'),
        obj1('captain', 'Adormece o Capitão antes de chegar à lancha', { after: 'guards', onShow: G => reveal(G, 'captain', 'O Capitão saiu do bar da praia!') }),
        objC(4, 'Apaga 4 lanternas de papel'),
      ],
      bot: ['guard', 'captain'],
    }));

    /* ════════════════════════════════════════════════════════════════
       CAPÍTULO 7 — Terra da Neve (mundo novo)
       Aldeia de montanha com chalés de telhados nevados, lago gelado
       com patinadores, hotel do Yeti, igreja e um teleférico de
       cadeiras que sobe a encosta em frente ao ninho (abrigo de pedra).
    ════════════════════════════════════════════════════════════════ */
    const LB = [-40, -393], LT = [-84, -205];   /* teleférico: estação de baixo e de cima */
    const SLOPE = .4, hz = z => 60 + Math.min(420, z + 330) * SLOPE, LT_H = hz(LT[1]), NZ = -120;
    const NEVE = {
      id: 'neve', bseed: 223, pseed: 323, chapter: 6, name: 'Aldeia na Neve', icon: '🏔️', tod: 'morning', grad: ['#cfe6f8', '#5a7a9a'],
      water: '#2a5a70', shallow: '#4a8a98',
      wind: [1.5, 3], windDir: -1.9, darts: 16,
      nest: { x: 0, y: hz(NZ) + 4.6, z: NZ - 3.2, yaw: 0, yawR: 1.15, pMin: -.6, pMax: .2, look: [0, 62, -420] },
      fog: [600, 4200],
      terrain: { seed: 83, hills: 12, base: 0, size: 4600, n: 260, snow: -999, sandH: -999, pal: { grass: '#e8eef5', grass2: '#dde6ef', forest: '#d0dbe6', dirt: '#b4bcc6', rock: '#76787e', sand: '#e8eef4' },
        fn: (x, z, h) => {
          let v;
          if (z > -330) v = hz(z) + h * .4;
          else if (z > -520) v = 60 + h * .12;
          else { const d = Math.min(800, -520 - z); v = 60 + Math.pow(d, 1.12) * .42 + h * (1 + Math.min(1, d / 200) * 2); }
          return v + Math.max(0, Math.abs(x) - 320) * .32 * (1 + .3 * Math.sin(z / 90));
        },
        flats: [{ x: 0, z: NZ, w: 14, d: 14, h: hz(NZ), f: 30 }, { x: 0, z: -425, w: 290, d: 160, h: 60, f: 40 }, { x: -150, z: -470, w: 80, d: 50, h: 59.2, f: 12 }, { x: LT[0], z: LT[1], w: 18, d: 16, h: LT_H, f: 18 }, { x: LB[0], z: LB[1], w: 14, d: 12, h: 60, f: 10 }] },
      build(B, G) {
        const P = [], R = B.R, y = 60, hy = (x, z) => B.frame(x, z).y;
        /* abrigo de pedra do ninho */
        { const F = B.frame(0, NZ, 0, hz(NZ) - .3); B.box(F, 'stone', 7, 3.3, 7, 0, 0, 0, '#8a8478', { uv: 2, col: 'wall' }); B.box(F, 'wood', 7.6, .2, 7.6, 0, 3.3, 0, '#ffffff', { uv: 1 }); for (const [a, b] of [[-3.6, -3.6], [3.6, -3.6]]) B.box(F, 'wood', .14, 1, .14, a, 3.5, b, '#6a4a32'); B.box(F, 'wood', 7.3, .1, .1, 0, 4.4, -3.6, '#6a4a32'); B.box(F, 'wood', 1.4, 2, .1, 2, 0, 3.52, '#5a3a24'); }
        /* praça da aldeia, chalés, hotel, igreja */
        B.ground('cobble', 0, -420, 46, 34, 0, y, '#e6e0da', 3); B.ground('cobble', 0, -380, 9, 46, 0, y, '#e6e0da', 3); B.ground('asphalt', 60, -450, 260, 9, .18, y, '#d8dce2', 6);
        { const F = B.frame(0, -420, 0, y); B.geo(F, 'stone', new THREE.CylinderGeometry(2.6, 2.9, .7, 12), 0, .35, 0, '#c8c4bc'); B.geo(F, 'glassS', new THREE.CylinderGeometry(2.3, 2.3, .1, 16), 0, .68, 0, '#d8ecf6'); B.geo(F, 'stone', new THREE.CylinderGeometry(.4, .5, 2.4, 10), 0, 1.8, 0, '#c8c4bc'); B.geo(F, 'plain', new THREE.SphereGeometry(.55, 10, 8), 0, 3.3, 0, '#f4f7fb'); B.collider(F, 6, .7, 6, 0, 0, 0, 'low'); }
        const WOOD = ['#c89a6a', '#b07a4a', '#e8d8c0', '#d8b890', '#a86a3a', '#f0e6d6'], SNOWR = '#eef2f7';
        const chalet = (x, z, yaw, o) => B.house(Object.assign({ x, z, yaw, w: 10, d: 9, floors: 2, y, wall: WOOD[Math.floor(R() * WOOD.length)], roofC: SNOWR, smoke: R() < .6, balc: true }, o || {}));
        /* o lado da praça virado para o ninho fica aberto (uma fila de chalés aí tapava a praça toda) */
        for (let i = 0; i < 5; i++) chalet(-22 + i * 11, -446, 0, { shop: i === 1 ? { c: '#7a2a2a', t: 'PADARIA' } : i === 2 ? { c: '#2a6a3a', t: 'CHOCOLATE QUENTE' } : i === 3 ? { c: '#2a5a8a', t: 'ESQUIS' } : null });
        B.fence(-23, -401, 23, -401, y, '#8a6a4a');
        for (let i = 0; i < 3; i++) { chalet(32, -410 - i * 11, -Math.PI / 2); chalet(-34, -430 - i * 11 + 11, Math.PI / 2); }
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = 95 + (i % 3) * 22, x = Math.cos(a) * r * 1.2, z = -425 + Math.sin(a) * r * .55; if (Math.hypot(x - 60, z + 470) < 30 || Math.hypot(x + 150, z + 470) < 50 || Math.hypot(x - LB[0], z - LB[1]) < 18 || (z > -430 && Math.abs(x) < 140)) continue; chalet(x, z, Math.atan2(-x, -425 - z) + Math.PI, { floors: 1 + (i % 3) }); }
        B.house({ x: 60, z: -470, yaw: 0, w: 28, d: 14, floors: 3, y, wall: '#a8784a', roofC: SNOWR, shop: { c: '#7a2a2a', t: 'HOTEL DO YETI' }, smoke: true, allBalc: true });
        for (let i = 0; i < 4; i++) { B.cafeTable(48 + i * 7, -459, y); B.umbrella(48 + i * 7, -459, y, ['#c83a3a', '#2a64b8'][i % 2]); }
        B.church({ x: -80, z: -440, yaw: Math.PI / 2, y });
        for (let i = 0; i < 8; i++) B.lamp(-21 + i * 6, -404.5, Math.PI, y);
        for (let i = 0; i < 6; i++) B.bench(-18 + i * 7.2, -436.5, 0, y);
        /* lago gelado com margens de pedra */
        B.ground('glassS', -150, -470, 76, 46, 0, 59.25, '#cfe4f2', 8);
        for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; B.rock(-150 + Math.cos(a) * 41, -470 + Math.sin(a) * 26, 1 + R() * 1.4, 59, '#8a8c92'); }
        /* bonecos de neve a enfeitar (os brindes são outros) */
        [[14, -428], [-12, -412], [70, -452]].forEach(([x, z]) => { const F = B.frame(x, z, R() * 6, y); [[.42, .4], [.3, 1.02], [.21, 1.48]].forEach(([r, yy]) => B.geo(F, 'plain', new THREE.SphereGeometry(r, 12, 9), 0, yy, 0, '#f4f7fb')); B.geo(F, 'paint', new THREE.ConeGeometry(.045, .22, 8), 0, 1.48, .27, '#ff7a1a', 0, Math.PI / 2); });
        /* teleférico: estações, postes */
        const lx = LT[0] - LB[0], lz = LT[1] - LB[1], ll = Math.hypot(lx, lz), ux = lx / ll, uz = lz / ll, yaw = Math.atan2(ux, uz);
        [[LB, 60], [LT, LT_H]].forEach(([p, h]) => { const F = B.frame(p[0], p[1], yaw, h); B.box(F, 'plain', 9, 3.4, 7, 0, 0, 0, '#d8d4cc', { col: 'wall' }); B.box(F, 'metal', 10, .3, 8, 0, 3.4, 0, '#3a4a5a'); B.box(F, 'metal', .6, 6, .6, 0, 3.4, 0, '#5a6a7a'); B.geo(F, 'metal', new THREE.TorusGeometry(2.4, .14, 6, 24), 0, 9.2, 0, '#3a3a3a', 0, Math.PI / 2); B.sign(p[0], h + 2.6, p[1], yaw + Math.PI, 'TELEFÉRICO', '#2a5a8a', '#ffffff', 3.4, .6); });
        G.lift = { a: { x: LB[0], z: LB[1], y: 60 + 9.2 }, b: { x: LT[0], z: LT[1], y: LT_H + 9.2 }, ux, uz, yaw, ll, towers: [] };
        for (let k = 1; k < 5; k++) { const t = k / 5, x = lerp(LB[0], LT[0], t), z = lerp(LB[1], LT[1], t), h = hy(x, z), top = lerp(69.2, LT_H + 9.2, t); const F = B.frame(x, z, yaw, h); B.geo(F, 'metal', new THREE.CylinderGeometry(.32, .45, top - h, 8), 0, (top - h) / 2, 0, '#5a6a7a'); B.box(F, 'metal', 6, .3, .4, 0, top - h - .2, 0, '#3a4a5a'); B.collider(F, .8, top - h, .8, 0, 0, 0, 'pole'); }
        /* pinheiros nevados (não tapam a pista do teleférico nem a aldeia) */
        const T = [];
        for (let i = 0; i < 900; i++) {
          const x = rand(-1500, 1500), z = rand(-1200, 500);
          if (Math.abs(x) < 165 && z < -330 && z > -520) continue; if (Math.hypot(x, z - NZ) < 30) continue; if (Math.hypot(x + 150, z + 470) < 50) continue;
          const t = clamp(((x - LB[0]) * ux + (z - LB[1]) * uz) / ll, 0, 1), dl = Math.hypot(x - lerp(LB[0], LT[0], t), z - lerp(LB[1], LT[1], t)); if (dl < 22) continue;
          if (Math.abs(x) < 60 && z > -330 && z < NZ) continue;   /* a pista em frente ao ninho fica limpa */
          T.push({ x, z, k: 'snowpine', s: .7 + R() * .7 });
        }
        G.treeList = T;
        /* gente */
        for (let i = 0; i < 22; i++) P.push({ role: 'civ', tag: 'civ', name: 'Visitante', look: outfit(R, R() < .25 ? 'kid' : 'winter', { long: true }), s: R() < .2 ? .64 : undefined, beh: { type: 'wander', area: [-21, -435, 21, -405], acts: ['talk', 'look', 'cup', 'listen', 'point', 'phone'] } });
        for (let i = 0; i < 8; i++) P.push({ role: 'civ', tag: 'civ', name: 'Hóspede', look: outfit(R, 'winter'), beh: { type: 'sit', x: 48 + (i % 4) * 7 + (i < 4 ? -.78 : .78), z: -459, yaw: i < 4 ? Math.PI / 2 : -Math.PI / 2, act: ['cup', 'talk', 'cup', 'listen'][i % 4] } });
        for (let i = 0; i < 9; i++) P.push({ role: 'civ', tag: 'civ', name: 'Patinador', look: outfit(R, R() < .3 ? 'kid' : 'winter'), s: R() < .3 ? .66 : undefined, beh: { type: 'wander', area: [-180, -485, -120, -455], acts: ['look', 'talk', 'wave'], speed: 1.7 } });
        [[12.6, -427], [-12.6, -411]].forEach(([x, z]) => P.push({ role: 'civ', tag: 'civ', name: 'Criança', s: .62, look: outfit(R, 'kid', { long: true, hat: 'beanie', hatC: '#e83a3a' }), beh: { type: 'kneel', x, z, yaw: Math.PI / 2, act: 'dig' } }));
        for (let i = 0; i < 4; i++) P.push({ role: 'civ', tag: 'civ', name: 'Varredor de neve', look: outfit(R, 'worker', { long: true, prop: 'broom' }), beh: { type: 'seq', steps: [{ go: [-30 + i * 20, -437] }, { do: 'sweep', d: 12 }, { go: [-30 + i * 20 + 6, -403] }, { do: 'sweep', d: 12 }] } });
        for (let i = 0; i < 6; i++) { const d = R() < .5; P.push({ role: 'civ', tag: 'civ', name: 'Caminhante', look: outfit(R, 'winter'), beh: { type: 'path', path: d ? [[-60, -451.5], [180, -449]] : [[180, -448.5], [-60, -451]], loop: 'ping', speed: rand(1, 1.4) } }); }
        G.carsDef = [{ path: [[-70, -452], [190, -448]], loop: 'ping', n: 2, speed: 7, type: 'suv' }];
        G.birds = { n: 8, kind: 'pigeon', centers: [[0, y, -420]] };
        G.collect = { kind: 'snowman', name: 'bonecos de neve', list: [[-48, hy(-48, -400), -400], [96, hy(96, -440), -440], [-118, hy(-118, -446), -446]] };
        G.escapePath = P => [[P.x, P.z], [60, -462.5]];
        G.escapeEnd = (G, P) => { P.hidden = true; fail(G, `${P.name} fechou-se no Hotel do Yeti!`); };
        return P;
      },
      /* teleférico: cadeiras a andar (sobem do lado direito, descem do esquerdo) */
      extra(G) {
        const L = G.lift, n = 13, chairs = [], mt = new THREE.MeshStandardMaterial({ color: '#2a3a8a', roughness: .5 }), mm = new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: .4, metalness: .6, envMap: G.r3.env });
        const rx = L.uz, rz = -L.ux;
        for (const side of [1, -1]) for (let i = 0; i < n; i++) {
          const g = new THREE.Group(), add = (geo, m, x, y2, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y2, z); me.castShadow = true; g.add(me); return me; };
          add(new THREE.BoxGeometry(1.15, .08, .5), mt, 0, -.04, .02); add(new THREE.BoxGeometry(1.15, .6, .06), mt, 0, .3, -.24); add(new THREE.BoxGeometry(.05, 2.3, .05), mm, 0, 1.2, -.27);
          add(new THREE.BoxGeometry(1.2, .04, .04), mm, 0, .55, .42); add(new THREE.BoxGeometry(.04, .5, .04), mm, -.58, .3, .2); add(new THREE.BoxGeometry(.04, .5, .04), mm, .58, .3, .2); add(new THREE.BoxGeometry(.9, .04, .04), mm, 0, -.4, .45);
          G.r3.scene.add(g); chairs.push({ g, side, u: i / n });
        }
        L.chairs = chairs; L.rx = rx; L.rz = rz;
        /* cabos */
        const cm = new THREE.LineBasicMaterial({ color: '#2a2a2a' });
        for (const side of [1, -1]) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(L.a.x + rx * 2.4 * side, L.a.y, L.a.z + rz * 2.4 * side), new THREE.Vector3(L.b.x + rx * 2.4 * side, L.b.y, L.b.z + rz * 2.4 * side)]); G.r3.scene.add(new THREE.Line(g, cm)); }
        liftPlace(G, 0); liftRiders(G);
      },
      script(G, dt) { liftPlace(G, dt); },
    };
    function liftPlace(G, dt) {
      const L = G.lift; if (!L || !L.chairs) return;
      const sp = 2.3 / (L.ll * 1.0);
      L.chairs.forEach(c => {
        c.u = (c.u + sp * dt) % 1;
        const t = c.side > 0 ? c.u : 1 - c.u, x = lerp(L.a.x, L.b.x, t) + L.rx * 2.4 * c.side, z = lerp(L.a.z, L.b.z, t) + L.rz * 2.4 * c.side, y = lerp(L.a.y, L.b.y, t) - 2.35;
        c.g.position.set(x, y, z); c.g.rotation.y = c.side > 0 ? L.yaw : L.yaw + Math.PI; c.g.rotation.z = Math.sin(G.gt * 1.3 + c.u * 40) * .03;
        c.top = c.side > 0 && c.u > .985;
      });
    }
    /* quem anda de cadeira: as cadeiras só existem depois de a gente nascer, por isso a ligação faz-se no fim da montagem */
    function liftRiders(G) {
      const L = G.lift; if (!L || !L.chairs || L.wired) return; L.wired = true;
      G.people.forEach(P => { if (P.liftI == null) return; const c = L.chairs[P.liftI]; P.beh = { type: 'ride', obj: c.g, seat: [0, .05, .02], rot: 0, act: P.liftAct || 'listen' }; P.chair = c; });
    }
    const liftCast = (P, R, skip) => { for (let i = 0; i < 26; i++) { if (i % 3 === 1 || (skip && skip.includes(i))) continue; P.push({ role: 'civ', tag: 'civ', name: 'Esquiador', look: outfit(R, 'winter', { hat: R() < .5 ? 'beanie' : 'cap', glasses: R() < .6 ? 'sun' : null }), liftI: i, beh: { type: 'stand', x: LB[0], z: LB[1] } }); } return P; };
    const YETI = R => outfit(R, 'winter', { shirt: '#f4f4f4', pants: '#cfd4da', hat: 'beanie', hatC: '#f4f4f4', face: 'beard', hairC: '#f0f0ea', build: 1.3, belly: 1.4, prop: 'broom', gloves: '#e8e8e8' });
    /* ── 28. Aldeia na Neve: o Yeti Bigodes varre a neve à porta do hotel ── */
    LV.push(W2(NEVE, {
      tags: 'mundo novo · neve', snow: .45,
      brief: 'O Yeti Bigodes — o capanga mais forte da Liga — varre a neve à porta do Hotel do Yeti, com seis guardas pela aldeia. Adormece-o antes que se feche no hotel. Está a nevar: os flocos não desviam o dardo, o vento sim.',
      cast(P, B) {
        const R = B.R; liftCast(P, R);
        P.push({ role: 'boss', tag: 'yeti', name: 'Yeti Bigodes', look: YETI(R), vip: true, aware: true, range: 30, beh: { type: 'seq', speed: 1, steps: [{ go: [62, -461] }, { do: 'sweep', d: 14, yaw: 0 }, { go: [44, -457] }, { do: 'sweep', d: 12, yaw: .5 }, { go: [76, -457] }, { do: 'sweep', d: 12, yaw: -.5 }] } });
        [[[-20, -405], [20, -405]], [[-20, -437], [20, -437]], [[27, -405], [27, -437]], [[-28, -405], [-28, -437]], [[40, -455], [80, -455]], [[-120, -450], [-100, -490]]].forEach(path => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: henchSuit(R, { hat: 'beanie', hatC: '#2c3548' }), beh: { type: 'patrol', path: path.map(p => [p[0], p[1], 4, B.pick(['look', 'radio', 'arms'])]), speed: 1.1 }, aware: true, range: 34 }));
        return P;
      },
      script(G, dt) { liftRiders(G); liftPlace(G, dt); },
      objectives: [
        obj1('yeti', 'Adormece o Yeti Bigodes'),
        objN('guards', 'guard', 6, 'Adormece os 6 guardas sem alarme', { opt: true, check: G => !G.alarm && zz(G, 'guard') >= 6 }),
        objC(3, 'Acerta em 3 bonecos de neve'),
      ],
      bot: ['yeti'],
    }));

    /* ── 29. Teleférico: o Conde Gelado sobe de cadeira; lá em cima espera-o uma mota de neve ── */
    LV.push(W2(NEVE, {
      id: 'neve-telef', name: 'Teleférico', icon: '🚡', tod: 'noon', grad: ['#9ad4f8', '#3a6a9a'], tags: 'alvo em movimento',
      brief: 'O Conde Gelado sobe no teleférico entre esquiadores, de casaco roxo e cartola. Adormece-o na cadeira antes de chegar lá acima — se chegar, foge no jipe da Liga e terás de lhe furar os pneus.',
      wind: [3, 5], windDir: -1.9, darts: 16,
      cast(P, B, G) {
        const R = B.R; liftCast(P, R, [2]);
        P.push({ role: 'boss', tag: 'conde', name: 'Conde Gelado', liftI: 2, liftAct: 'phone', look: outfit(R, 'winter', { shirt: '#6a2a8a', hat: 'top', hatC: '#1a1a1a', face: 'mustache', glasses: null, gloves: '#1a1a1a' }), vip: true, aware: true, range: 30, marked: true, beh: { type: 'stand', x: LB[0], z: LB[1] } });
        [[LT[0] + 6, LT[1] + 4], [LT[0] - 6, LT[1] + 2], [LT[0] - 2, LT[1] - 7]].forEach(([x, z], i) => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: henchSuit(R, { hat: 'beanie', hatC: '#2c3548' }), beh: { type: 'stand', x, z, yaw: Math.PI * (.2 + i * .5), act: ['bino', 'arms', 'radio'][i], turn: 1 }, aware: true, range: 36 }));
        G.carsDef = (G.carsDef || []).concat([{ path: [[LT[0] - 6, LT[1] + 9], [LT[0] - 40, LT[1] - 30], [LT[0] - 120, LT[1] - 150], [LT[0] - 230, LT[1] - 380]], n: 1, parked: true, at: 0, tag: 'escape', type: 'suv', color: '#1a1a22', speed: 8 }]);
        return P;
      },
      post(G) { const L = G.lift; L.chairs.forEach((c, i) => { if (c.side > 0) c.u = (i / 13 + .9) % 1; }); L.chairs[2].u = .04; hint(G, '🚡 O Conde Gelado vai na cadeira com o marcador amarelo!', 4, true); },
      script(G, dt) {
        liftRiders(G); liftPlace(G, dt);
        const C = who(G, 'conde'); if (!C || !C.chair) return;
        if (C.sleep && !C.offLift) G.liftSleep = true;
        if (!C.sleep && !C.offLift && C.chair.top) {
          C.offLift = true; C.sitting = false; C.fy = null; C.x = LT[0] + 4; C.z = LT[1] + 2;
          C.beh = { type: 'path', speed: 2.4, path: [[C.x, C.z], [LT[0] - 4, LT[1] + 8]], end: (G, P) => { const car = G.cars.find(c => c.tag === 'escape'); takeCar(G, P, car, 'O Conde Gelado fugiu de jipe!', Cp => [[Cp.x - 20, Cp.z - 20], [Cp.x - 60, Cp.z - 70]]); hint(G, 'Meteu-se no jipe — fura 2 pneus!', 3, true); } }; C.wi = 1;
          setPip(G, C, 'O Conde chegou lá acima!', 4, 3);
        }
      },
      objectives: [
        obj1('conde', 'Adormece o Conde Gelado'),
        { id: 'lift', text: 'Adormece-o ainda na cadeira', opt: true, check: G => !!G.liftSleep },
        objN('guards', 'guard', 3, 'Adormece os 3 guardas da estação de cima', { opt: true }),
        objC(3, 'Acerta em 3 bonecos de neve'),
      ],
      bot: ['conde'],
    }));

    /* ── 30. Tempestade de Neve: o Grão-Mestre da Liga ── */
    LV.push(W2(NEVE, {
      id: 'neve-final', name: 'Tempestade de Neve', icon: '❄️', tod: 'overcast', grad: ['#b8c4d0', '#2a3442'], tags: 'missão final', snow: 1.3,
      brief: 'Missão final! O Grão-Mestre Bigodes, chefe de toda a Liga, está escondido no Hotel do Yeti, com oito guardas lá fora. Adormece os guardas no meio da tempestade e ele há de sair para o jipe — fura-lhe os pneus e adormece-o.',
      wind: [5, 8], windDir: -1.9, darts: 24, fog: [130, 1000],
      cast(P, B, G) {
        const R = B.R; liftCast(P, R);
        P = P.filter(p => p.name !== 'Patinador');
        [[[-20, -405], [20, -405]], [[-20, -437], [20, -437]], [[27, -405], [27, -437]], [[-28, -405], [-28, -437]], [[-60, -455], [-10, -455]], [[90, -455], [140, -450]]].forEach(path => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: henchSuit(R, { hat: 'beanie', hatC: '#2c3548' }), beh: { type: 'patrol', path: path.map(p => [p[0], p[1], 4, B.pick(['look', 'radio', 'arms'])]), speed: 1.1 }, aware: true, range: 30 }));
        [[54, -461.5], [66, -461.5]].forEach(([x, z]) => P.push({ role: 'guard', tag: 'guard', name: 'Guarda da porta', look: henchSuit(R, { build: 1.2, hat: 'beanie', hatC: '#2c3548' }), beh: { type: 'stand', x, z, yaw: 0, act: 'arms', turn: 1 }, aware: true, range: 30 }));
        P.push({ role: 'boss', tag: 'grand', name: 'Grão-Mestre Bigodes', hidden: true, vip: true, aware: true, range: 30, look: outfit(R, 'winter', { shirt: '#4a1a5a', over: 'lapel', overC: '#d8c070', hat: 'top', hatC: '#1a1a1a', face: 'mustache', glasses: 'sun', hairC: '#d8d8d0', build: 1.2, belly: 1.35, gloves: '#d8c070' }),
          beh: { type: 'path', speed: 1.3, path: [[60, -462.5], [72, -458], [78, -455.5]], end: (G, P) => { const car = G.cars.find(c => c.tag === 'escape'); takeCar(G, P, car, 'O Grão-Mestre fugiu na tempestade!', Cp => [[Cp.x + 10, Cp.z + 20], [Cp.x + 50, Cp.z + 60]]); hint(G, 'O Grão-Mestre meteu-se no jipe — fura 2 pneus!', 3, true); setPip(G, P, 'O Grão-Mestre vai fugir de jipe!', 4, 3); } } });
        G.carsDef = [{ path: [[80, -453.5], [150, -449], [260, -440], [420, -420]], n: 1, parked: true, at: 0, tag: 'escape', type: 'suv', color: '#16161c', speed: 11 }];
        return P;
      },
      script(G, dt) { liftRiders(G); liftPlace(G, dt); },
      objectives: [
        objN('guards', 'guard', 8, 'Adormece os 8 guardas da Liga'),
        obj1('grand', 'Adormece o Grão-Mestre Bigodes', { after: 'guards', onShow: G => reveal(G, 'grand', 'O Grão-Mestre saiu do hotel!') }),
        { id: 'tires', text: 'Fura 2 pneus ao jipe', opt: true, check: G => { const c = G.cars.find(c => c.tag === 'escape'); return c && c.flat >= 2; } },
        objC(3, 'Acerta em 3 bonecos de neve'),
      ],
      bot: ['guard', 'tires', 'grand'],
    }));

    return LV;
  };
})();
