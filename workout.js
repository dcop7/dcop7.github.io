const WorkoutPage = (function () {
  'use strict';

  // ── Audio ──────────────────────────────────────────────────────────
  function beep(freq, dur, vol = 0.3) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function chime() { beep(784,.15); setTimeout(()=>beep(1047,.25),170); }
  function gong()  { beep(523,.3,.5); }
  function done()  { beep(523,.12); setTimeout(()=>beep(659,.12),130); setTimeout(()=>beep(784,.12),260); setTimeout(()=>beep(1047,.4),390); }

  // ── SVG Stick Figures ──────────────────────────────────────────────
  // Each figure has 2 SVG frames alternated by CSS animation (steps(1))
  // viewBox="0 0 80 120", shared stroke style injected via CSS

  function fig(id, frames) {
    const [f1, f2] = frames;
    return `
      <div class="wk-fig-svg-wrap">
        <svg class="wk-fig-a" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">
          ${f1}
        </svg>
        <svg class="wk-fig-b" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">
          ${f2}
        </svg>
      </div>`;
  }

  // Shared parts
  const head  = (cx=40,cy=14,r=9) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="sf-head"/>`;
  const ln    = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

  // ── Figure library ─────────────────────────────────────────────────
  const FIGS = {

    // SQUAT
    squat: fig('squat',[
      // Frame A: standing up
      head(40,14) +
      ln(40,23,40,58) +                       // spine
      ln(40,35,25,50) + ln(40,35,55,50) +     // arms down
      ln(40,58,28,82) + ln(40,58,52,82) +     // upper legs
      ln(28,82,28,105) + ln(52,82,52,105),    // lower legs
      // Frame B: deep squat
      head(40,14) +
      ln(40,23,40,50) +                       // shorter spine
      ln(40,35,20,28) + ln(40,35,60,28) +     // arms out
      ln(40,50,20,72) + ln(40,50,60,72) +     // upper legs splayed
      ln(20,72,30,95) + ln(60,72,50,95),      // lower legs
    ]),

    // PUSH-UP
    pushup: fig('pushup',[
      // Frame A: up position
      head(18,28,8) +
      ln(18,36,50,38) +                       // body horizontal
      ln(50,38,68,38) +                       // lower body
      ln(28,38,28,58) + ln(42,38,42,58) +     // arms up
      ln(68,38,72,58),                        // feet
      // Frame B: down position
      head(18,38,8) +
      ln(18,46,50,52) +
      ln(50,52,68,52) +
      ln(28,52,26,68) + ln(42,52,44,68) +
      ln(68,52,72,68),
    ]),

    // PLANK
    plank: fig('plank',[
      // Frame A: straight plank
      head(12,32,8) +
      ln(12,40,62,42) +                       // body horizontal
      ln(30,41,28,62) + ln(44,41,46,62) +     // arms (forearms on floor)
      ln(62,42,66,60),                        // feet
      // Frame B: micro hip dip
      head(12,32,8) +
      ln(12,40,62,46) +
      ln(30,41,28,62) + ln(44,42,46,62) +
      ln(62,46,66,62),
    ]),

    // LUNGE
    lunge: fig('lunge',[
      // Frame A: right leg forward
      head(40,14) +
      ln(40,23,40,52) +
      ln(40,35,24,46) + ln(40,35,56,46) +
      ln(40,52,24,75) + ln(40,52,56,75) +
      ln(24,75,20,100) + ln(56,75,60,100),
      // Frame B: left leg forward
      head(40,14) +
      ln(40,23,40,52) +
      ln(40,35,56,46) + ln(40,35,24,46) +
      ln(40,52,56,75) + ln(40,52,24,75) +
      ln(56,75,60,100) + ln(24,75,20,100),
    ]),

    // BRIDGE (glute bridge)
    bridge: fig('bridge',[
      // Frame A: hips down
      head(40,105,8) +
      ln(40,97,60,78) +                       // torso
      ln(60,78,70,55) +                       // upper legs
      ln(70,55,68,32) +                       // lower legs
      ln(40,97,18,100) + ln(18,100,14,75),    // arms on floor
      // Frame B: hips up
      head(40,108,8) +
      ln(40,100,68,72) +
      ln(68,72,66,45) +
      ln(66,45,64,22) +
      ln(40,100,16,102) + ln(16,102,12,78),
    ]),

    // CRUNCH
    crunch: fig('crunch',[
      // Frame A: lying flat
      head(14,28,8) +
      ln(14,36,60,40) +                       // body
      ln(60,40,76,58) +                       // legs bent
      ln(76,58,68,80) +
      ln(14,36,10,52) + ln(10,52,16,68),      // arms
      // Frame B: crunching up
      head(22,20,8) +
      ln(22,28,62,44) +
      ln(62,44,74,62) +
      ln(74,62,66,84) +
      ln(22,28,14,44) + ln(14,44,20,60),
    ]),

    // JUMPING JACK
    jumpjack: fig('jumpjack',[
      // Frame A: legs/arms together
      head(40,14) +
      ln(40,23,40,58) +
      ln(40,35,30,50) + ln(40,35,50,50) +
      ln(40,58,36,85) + ln(40,58,44,85) +
      ln(36,85,36,108) + ln(44,85,44,108),
      // Frame B: legs/arms wide
      head(40,14) +
      ln(40,23,40,58) +
      ln(40,35,16,22) + ln(40,35,64,22) +     // arms wide up
      ln(40,58,22,80) + ln(40,58,58,80) +     // legs wide
      ln(22,80,16,105) + ln(58,80,64,105),
    ]),

    // RUNNING / HIGH KNEES
    highknees: fig('highknees',[
      // Frame A: left knee up, right arm forward
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,24,50) + ln(40,35,56,28) +     // arms
      ln(40,55,28,72) + ln(28,72,26,58) +     // left leg — knee raised
      ln(40,55,54,78) + ln(54,78,56,105),     // right leg down
      // Frame B: right knee up, left arm forward
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,56,50) + ln(40,35,24,28) +
      ln(40,55,52,72) + ln(52,72,54,58) +
      ln(40,55,26,78) + ln(26,78,24,105),
    ]),

    // BURPEE
    burpee: fig('burpee',[
      // Frame A: standing jump (arms up)
      head(40,10) +
      ln(40,19,40,52) +
      ln(40,30,20,14) + ln(40,30,60,14) +
      ln(40,52,32,80) + ln(40,52,48,80) +
      ln(32,80,30,105) + ln(48,80,50,105),
      // Frame B: plank position
      head(12,32,8) +
      ln(12,40,62,42) +
      ln(30,41,28,62) + ln(44,41,46,62) +
      ln(62,42,66,60),
    ]),

    // MOUNTAIN CLIMBER
    climber: fig('climber',[
      // Frame A: right knee tucked
      head(12,30,8) +
      ln(12,38,60,42) +
      ln(30,40,28,60) + ln(44,41,46,61) +
      ln(60,42,52,65) + ln(52,65,50,88) +    // right leg tucked
      ln(60,42,68,68) + ln(68,68,70,95),     // left leg back
      // Frame B: left knee tucked
      head(12,30,8) +
      ln(12,38,60,42) +
      ln(30,40,28,60) + ln(44,41,46,61) +
      ln(60,42,68,65) + ln(68,65,70,88) +
      ln(60,42,50,68) + ln(50,68,48,95),
    ]),

    // TWIST (Russian twist)
    twist: fig('twist',[
      // Frame A: leaning back, twisted left
      head(40,18) +
      ln(40,26,40,58) +
      ln(40,38,18,32) + ln(40,38,50,30) +    // arms twisted left
      ln(40,58,30,80) + ln(40,58,50,80) +    // V sit legs
      ln(30,80,28,108) + ln(50,80,52,108),
      // Frame B: twisted right
      head(40,18) +
      ln(40,26,40,58) +
      ln(40,38,50,32) + ln(40,38,18,30) +
      ln(40,58,30,80) + ln(40,58,50,80) +
      ln(30,80,28,108) + ln(50,80,52,108),
    ]),

    // SIDE PLANK
    sideplank: fig('sideplank',[
      // Frame A: side plank left arm
      head(20,18,8) +
      ln(20,26,62,58) +                       // body diagonal
      ln(30,32,28,52) +                       // supporting arm
      ln(62,58,70,48) +                       // top arm up
      ln(62,58,64,85),                        // legs
      // Frame B: slight hip dip
      head(20,20,8) +
      ln(20,28,62,62) +
      ln(30,34,28,54) +
      ln(62,62,70,52) +
      ln(62,62,64,88),
    ]),

    // BICYCLE CRUNCH
    bicycle: fig('bicycle',[
      // Frame A: right elbow to left knee
      head(38,20,8) +
      ln(38,28,44,58) +
      ln(44,58,62,75) + ln(62,75,60,98) +    // right leg out
      ln(44,58,24,78) + ln(24,78,26,62) +    // left knee up
      ln(38,28,20,22) + ln(38,28,58,34),     // arms/elbows
      // Frame B: left elbow to right knee
      head(42,20,8) +
      ln(42,28,36,58) +
      ln(36,58,18,75) + ln(18,75,20,98) +
      ln(36,58,56,78) + ln(56,78,54,62) +
      ln(42,28,60,22) + ln(42,28,22,34),
    ]),

    // LEG RAISE
    legraise: fig('legraise',[
      // Frame A: legs down
      head(40,14,8) +
      ln(40,22,40,60) +
      ln(40,35,24,50) + ln(40,35,56,50) +
      ln(40,60,32,88) + ln(40,60,48,88) +
      ln(32,88,32,110) + ln(48,88,48,110),
      // Frame B: legs raised
      head(40,14,8) +
      ln(40,22,40,60) +
      ln(40,35,24,50) + ln(40,35,56,50) +
      ln(40,60,30,38) + ln(40,60,50,38) +    // legs up
      ln(30,38,28,18) + ln(50,38,52,18),
    ]),

    // DEAD BUG
    deadbug: fig('deadbug',[
      // Frame A: right arm + left leg extended
      head(40,14,8) +
      ln(40,22,40,58) +
      ln(40,35,62,20) + ln(40,35,22,46) +    // right arm up, left arm side
      ln(40,58,24,78) + ln(24,78,20,100) +   // left leg down
      ln(40,58,60,72) + ln(60,72,65,50),     // right leg raised
      // Frame B: left arm + right leg extended
      head(40,14,8) +
      ln(40,22,40,58) +
      ln(40,35,18,20) + ln(40,35,58,46) +
      ln(40,58,56,78) + ln(56,78,60,100) +
      ln(40,58,20,72) + ln(20,72,15,50),
    ]),

    // DIP
    dip: fig('dip',[
      // Frame A: arms extended (up position)
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,20,40) + ln(20,40,16,62) +    // left arm on chair
      ln(40,35,60,40) + ln(60,40,64,62) +    // right arm on chair
      ln(40,55,32,82) + ln(40,55,48,82) +
      ln(32,82,30,108) + ln(48,82,50,108),
      // Frame B: arms bent (down position)
      head(40,22) +
      ln(40,30,40,62) +
      ln(40,42,20,40) + ln(20,40,16,62) +
      ln(40,42,60,40) + ln(60,40,64,62) +
      ln(40,62,32,88) + ln(40,62,48,88) +
      ln(32,88,30,110) + ln(48,88,50,110),
    ]),

    // BOX STEP
    boxstep: fig('boxstep',[
      // Frame A: step up (left foot on step)
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,24,46) + ln(40,35,56,46) +
      ln(40,55,28,74) + ln(28,74,24,96) +    // left leg on step
      ln(40,55,52,80) + ln(52,80,52,108),    // right leg down
      // Frame B: both on step
      head(40,10) +
      ln(40,19,40,52) +
      ln(40,30,24,42) + ln(40,30,56,42) +
      ln(40,52,30,74) + ln(30,74,28,96) +
      ln(40,52,50,74) + ln(50,74,52,96),
    ]),

    // SKATER JUMP
    skater: fig('skater',[
      // Frame A: landing on left foot, body lean left
      head(28,18) +
      ln(28,26,38,58) +
      ln(38,45,20,38) + ln(38,45,52,38) +
      ln(38,58,26,80) + ln(26,80,22,108) +   // left leg landing
      ln(38,58,56,72) + ln(56,72,62,52),     // right leg up/back
      // Frame B: landing on right foot
      head(52,18) +
      ln(52,26,42,58) +
      ln(42,45,60,38) + ln(42,45,28,38) +
      ln(42,58,54,80) + ln(54,80,58,108) +
      ln(42,58,24,72) + ln(24,72,18,52),
    ]),

    // SUPERMAN
    superman: fig('superman',[
      // Frame A: arms and legs slightly raised
      head(16,34,8) +
      ln(16,42,60,46) +                       // body horizontal
      ln(16,42,6,28) + ln(6,28,4,18) +        // arms up
      ln(60,46,70,36) + ln(70,36,76,26) +
      ln(60,46,64,68) + ln(64,68,68,88),     // legs up
      // Frame B: full extension (higher)
      head(16,32,8) +
      ln(16,40,60,44) +
      ln(16,40,4,24) + ln(4,24,2,14) +
      ln(60,44,72,32) + ln(72,32,78,20) +
      ln(60,44,62,66) + ln(62,66,66,86),
    ]),

    // JUMP SQUAT
    jumpsquat: fig('jumpsquat',[
      // Frame A: in the air (full extension)
      head(40,8) +
      ln(40,17,40,48) +
      ln(40,28,22,18) + ln(40,28,58,18) +    // arms up
      ln(40,48,32,72) + ln(40,48,48,72) +
      ln(32,72,30,96) + ln(48,72,50,96),
      // Frame B: landing squat
      head(40,14) +
      ln(40,23,40,54) +
      ln(40,35,20,28) + ln(40,35,60,28) +    // arms out for balance
      ln(40,54,20,76) + ln(40,54,60,76) +
      ln(20,76,28,100) + ln(60,76,52,100),
    ]),

    // REST / COOLDOWN
    cooldown: fig('cooldown',[
      // Frame A: standing relaxed arms out
      head(40,14) +
      ln(40,23,40,58) +
      ln(40,35,22,48) + ln(40,35,58,48) +
      ln(40,58,34,85) + ln(40,58,46,85) +
      ln(34,85,34,108) + ln(46,85,46,108),
      // Frame B: deep breath (arms rise)
      head(40,14) +
      ln(40,23,40,58) +
      ln(40,35,20,26) + ln(40,35,60,26) +
      ln(40,58,34,85) + ln(40,58,46,85) +
      ln(34,85,34,108) + ln(46,85,46,108),
    ]),

    // WARMUP
    warmup: fig('warmup',[
      // Frame A: marching, left knee up
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,24,48) + ln(40,35,56,26) +
      ln(40,55,50,78) + ln(50,78,52,105) +
      ln(40,55,28,72) + ln(28,72,26,56),
      // Frame B: marching, right knee up
      head(40,14) +
      ln(40,23,40,55) +
      ln(40,35,56,48) + ln(40,35,24,26) +
      ln(40,55,30,78) + ln(30,78,28,105) +
      ln(40,55,52,72) + ln(52,72,54,56),
    ]),
  };

  const ANIM_MAP = {
    pushup:   'pushup',    squat:    'squat',
    lunge:    'lunge',     plank:    'plank',
    bridge:   'bridge',    superman: 'superman',
    dip:      'dip',       jumpjack: 'jumpjack',
    highknees:'highknees', burpee:   'burpee',
    climber:  'climber',   jumpsquat:'jumpsquat',
    skater:   'skater',    boxstep:  'boxstep',
    crunch:   'crunch',    twist:    'twist',
    sideplank:'sideplank', bicycle:  'bicycle',
    legraise: 'legraise',  deadbug:  'deadbug',
    warmup:   'warmup',    cooldown: 'cooldown',
  };

  function makeFig(animKey, isRest) {
    if (isRest) return FIGS.cooldown || '';
    const key = ANIM_MAP[animKey] || 'warmup';
    return FIGS[key] || FIGS.warmup;
  }

  // ── Exercise database ──────────────────────────────────────────────
  const DB = {
    strength: [
      { name:'Flexões',           desc:'Mãos na largura dos ombros. Desce o peito ao chão e sobe com controlo.',        work:40,rest:20,anim:'pushup',   muscle:'Peito · Triceps · Ombros' },
      { name:'Agachamentos',      desc:'Pés na largura dos ombros. Desce até à paralela mantendo as costas direitas.',   work:40,rest:20,anim:'squat',    muscle:'Pernas · Glúteos · Core' },
      { name:'Afundos Alternados',desc:'Passo à frente, dobra o joelho traseiro quase ao chão. Alterna as pernas.',      work:35,rest:20,anim:'lunge',    muscle:'Quadriceps · Glúteos' },
      { name:'Prancha',           desc:'Corpo em linha reta sobre antebraços. Contrai o abdómen e respira.',             work:45,rest:15,anim:'plank',    muscle:'Core · Ombros · Glúteos' },
      { name:'Ponte de Glúteos',  desc:'Deitado, joelhos dobrados. Levanta os quadris até ao alinhamento com o tronco.',work:40,rest:15,anim:'bridge',   muscle:'Glúteos · Isquiotibiais' },
      { name:'Superman',          desc:'Deitado de bruços. Levanta braços e pernas simultaneamente. Segura 2 segundos.', work:35,rest:15,anim:'superman', muscle:'Eretores da Coluna · Glúteos' },
      { name:'Dips de Triceps',   desc:'Usa uma cadeira sólida. Dobra os cotovelos até 90° e empurra de volta.',         work:35,rest:20,anim:'dip',      muscle:'Triceps · Ombros' },
      { name:'Pike Push-ups',     desc:'Corpo em V invertido. Dobra os cotovelos descendo a cabeça ao chão.',            work:35,rest:20,anim:'pushup',   muscle:'Ombros · Triceps' },
    ],
    cardio: [
      { name:'Jumping Jacks',     desc:'Salta abrindo pernas e braços em simultâneo. Mantém ritmo constante.',          work:40,rest:15,anim:'jumpjack', muscle:'Todo o corpo · Cardio' },
      { name:'High Knees',        desc:'Corre no lugar levantando os joelhos à altura da anca. Braços em movimento.',    work:35,rest:15,anim:'highknees',muscle:'Pernas · Core · Cardio' },
      { name:'Burpees',           desc:'Agacha, apoia mãos, estende pernas, faz flexão, volta e salta com força.',       work:30,rest:25,anim:'burpee',   muscle:'Corpo completo · Cardio' },
      { name:'Mountain Climbers', desc:'Em prancha, alterna joelhos em direção ao peito o mais rápido possível.',        work:35,rest:15,anim:'climber',  muscle:'Core · Ombros · Cardio' },
      { name:'Saltos de Agachamento',desc:'Agachamento completo. No topo, salta explosivamente e aterra suave.',         work:35,rest:20,anim:'jumpsquat',muscle:'Pernas · Glúteos · Cardio' },
      { name:'Skater Jumps',      desc:'Salta de lado, aterrando num pé. Imita o movimento de patinador.',               work:35,rest:20,anim:'skater',   muscle:'Pernas · Equilíbrio · Cardio' },
      { name:'Corrida no Lugar',  desc:'Corre no lugar o mais rápido possível. Eleva os joelhos.',                       work:30,rest:15,anim:'highknees',muscle:'Todo o corpo · Cardio' },
      { name:'Box Steps',         desc:'Sobe e desce num degrau ou plataforma baixa. Mantém ritmo constante.',           work:45,rest:15,anim:'boxstep',  muscle:'Pernas · Cardio' },
    ],
    core: [
      { name:'Prancha',           desc:'Corpo em linha reta sobre antebraços. Contrai forte o abdómen.',                 work:45,rest:15,anim:'plank',    muscle:'Core profundo · Ombros' },
      { name:'Abdominais',        desc:'Deitado, joelhos dobrados. Sobe apenas o tronco superior. Não puxes o pescoço.', work:40,rest:15,anim:'crunch',   muscle:'Reto abdominal' },
      { name:'Torção Russa',      desc:'Sentado inclinado a 45°. Torce o tronco de lado a lado. Podes segurar peso.',    work:35,rest:15,anim:'twist',    muscle:'Oblíquos · Core' },
      { name:'Prancha Lateral',   desc:'Suporta o corpo num antebraço. Corpo em linha reta. Alterna lados.',             work:30,rest:15,anim:'sideplank', muscle:'Oblíquos · Core lateral' },
      { name:'Bicicleta',         desc:'Cotovelo toca no joelho oposto alternando. Movimento controlado e lento.',       work:40,rest:15,anim:'bicycle',  muscle:'Abdominais · Oblíquos' },
      { name:'Leg Raises',        desc:'Deitado, pernas juntas. Levanta até à vertical mantendo os lombos no chão.',     work:35,rest:15,anim:'legraise', muscle:'Abdominais inferiores' },
      { name:'Dead Bug',          desc:'Deitado, costas na chão. Estende braço e perna opostos alternadamente.',         work:35,rest:15,anim:'deadbug',  muscle:'Core profundo · Estabilidade' },
      { name:'Superman',          desc:'Levanta simultaneamente braços e pernas deitado de bruços. Segura 2s.',           work:35,rest:15,anim:'superman', muscle:'Eretores · Glúteos' },
    ],
  };

  function buildWorkout(type, totalMin) {
    const totalSec = totalMin * 60;
    let pool = type === 'mixed'
      ? [...DB.strength, ...DB.cardio, ...DB.core].sort(() => Math.random()-.5)
      : (DB[type] || DB.strength).slice().sort(() => Math.random()-.5);

    const list = [{ name:'Aquecimento', desc:'Marcha no lugar, rotações articulares e mobilidade.', work:60, rest:0, anim:'warmup', muscle:'Aquecimento geral', isSpecial:true }];
    let elapsed = 60;
    let i = 0;
    while (elapsed < totalSec - 60) {
      const ex = pool[i % pool.length];
      list.push({ ...ex, isSpecial:false });
      elapsed += ex.work + ex.rest;
      i++;
      if (i > pool.length * 4) break;
    }
    list.push({ name:'Relaxamento', desc:'Respiração profunda e alongamentos suaves. Excelente trabalho!', work:60, rest:0, anim:'cooldown', muscle:'Recuperação ativa', isSpecial:true });
    return list;
  }

  // ── State ──────────────────────────────────────────────────────────
  let _built = false, _workout = null, _idx = 0, _phase = 'work', _timer = 0, _wkInt = null;

  function show() {
    const el = document.getElementById('view-workout');
    if (!el) return;
    if (!_built) { _built = true; renderConfig(el); }
  }

  // ── Config screen ──────────────────────────────────────────────────
  function renderConfig(el) {
    _workout = null; _idx = 0;
    clearInterval(_wkInt);
    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">💪 Treino em Casa</h1>
          <p class="page-subtitle">Sem equipamento, sem desculpas</p>
        </div>
        <div class="wk-cfg">
          <div class="wk-sec-lbl">Tipo de Treino</div>
          <div class="wk-type-grid">
            ${[
              {id:'strength',icon:'🏋️',name:'Força',       desc:'Fortalecimento muscular e resistência'},
              {id:'cardio',  icon:'🏃',name:'Cardio',       desc:'Alta intensidade e queima calórica'},
              {id:'core',    icon:'⚡',name:'Core',         desc:'Abdominais, lombar e equilíbrio'},
              {id:'mixed',   icon:'🔥',name:'Misto',        desc:'Combinação equilibrada de força e cardio'},
            ].map(t=>`
              <button class="wk-type-btn" data-type="${t.id}">
                <div class="wk-type-icon">${t.icon}</div>
                <div class="wk-type-name">${t.name}</div>
                <div class="wk-type-desc">${t.desc}</div>
              </button>`).join('')}
          </div>
          <div class="wk-sec-lbl">Duração</div>
          <div class="wk-dur-grid">
            ${[10,15,20,30,45,60].map(d=>`<button class="wk-dur-btn" data-dur="${d}">${d} min</button>`).join('')}
          </div>
          <button class="wk-start-btn" id="wk-go" disabled>▶ Começar Treino</button>
        </div>
      </div>`;

    let selType = null, selDur = null;
    function check() { el.querySelector('#wk-go').disabled = !(selType && selDur); }

    el.querySelectorAll('.wk-type-btn').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.wk-type-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); selType = b.dataset.type; check();
    }));
    el.querySelectorAll('.wk-dur-btn').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.wk-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); selDur = +b.dataset.dur; check();
    }));
    el.querySelector('#wk-go').addEventListener('click', () => {
      if (!selType || !selDur) return;
      _workout = buildWorkout(selType, selDur);
      _idx = 0; _phase = 'work'; _timer = _workout[0].work;
      renderPlayer(el);
    });
  }

  // ── Player ─────────────────────────────────────────────────────────
  function renderPlayer(el) {
    clearInterval(_wkInt);
    const ex = _workout[_idx];
    const total = _workout.length;
    const isRest = _phase === 'rest';
    const nextName = getNext();
    const figHTML = makeFig(ex.anim, isRest);
    const speed = isRest ? '1.8s' : ex.anim === 'plank' || ex.anim === 'sideplank' ? '2.5s' : '0.7s';

    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-player">
          <div class="wk-topbar">
            <div class="wk-prog-wrap">
              <div class="wk-prog-fill" style="width:${(_idx/total)*100}%"></div>
            </div>
            <div class="wk-prog-lbl">${_idx+1} / ${total}</div>
          </div>

          <div class="wk-phase-badge ${isRest?'wk-rest':'wk-work'}">${isRest?'😮‍💨 Descanso':'💪 Exercício'}</div>

          <div class="wk-fig-wrap" style="--wk-spd:${speed}">
            ${figHTML}
          </div>

          <div class="wk-ex-name">${isRest ? 'Descansa!' : ex.name}</div>
          <div class="wk-ex-desc">${isRest ? 'Recupera para o próximo exercício.' : ex.desc}</div>
          ${!isRest && ex.muscle ? `<div class="wk-muscle">🎯 ${ex.muscle}</div>` : ''}

          <div class="wk-timer-big" id="wk-timer">${_timer}</div>

          <div class="wk-next-row">
            <span class="wk-next-lbl">A seguir:</span>
            <span class="wk-next-name">${nextName}</span>
          </div>

          <div class="wk-controls">
            <button class="tool-btn tool-btn-sec" id="wk-skip">⏭ Saltar</button>
            <button class="tool-btn" style="background:#ef4444" id="wk-stop">✕ Parar</button>
          </div>
        </div>
      </div>`;

    el.querySelector('#wk-skip').addEventListener('click', () => advance(el));
    el.querySelector('#wk-stop').addEventListener('click', () => {
      clearInterval(_wkInt);
      _built = false;
      renderConfig(el);
    });

    _wkInt = setInterval(() => tickWk(el), 1000);
  }

  function getNext() {
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) return `Descanso (${ex.rest}s)`;
    const nex = _workout[_idx + 1];
    return nex ? nex.name : '🏁 Fim do treino!';
  }

  function tickWk(el) {
    _timer--;
    const t = el.querySelector('#wk-timer');
    if (t) t.textContent = _timer;
    if (_timer <= 0) advance(el);
  }

  function advance(el) {
    clearInterval(_wkInt);
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) {
      _phase = 'rest'; _timer = ex.rest; chime();
    } else {
      _idx++; _phase = 'work';
      if (_idx >= _workout.length) { renderDone(el); return; }
      _timer = _workout[_idx].work; gong();
    }
    renderPlayer(el);
  }

  function renderDone(el) {
    clearInterval(_wkInt);
    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-done-screen">
          <div class="wk-done-emoji">🎉</div>
          <div class="wk-done-title">Treino Concluído!</div>
          <div class="wk-done-sub">Excelente trabalho! Recupera bem e bebe água.</div>
          <button class="wk-start-btn" id="wk-again">↺ Novo Treino</button>
        </div>
      </div>`;
    done();
    el.querySelector('#wk-again').addEventListener('click', () => {
      _built = false;
      renderConfig(el);
    });
  }

  return { show };
})();
