/* ══════════════════════════════════════════════════════════════════
   WorkoutPage — "Treino em Casa", rebuilt around a real 3D mannequin.
   A single dependency-free articulated figure (WorkoutRig) is reused for
   every exercise; each exercise is a small keyframe clip. The section
   works like a modern training guide: pick a session OR browse the
   exercise library, where every exercise shows its starting position,
   correct execution (animated, orbitable, slow-mo), range of motion,
   target muscles (anatomical map), duration, difficulty and short cues.
   Fully offline, mobile-first, reduced-motion aware.
══════════════════════════════════════════════════════════════════ */
const WorkoutPage = (function () {
  'use strict';
  const PI = Math.PI;

  /* ── Audio cues ─────────────────────────────────────────────────── */
  function beep(freq, dur, vol = 0.3) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }
  function _audible() { return document.getElementById('view-workout')?.classList.contains('active'); }
  function chime() { if (!_audible()) return; beep(784, .15); setTimeout(() => beep(1047, .25), 170); }
  function gong() { if (!_audible()) return; beep(523, .3, .5); }
  function done() { if (!_audible()) return; beep(523, .12); setTimeout(() => beep(659, .12), 130); setTimeout(() => beep(784, .12), 260); setTimeout(() => beep(1047, .4), 390); }

  /* ══ Animation clips ═══════════════════════════════════════════════
     One mannequin, reusable keyframe clips. Angles in radians; missing
     joints fall back to the rest pose. Loop A→peak→A. */
  const CLIPS = {
    squat: { view: [PI / 2, 0.08], dur: 2.6, keys: [
      { t: 0, root: [0, 95, 0], j: {} },
      { t: 0.5, root: [0, 58, -7], j: { hipL: [-1.0, 0, 0], hipR: [-1.0, 0, 0], kneeL: [2.05, 0, 0], kneeR: [2.05, 0, 0], spine1: [0.13, 0, 0], spine2: [0.06, 0, 0], shoulderL: [-1.5, 0, 0], shoulderR: [-1.5, 0, 0], elbowL: [0.4, 0, 0], elbowR: [0.4, 0, 0], ankleL: [-0.5, 0, 0], ankleR: [-0.5, 0, 0] } },
      { t: 1, root: [0, 95, 0], j: {} },
    ] },

    pushup: { view: [PI / 2, 0.05], dur: 2.4, keys: [
      { t: 0, root: [0, 42, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.12, 0, 0], elbowR: [0.12, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 0.5, root: [0, 34, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.5, 0, 0], shoulderR: [-1.5, 0, 0], elbowL: [0.85, 0, 0], elbowR: [0.85, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 1, root: [0, 42, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.12, 0, 0], elbowR: [0.12, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
    ] },

    plank: { view: [PI / 2, 0.05], dur: 4, keys: [
      { t: 0, root: [0, 32, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.4, 0, 0], shoulderR: [-1.4, 0, 0], elbowL: [1.5, 0, 0], elbowR: [1.5, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 0.5, root: [0, 33, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.4, 0, 0], shoulderR: [-1.4, 0, 0], elbowL: [1.5, 0, 0], elbowR: [1.5, 0, 0], hipL: [0.03, 0, 0], hipR: [0.03, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 1, root: [0, 32, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.4, 0, 0], shoulderR: [-1.4, 0, 0], elbowL: [1.5, 0, 0], elbowR: [1.5, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
    ] },

    lunge: { view: [PI / 2, 0.05], dur: 3, keys: [
      { t: 0, root: [0, 95, 0], j: {} },
      { t: 0.25, root: [0, 70, 0], j: { hipR: [-0.85, 0, 0], kneeR: [1.5, 0, 0], hipL: [0.7, 0, 0], kneeL: [1.5, 0, 0], ankleL: [-0.7, 0, 0], ankleR: [-0.3, 0, 0], shoulderL: [-0.15, 0, 0], shoulderR: [-0.15, 0, 0] } },
      { t: 0.5, root: [0, 95, 0], j: {} },
      { t: 0.75, root: [0, 70, 0], j: { hipL: [-0.85, 0, 0], kneeL: [1.5, 0, 0], hipR: [0.7, 0, 0], kneeR: [1.5, 0, 0], ankleR: [-0.7, 0, 0], ankleL: [-0.3, 0, 0], shoulderL: [-0.15, 0, 0], shoulderR: [-0.15, 0, 0] } },
      { t: 1, root: [0, 95, 0], j: {} },
    ] },

    bridge: { view: [PI / 2, 0.05], dur: 2.6, keys: [
      { t: 0, root: [0, 20, 0], rootRot: [-1.5708, 0, 0], j: { hipL: [1.5, 0, 0], hipR: [1.5, 0, 0], kneeL: [1.6, 0, 0], kneeR: [1.6, 0, 0], ankleL: [0.8, 0, 0], ankleR: [0.8, 0, 0], shoulderL: [0.5, 0, 0], shoulderR: [0.5, 0, 0] } },
      { t: 0.5, root: [0, 34, 0], rootRot: [-1.12, 0, 0], j: { hipL: [1.35, 0, 0], hipR: [1.35, 0, 0], kneeL: [1.5, 0, 0], kneeR: [1.5, 0, 0], ankleL: [0.7, 0, 0], ankleR: [0.7, 0, 0], shoulderL: [0.5, 0, 0], shoulderR: [0.5, 0, 0] } },
      { t: 1, root: [0, 20, 0], rootRot: [-1.5708, 0, 0], j: { hipL: [1.5, 0, 0], hipR: [1.5, 0, 0], kneeL: [1.6, 0, 0], kneeR: [1.6, 0, 0], ankleL: [0.8, 0, 0], ankleR: [0.8, 0, 0], shoulderL: [0.5, 0, 0], shoulderR: [0.5, 0, 0] } },
    ] },

    jumpingjack: { view: [0, 0.05], dur: 0.95, keys: [
      { t: 0, root: [0, 92, 0], j: { shoulderL: [0, 0, -0.05], shoulderR: [0, 0, 0.05], hipL: [0, 0, 0.05], hipR: [0, 0, -0.05] } },
      { t: 0.5, root: [0, 99, 0], j: { shoulderL: [0, 0, -2.45], shoulderR: [0, 0, 2.45], hipL: [0, 0, 0.42], hipR: [0, 0, -0.42], elbowL: [0, 0, -0.1], elbowR: [0, 0, 0.1] } },
      { t: 1, root: [0, 92, 0], j: { shoulderL: [0, 0, -0.05], shoulderR: [0, 0, 0.05], hipL: [0, 0, 0.05], hipR: [0, 0, -0.05] } },
    ] },

    climber: { view: [0.7, 0.08], dur: 1.2, keys: [
      { t: 0, root: [0, 40, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 0.25, root: [0, 40, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0], hipR: [1.5, 0, 0], kneeR: [1.7, 0, 0], hipL: [0.05, 0, 0], ankleL: [0.9, 0, 0] } },
      { t: 0.5, root: [0, 40, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 0.75, root: [0, 40, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0], hipL: [1.5, 0, 0], kneeL: [1.7, 0, 0], hipR: [0.05, 0, 0], ankleR: [0.9, 0, 0] } },
      { t: 1, root: [0, 40, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [-1.57, 0, 0], shoulderR: [-1.57, 0, 0], elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0], hipL: [0.05, 0, 0], hipR: [0.05, 0, 0], ankleL: [0.9, 0, 0], ankleR: [0.9, 0, 0] } },
    ] },

    crunch: { view: [PI / 2, 0.05], dur: 2.4, keys: [
      { t: 0, root: [0, 22, 0], rootRot: [-1.5708, 0, 0], j: { hipL: [1.4, 0, 0], hipR: [1.4, 0, 0], kneeL: [1.6, 0, 0], kneeR: [1.6, 0, 0], shoulderL: [-0.8, 0, 0], shoulderR: [-0.8, 0, 0], elbowL: [1.8, 0, 0], elbowR: [1.8, 0, 0] } },
      { t: 0.5, root: [0, 22, 0], rootRot: [-1.5708, 0, 0], j: { hipL: [1.4, 0, 0], hipR: [1.4, 0, 0], kneeL: [1.6, 0, 0], kneeR: [1.6, 0, 0], spine1: [0.34, 0, 0], spine2: [0.28, 0, 0], chest: [0.16, 0, 0], neck: [0.12, 0, 0], shoulderL: [-0.8, 0, 0], shoulderR: [-0.8, 0, 0], elbowL: [1.8, 0, 0], elbowR: [1.8, 0, 0] } },
      { t: 1, root: [0, 22, 0], rootRot: [-1.5708, 0, 0], j: { hipL: [1.4, 0, 0], hipR: [1.4, 0, 0], kneeL: [1.6, 0, 0], kneeR: [1.6, 0, 0], shoulderL: [-0.8, 0, 0], shoulderR: [-0.8, 0, 0], elbowL: [1.8, 0, 0], elbowR: [1.8, 0, 0] } },
    ] },

    highknees: { view: [0.55, 0.06], dur: 0.75, keys: [
      { t: 0, root: [0, 93, 0], j: {} },
      { t: 0.25, root: [0, 93, 0], j: { hipR: [-1.6, 0, 0], kneeR: [1.7, 0, 0], shoulderL: [-1.0, 0, 0], elbowL: [1.2, 0, 0], shoulderR: [0.5, 0, 0], elbowR: [1.0, 0, 0] } },
      { t: 0.5, root: [0, 93, 0], j: {} },
      { t: 0.75, root: [0, 93, 0], j: { hipL: [-1.6, 0, 0], kneeL: [1.7, 0, 0], shoulderR: [-1.0, 0, 0], elbowR: [1.2, 0, 0], shoulderL: [0.5, 0, 0], elbowL: [1.0, 0, 0] } },
      { t: 1, root: [0, 93, 0], j: {} },
    ] },

    superman: { view: [PI / 2, 0.05], dur: 2.6, keys: [
      { t: 0, root: [0, 14, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [0.0, 0, 0], shoulderR: [0.0, 0, 0], hipL: [0.0, 0, 0], hipR: [0.0, 0, 0] } },
      { t: 0.5, root: [0, 16, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [0.5, 0, 0], shoulderR: [0.5, 0, 0], hipL: [-0.5, 0, 0], hipR: [-0.5, 0, 0], spine1: [-0.18, 0, 0], spine2: [-0.14, 0, 0], chest: [-0.1, 0, 0], neck: [-0.15, 0, 0] } },
      { t: 1, root: [0, 14, 0], rootRot: [PI / 2, 0, 0], j: { shoulderL: [0.0, 0, 0], shoulderR: [0.0, 0, 0], hipL: [0.0, 0, 0], hipR: [0.0, 0, 0] } },
    ] },

    /* gentle marching / breathing — warmup, rest & cooldown */
    march: { view: [0.5, 0.05], dur: 1.1, keys: [
      { t: 0, root: [0, 93, 0], j: { hipR: [-0.9, 0, 0], kneeR: [1.1, 0, 0], shoulderL: [-0.6, 0, 0], elbowL: [0.8, 0, 0] } },
      { t: 0.5, root: [0, 93, 0], j: { hipL: [-0.9, 0, 0], kneeL: [1.1, 0, 0], shoulderR: [-0.6, 0, 0], elbowR: [0.8, 0, 0] } },
      { t: 1, root: [0, 93, 0], j: { hipR: [-0.9, 0, 0], kneeR: [1.1, 0, 0], shoulderL: [-0.6, 0, 0], elbowL: [0.8, 0, 0] } },
    ] },
    breathe: { view: [0, 0.04], dur: 3.6, keys: [
      { t: 0, root: [0, 94, 0], j: {} },
      { t: 0.5, root: [0, 96, 0], j: { shoulderL: [0, 0, -1.2], shoulderR: [0, 0, 1.2], elbowL: [0, 0, -0.2], elbowR: [0, 0, 0.2] } },
      { t: 1, root: [0, 94, 0], j: {} },
    ] },
  };

  /* ── Exercise database (with educational fields) ───────────────────
     diff: 1 Iniciante · 2 Intermédio · 3 Avançado. cues/mistakes short.
     phases = range-of-motion breakdown. tempo = ecc-pause-conc seconds. */
  const E = {
    squat: { name: 'Agachamento', anim: 'squat', diff: 1, work: 40, rest: 20, reps: '12–15 reps', tempo: '2-1-2',
      muscle: 'Quadríceps · Glúteos · Core',
      start: 'De pé, pés à largura dos ombros, pontas ligeiramente para fora, peito aberto.',
      phases: ['Desce empurrando a anca para trás', 'Pausa com coxas ~paralelas', 'Sobe empurrando o chão'],
      cues: ['Mantém os calcanhares no chão', 'Joelhos alinhados com os pés', 'Peito direito, olhar em frente'],
      mistakes: ['Joelhos a colapsar para dentro', 'Levantar os calcanhares', 'Curvar a zona lombar'] },
    pushup: { name: 'Flexões', anim: 'pushup', diff: 2, work: 40, rest: 20, reps: '8–12 reps', tempo: '2-0-1',
      muscle: 'Peito · Tríceps · Ombros',
      start: 'Prancha alta, mãos um pouco mais largas que os ombros, corpo em linha reta.',
      phases: ['Desce o peito até quase tocar', 'Sobe estendendo os cotovelos'],
      cues: ['Cotovelos a ~45° do tronco', 'Abdómen e glúteos contraídos', 'Corpo numa linha reta'],
      mistakes: ['Anca a descair ou a subir', 'Cotovelos muito abertos', 'Amplitude curta'] },
    pike: { name: 'Pike Push-ups', anim: 'pushup', diff: 3, work: 35, rest: 20, reps: '6–10 reps', tempo: '2-0-1',
      muscle: 'Ombros · Tríceps',
      start: 'V invertido: ancas no ar, mãos e pés no chão, olhar para os pés.',
      phases: ['Dobra os cotovelos descendo a cabeça', 'Empurra de volta ao V'],
      cues: ['Ancas bem altas', 'Cabeça desce entre as mãos'],
      mistakes: ['Ancas baixas (vira flexão)', 'Cotovelos para fora'] },
    plank: { name: 'Prancha', anim: 'plank', diff: 1, work: 45, rest: 15, reps: 'Aguenta o tempo', tempo: 'Isométrico',
      muscle: 'Core · Ombros · Glúteos',
      start: 'Apoio nos antebraços e pontas dos pés, corpo numa linha reta.',
      phases: ['Mantém a posição sem oscilar'],
      cues: ['Contrai abdómen e glúteos', 'Anca alinhada com os ombros', 'Respira de forma constante'],
      mistakes: ['Anca demasiado alta ou baixa', 'Prender a respiração', 'Cabeça caída'] },
    lunge: { name: 'Afundos', anim: 'lunge', diff: 2, work: 40, rest: 20, reps: '10/perna', tempo: '2-1-1',
      muscle: 'Quadríceps · Glúteos',
      start: 'De pé, tronco direito, mãos na cintura. Dá um passo à frente.',
      phases: ['Desce dobrando os dois joelhos', 'Pausa com joelho traseiro perto do chão', 'Sobe e alterna a perna'],
      cues: ['Joelho da frente sobre o tornozelo', 'Tronco vertical', 'Desce a direito'],
      mistakes: ['Joelho da frente a passar o pé', 'Inclinar o tronco', 'Passo curto'] },
    bridge: { name: 'Ponte de Glúteos', anim: 'bridge', diff: 1, work: 40, rest: 15, reps: '15 reps', tempo: '1-2-1',
      muscle: 'Glúteos · Isquiotibiais · Core',
      start: 'Deitado de costas, joelhos dobrados, pés apoiados perto dos glúteos.',
      phases: ['Eleva a anca até alinhar joelhos-anca-ombros', 'Pausa e aperta os glúteos', 'Desce com controlo'],
      cues: ['Empurra pelos calcanhares', 'Aperta os glúteos no topo', 'Não arqueies a lombar'],
      mistakes: ['Subir demais (arquear lombar)', 'Empurrar pelas pontas dos pés'] },
    jumpingjack: { name: 'Jumping Jacks', anim: 'jumpingjack', diff: 1, work: 40, rest: 15, reps: 'Ritmo constante', tempo: 'Rápido',
      muscle: 'Todo o corpo · Cardio',
      start: 'De pé, pés juntos, braços ao lado do corpo.',
      phases: ['Salta abrindo pernas e braços', 'Salta fechando à posição inicial'],
      cues: ['Aterra suave com joelhos moles', 'Braços bem acima da cabeça', 'Mantém o ritmo'],
      mistakes: ['Aterrar com pernas rígidas', 'Amplitude curta dos braços'] },
    climber: { name: 'Mountain Climbers', anim: 'climber', diff: 2, work: 35, rest: 15, reps: 'Rápido', tempo: 'Rápido',
      muscle: 'Core · Ombros · Cardio',
      start: 'Prancha alta, mãos sob os ombros, corpo em linha.',
      phases: ['Leva um joelho ao peito', 'Alterna as pernas rapidamente'],
      cues: ['Ancas baixas e estáveis', 'Ombros sobre as mãos', 'Core sempre contraído'],
      mistakes: ['Anca a saltar para cima', 'Apoiar mal as mãos'] },
    crunch: { name: 'Abdominais', anim: 'crunch', diff: 1, work: 40, rest: 15, reps: '15–20 reps', tempo: '1-1-2',
      muscle: 'Reto abdominal',
      start: 'Deitado de costas, joelhos dobrados, mãos junto à cabeça.',
      phases: ['Enrola subindo os ombros do chão', 'Desce devagar com controlo'],
      cues: ['Sobe enrolando, não puxes o pescoço', 'Olha para o teto', 'Expira ao subir'],
      mistakes: ['Puxar a cabeça com as mãos', 'Usar impulso', 'Subir demasiado (sentar)'] },
    highknees: { name: 'Elevação de Joelhos', anim: 'highknees', diff: 1, work: 35, rest: 15, reps: 'Rápido', tempo: 'Rápido',
      muscle: 'Pernas · Core · Cardio',
      start: 'De pé, corre no lugar levantando os joelhos à altura da anca.',
      phases: ['Sobe um joelho à altura da anca', 'Alterna rapidamente'],
      cues: ['Joelhos bem alto', 'Apoia na ponta dos pés', 'Braços a acompanhar'],
      mistakes: ['Joelhos baixos', 'Inclinar o tronco para trás'] },
    superman: { name: 'Superman', anim: 'superman', diff: 1, work: 35, rest: 15, reps: '12 reps', tempo: '1-2-1',
      muscle: 'Eretores da Coluna · Glúteos',
      start: 'Deitado de barriga para baixo, braços estendidos à frente.',
      phases: ['Levanta braços e pernas em simultâneo', 'Segura 2 s', 'Desce com controlo'],
      cues: ['Olhar para o chão (pescoço neutro)', 'Aperta glúteos e costas', 'Movimento curto e controlado'],
      mistakes: ['Esticar demasiado o pescoço', 'Usar balanço'] },
  };

  /* category → exercise ids */
  const CATS = {
    strength: ['squat', 'pushup', 'lunge', 'plank', 'bridge', 'superman', 'pike'],
    cardio:   ['jumpingjack', 'highknees', 'climber', 'lunge', 'squat'],
    core:     ['plank', 'crunch', 'climber', 'bridge', 'superman'],
  };
  const ALL_IDS = Object.keys(E);

  /* ── Muscle-target anatomical map (kept — genuinely educational) ──── */
  function _muscleSet(str) {
    const s = (str || '').toLowerCase();
    const set = new Set();
    const has = (...w) => w.some(x => s.includes(x));
    const add = (...k) => k.forEach(x => set.add(x));
    if (has('todo o corpo', 'corpo completo', 'corpo inteiro', 'full body')) add('delts', 'chest', 'biceps', 'triceps', 'abs', 'obliques', 'lats', 'lowerback', 'glutes', 'quads', 'hamstrings', 'calves');
    if (has('peito')) add('chest');
    if (has('ombro', 'deltoid')) add('delts');
    if (has('tríceps', 'triceps')) add('triceps');
    if (has('bíceps', 'biceps')) add('biceps');
    if (has('antebra')) add('forearms');
    if (has('abdom', 'reto abdominal')) add('abs');
    if (has('core', 'estabil', 'equilíbrio', 'equilibrio')) add('abs', 'obliques');
    if (has('oblíqu', 'obliqu')) add('obliques');
    if (has('eretor', 'lombar', 'coluna')) add('lowerback');
    if (has('costas', 'dorsa', 'grande dorsal')) add('lats');
    if (has('trapéz', 'trapez')) add('traps');
    if (has('glúteo', 'gluteo')) add('glutes');
    if (has('isquiotibiais', 'posterior da coxa', 'femoral')) add('hamstrings');
    if (has('quadr')) add('quads');
    if (has('perna')) add('quads', 'glutes', 'hamstrings');
    if (has('panturr', 'gémeo', 'gemeo', 'barriga da perna')) add('calves');
    return set;
  }
  function muscleFig(muscleStr) {
    const on = _muscleSet(muscleStr);
    const BASE = '#283344', SKIN = '#2f3b4f', MI = '#3c4a66';
    const F = k => on.has(k) ? 'url(#wkTgt)' : MI;
    const CL = k => on.has(k) ? ' class="wk-mm-on"' : '';
    const cap = (x1, y1, x2, y2, w, fill = BASE) => {
      const dx = x2 - x1, dy = y2 - y1, l = Math.sqrt(dx * dx + dy * dy) || .1;
      const a = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
      return `<rect x="${x1.toFixed(1)}" y="${(y1 - w / 2).toFixed(1)}" width="${l.toFixed(1)}" height="${w}" rx="${(w / 2).toFixed(1)}" fill="${fill}" transform="rotate(${a},${x1.toFixed(1)},${y1.toFixed(1)})"/>`;
    };
    const elps = (cx, cy, rx, ry, fill, rot, k) =>
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${fill}"${rot ? ` transform="rotate(${rot},${cx.toFixed(1)},${cy.toFixed(1)})"` : ''}${k ? CL(k) : ''}/>`;
    function silhouette(cx) {
      return `<ellipse cx="${cx}" cy="14" rx="8.4" ry="9.8" fill="${SKIN}"/>` +
        `<rect x="${cx - 3.4}" y="21.5" width="6.8" height="7.5" rx="2.4" fill="${SKIN}"/>` +
        `<path d="M${cx - 14},35 Q${cx - 16.4},33 ${cx - 12.5},46 L${cx - 9},67 Q${cx - 10.6},79 ${cx - 11},87 L${cx + 11},87 Q${cx + 10.6},79 ${cx + 9},67 L${cx + 12.5},46 Q${cx + 16.4},33 ${cx + 14},35 Q${cx},29.5 ${cx - 14},35 Z" fill="${BASE}"/>` +
        cap(cx - 12.5, 36, cx - 18, 63, 8) + cap(cx + 12.5, 36, cx + 18, 63, 8) +
        cap(cx - 18, 63, cx - 19.5, 90, 6.4) + cap(cx + 18, 63, cx + 19.5, 90, 6.4) +
        `<ellipse cx="${cx - 19.8}" cy="92.5" rx="3.2" ry="3.6" fill="${SKIN}"/><ellipse cx="${cx + 19.8}" cy="92.5" rx="3.2" ry="3.6" fill="${SKIN}"/>` +
        cap(cx - 6, 86, cx - 7, 131, 12) + cap(cx + 6, 86, cx + 7, 131, 12) +
        cap(cx - 7, 131, cx - 8, 179, 9) + cap(cx + 7, 131, cx + 8, 179, 9) +
        `<ellipse cx="${cx - 9}" cy="183" rx="4.2" ry="3.4" fill="${SKIN}"/><ellipse cx="${cx + 9}" cy="183" rx="4.2" ry="3.4" fill="${SKIN}"/>`;
    }
    function frontM(cx) {
      return elps(cx - 11.5, 38, 4.4, 4.2, F('delts'), 0, 'delts') + elps(cx + 11.5, 38, 4.4, 4.2, F('delts'), 0, 'delts') +
        `<path d="M${cx - .8},42 Q${cx - 9.5},41 ${cx - 9},50.5 Q${cx - 5},54.5 ${cx - .8},52.5 Z" fill="${F('chest')}"${CL('chest')}/>` +
        `<path d="M${cx + .8},42 Q${cx + 9.5},41 ${cx + 9},50.5 Q${cx + 5},54.5 ${cx + .8},52.5 Z" fill="${F('chest')}"${CL('chest')}/>` +
        elps(cx - 15.2, 49, 2.8, 5.6, F('biceps'), 14, 'biceps') + elps(cx + 15.2, 49, 2.8, 5.6, F('biceps'), -14, 'biceps') +
        elps(cx - 18.9, 77, 2.4, 5, F('forearms'), 6, 'forearms') + elps(cx + 18.9, 77, 2.4, 5, F('forearms'), -6, 'forearms') +
        `<rect x="${cx - 5}" y="55" width="10" height="23" rx="3.2" fill="${F('abs')}"${CL('abs')}/>` +
        elps(cx - 8.6, 63, 2.6, 6, F('obliques'), 0, 'obliques') + elps(cx + 8.6, 63, 2.6, 6, F('obliques'), 0, 'obliques') +
        elps(cx - 6, 104, 4.2, 15, F('quads'), 2, 'quads') + elps(cx + 6, 104, 4.2, 15, F('quads'), -2, 'quads');
    }
    function backM(cx) {
      return `<path d="M${cx - 13},35.5 L${cx + 13},35.5 L${cx + 5},52 L${cx - 5},52 Z" fill="${F('traps')}"${CL('traps')}/>` +
        `<path d="M${cx - 9.5},52 L${cx - 2.5},53 L${cx - 3.5},68 L${cx - 9},64 Z" fill="${F('lats')}"${CL('lats')}/>` +
        `<path d="M${cx + 9.5},52 L${cx + 2.5},53 L${cx + 3.5},68 L${cx + 9},64 Z" fill="${F('lats')}"${CL('lats')}/>` +
        `<rect x="${cx - 4}" y="68" width="8" height="13" rx="2.6" fill="${F('lowerback')}"${CL('lowerback')}/>` +
        elps(cx - 15.2, 50, 2.8, 5.6, F('triceps'), 14, 'triceps') + elps(cx + 15.2, 50, 2.8, 5.6, F('triceps'), -14, 'triceps') +
        elps(cx - 5.5, 90, 5, 5.2, F('glutes'), 0, 'glutes') + elps(cx + 5.5, 90, 5, 5.2, F('glutes'), 0, 'glutes') +
        elps(cx - 6.6, 112, 4, 14, F('hamstrings'), 2, 'hamstrings') + elps(cx + 6.6, 112, 4, 14, F('hamstrings'), -2, 'hamstrings') +
        elps(cx - 8, 156, 3.2, 8, F('calves'), 3, 'calves') + elps(cx + 8, 156, 3.2, 8, F('calves'), -3, 'calves');
    }
    return `<svg class="wk-mm-svg" viewBox="0 0 150 212" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="wkTgt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff9a52"/><stop offset="55%" stop-color="#ff4d3d"/><stop offset="100%" stop-color="#ff1e54"/></linearGradient></defs>` +
      `<g>${silhouette(40)}${frontM(40)}</g><g>${silhouette(110)}${backM(110)}</g>` +
      `<text x="40" y="208" text-anchor="middle" class="wk-mm-cap">Frente</text>` +
      `<text x="110" y="208" text-anchor="middle" class="wk-mm-cap">Costas</text></svg>`;
  }

  const DIFF_LBL = { 1: '🟢 Iniciante', 2: '🟡 Intermédio', 3: '🔴 Avançado' };

  /* ── workout builder ───────────────────────────────────────────── */
  function buildWorkout(type, totalMin) {
    const totalSec = totalMin * 60;
    let pool = (type === 'mixed' ? ALL_IDS.slice() : (CATS[type] || CATS.strength).slice()).sort(() => Math.random() - .5);
    const list = [{ id: '_warmup', name: 'Aquecimento', anim: 'march', work: 60, rest: 0, special: 1,
      start: 'Marcha no lugar com rotações articulares e mobilidade.', muscle: 'Aquecimento geral',
      cues: ['Aumenta o ritmo gradualmente', 'Move ombros, ancas e tornozelos'], phases: ['Eleva a temperatura e mobiliza'] }];
    let elapsed = 60, i = 0;
    while (elapsed < totalSec - 60) {
      const ex = E[pool[i % pool.length]];
      list.push(Object.assign({ id: pool[i % pool.length] }, ex, { special: 0 }));
      elapsed += ex.work + ex.rest; i++;
      if (i > pool.length * 4) break;
    }
    list.push({ id: '_cooldown', name: 'Relaxamento', anim: 'breathe', work: 60, rest: 0, special: 1,
      start: 'Respiração profunda e alongamentos suaves.', muscle: 'Recuperação ativa',
      cues: ['Inspira pelo nariz, expira pela boca', 'Alonga os grupos trabalhados'], phases: ['Baixa o ritmo cardíaco'] });
    return list;
  }

  /* ── State ──────────────────────────────────────────────────────── */
  let _built = false, _workout = null, _idx = 0, _phase = 'work', _timer = 0, _wkInt = null;
  let _rig = null, _paused = false, _slow = false;

  function disposeRig() { if (_rig) { try { _rig.dispose(); } catch (e) {} _rig = null; } }

  function show() {
    const el = document.getElementById('view-workout');
    if (!el) return;
    if (!_built) { _built = true; renderConfig(el); }
  }

  /* mount a rig on a canvas inside `el` (id) for the given exercise */
  function mountRig(canvasId, ex, opts) {
    disposeRig();
    const cv = document.getElementById(canvasId);
    if (!cv || typeof WorkoutRig === 'undefined') return null;
    _rig = WorkoutRig.create(cv, { color: { lo: '#7c8aa6', hi: '#f3f7ff', joint: '#5b6b88', skin: '#eab98f' } });
    const clip = CLIPS[ex.anim] || CLIPS.breathe;
    _rig.setClip(clip);
    if (opts && opts.orbit) _rig.orbitFrom(cv);
    if (_rig.isReduced()) { _rig.pause(); _rig.setPhase(0.5); }
    return _rig;
  }

  /* ════ Config screen ═══════════════════════════════════════════ */
  function renderConfig(el) {
    _workout = null; _idx = 0; clearInterval(_wkInt); disposeRig();
    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">💪 Treino em Casa</h1>
          <p class="page-subtitle">Sem equipamento · guia 3D de cada exercício</p>
        </div>
        <div class="wk-cfg">
          <div class="wk-sec-lbl">Tipo de Treino</div>
          <div class="wk-type-grid">
            ${[
              { id: 'strength', icon: '🏋️', name: 'Força', desc: 'Fortalecimento muscular e resistência' },
              { id: 'cardio', icon: '🏃', name: 'Cardio', desc: 'Alta intensidade e queima calórica' },
              { id: 'core', icon: '⚡', name: 'Core', desc: 'Abdominais, lombar e equilíbrio' },
              { id: 'mixed', icon: '🔥', name: 'Misto', desc: 'Combinação equilibrada' },
            ].map(t => `
              <button class="wk-type-btn" data-type="${t.id}">
                <img class="wk-type-img" src="assets/workout/${t.id}.jpg" alt="" loading="lazy" onerror="this.remove()">
                <div class="wk-type-icon">${t.icon}</div>
                <div class="wk-type-name">${t.name}</div>
                <div class="wk-type-desc">${t.desc}</div>
              </button>`).join('')}
          </div>
          <div class="wk-sec-lbl">Duração</div>
          <div class="wk-dur-grid">
            ${[10, 15, 20, 30, 45, 60].map(d => `<button class="wk-dur-btn" data-dur="${d}">${d} min</button>`).join('')}
          </div>
          <button class="wk-start-btn" id="wk-go" disabled>▶ Começar Treino</button>
          <button class="wk-lib-link" id="wk-lib">📚 Explorar biblioteca de exercícios</button>
        </div>
      </div>`;

    let selType = null, selDur = null;
    const check = () => { el.querySelector('#wk-go').disabled = !(selType && selDur); };
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
      _idx = 0; _phase = 'work'; _timer = _workout[0].work; _paused = false;
      renderPlayer(el);
    });
    el.querySelector('#wk-lib').addEventListener('click', () => renderLibrary(el));
  }

  /* ════ Exercise library ════════════════════════════════════════ */
  function renderLibrary(el) {
    clearInterval(_wkInt); disposeRig();
    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-detail-bar">
          <button class="wk-back" id="wk-back">← Voltar</button>
          <h1 class="page-title" style="margin:0;font-size:1.3rem">📚 Biblioteca de Exercícios</h1>
        </div>
        <div class="wk-lib-grid">
          ${ALL_IDS.map(id => {
            const ex = E[id];
            return `<button class="wk-lib-card" data-id="${id}">
              <div class="wk-lib-thumb" data-anim="${ex.anim}"><canvas id="thumb-${id}"></canvas></div>
              <div class="wk-lib-name">${ex.name}</div>
              <div class="wk-lib-meta">${DIFF_LBL[ex.diff]} · ${ex.muscle.split(' · ')[0]}</div>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    el.querySelector('#wk-back').addEventListener('click', () => renderConfig(el));
    el.querySelectorAll('.wk-lib-card').forEach(c => c.addEventListener('click', () => renderDetail(el, c.dataset.id)));
    /* render a small static figure on each thumbnail (one shared rig would
       conflict; draw each once and dispose) */
    if (typeof WorkoutRig !== 'undefined') {
      ALL_IDS.forEach(id => {
        const cv = document.getElementById('thumb-' + id);
        if (!cv) return;
        const r = WorkoutRig.create(cv, {});
        r.setClip(CLIPS[E[id].anim] || CLIPS.breathe); r.pause(); r.setPhase(0.5);
        setTimeout(() => { r.setPhase(0.5); r.dispose(); }, 80);
      });
    }
  }

  /* ════ Exercise detail (full educational card) ═════════════════ */
  function renderDetail(el, id) {
    clearInterval(_wkInt); disposeRig();
    const ex = E[id];
    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-detail-bar">
          <button class="wk-back" id="wk-back">← Biblioteca</button>
          <h1 class="page-title" style="margin:0;font-size:1.3rem">${ex.name}</h1>
        </div>
        <div class="wk-detail">
          <div class="wk-detail-fig">
            <div class="wk-fig-stage"><canvas id="wk-canvas"></canvas>
              <div class="wk-fig-hint">↺ arrasta para rodar</div>
            </div>
            <div class="wk-fig-ctrls">
              <button class="wk-fc" id="wk-pp" aria-label="Pausa/play">⏸</button>
              <button class="wk-fc" id="wk-slow" aria-label="Câmara lenta">🐢</button>
              <button class="wk-fc" id="wk-startpose" aria-label="Posição inicial">⏮ início</button>
              <input class="wk-scrub" id="wk-scrub" type="range" min="0" max="1000" value="0" aria-label="Amplitude do movimento">
            </div>
          </div>
          <div class="wk-detail-info">
            <div class="wk-badges">
              <span class="wk-badge">${DIFF_LBL[ex.diff]}</span>
              <span class="wk-badge">⏱ ${ex.work}s · ${ex.reps}</span>
              <span class="wk-badge">🎚 Tempo ${ex.tempo}</span>
            </div>
            <div class="wk-info-block"><div class="wk-info-h">▶ Posição inicial</div><p>${ex.start}</p></div>
            <div class="wk-info-block"><div class="wk-info-h">🔁 Amplitude de movimento</div>
              <ol class="wk-rom">${ex.phases.map(p => `<li>${p}</li>`).join('')}</ol></div>
            <div class="wk-info-block"><div class="wk-info-h">✅ Instruções</div>
              <ul class="wk-cues">${ex.cues.map(c => `<li>${c}</li>`).join('')}</ul></div>
            <div class="wk-info-block"><div class="wk-info-h">⚠️ Erros comuns</div>
              <ul class="wk-mistakes">${ex.mistakes.map(c => `<li>${c}</li>`).join('')}</ul></div>
            <div class="wk-info-block"><div class="wk-info-h">🎯 Músculos principais — ${ex.muscle}</div>
              <div class="wk-mm-wrap">${muscleFig(ex.muscle)}</div></div>
          </div>
        </div>
      </div>`;
    el.querySelector('#wk-back').addEventListener('click', () => renderLibrary(el));
    const rig = mountRig('wk-canvas', ex, { orbit: true });
    const scrub = el.querySelector('#wk-scrub');
    const pp = el.querySelector('#wk-pp');
    let playing = !(rig && rig.isReduced());
    if (rig) rig.onPhase(p => { if (playing) scrub.value = Math.round(p * 1000); });
    pp.textContent = playing ? '⏸' : '▶';
    pp.addEventListener('click', () => { playing = !playing; if (rig) rig.setPlaying(playing); pp.textContent = playing ? '⏸' : '▶'; });
    el.querySelector('#wk-slow').addEventListener('click', e => {
      _slow = !_slow; if (rig) rig.setSpeed(_slow ? 0.35 : 1); e.currentTarget.classList.toggle('on', _slow);
    });
    el.querySelector('#wk-startpose').addEventListener('click', () => { if (rig) { playing = false; rig.setPlaying(false); rig.setPhase(0); scrub.value = 0; pp.textContent = '▶'; } });
    scrub.addEventListener('input', () => { playing = false; if (rig) { rig.setPlaying(false); rig.setPhase(+scrub.value / 1000); } pp.textContent = '▶'; });
  }

  /* ════ Session player ══════════════════════════════════════════ */
  function renderPlayer(el) {
    clearInterval(_wkInt); disposeRig();
    const ex = _workout[_idx];
    const total = _workout.length;
    const isRest = _phase === 'rest';
    const nextName = getNext();

    el.innerHTML = `
      <div class="view-inner">
        <div class="wk-player">
          <div class="wk-topbar">
            <div class="wk-prog-wrap"><div class="wk-prog-fill" style="width:${(_idx / total) * 100}%"></div></div>
            <div class="wk-prog-lbl">${_idx + 1} / ${total}</div>
          </div>
          <div class="wk-phase-badge ${isRest ? 'wk-rest' : 'wk-work'}">${isRest ? '😮‍💨 Descanso' : '💪 Exercício'}</div>

          <div class="wk-fig-stage player"><canvas id="wk-canvas"></canvas></div>

          <div class="wk-ex-name">${isRest ? 'Descansa!' : ex.name}</div>
          <div class="wk-ex-desc">${isRest ? 'Recupera para: ' + nextName : ex.start}</div>
          ${!isRest ? `<div class="wk-cue-row">${(ex.cues || []).slice(0, 2).map(c => `<span class="wk-cue-chip">${c}</span>`).join('')}</div>` : ''}
          ${!isRest && ex.muscle ? `<div class="wk-muscle">🎯 ${ex.muscle}</div>` : ''}

          <div class="wk-timer-big" id="wk-timer">${_timer}</div>

          <div class="wk-next-row"><span class="wk-next-lbl">A seguir:</span><span class="wk-next-name">${nextName}</span></div>

          <div class="wk-controls">
            <button class="tool-btn tool-btn-sec" id="wk-pause">${_paused ? '▶ Retomar' : '⏸ Pausa'}</button>
            <button class="tool-btn tool-btn-sec" id="wk-skip">⏭ Saltar</button>
            <button class="tool-btn" style="background:#ef4444" id="wk-stop">✕ Parar</button>
          </div>
        </div>
      </div>`;

    const rig = mountRig('wk-canvas', isRest ? { anim: 'breathe' } : ex, { orbit: true });
    if (rig && !isRest) rig.setSpeed(1);
    if (_paused && rig) rig.pause();

    el.querySelector('#wk-pause').addEventListener('click', e => {
      _paused = !_paused;
      if (_paused) { clearInterval(_wkInt); if (rig) rig.pause(); }
      else { _wkInt = setInterval(() => tickWk(el), 1000); if (rig) rig.play(); }
      e.currentTarget.textContent = _paused ? '▶ Retomar' : '⏸ Pausa';
    });
    el.querySelector('#wk-skip').addEventListener('click', () => advance(el));
    el.querySelector('#wk-stop').addEventListener('click', () => { clearInterval(_wkInt); disposeRig(); _built = false; renderConfig(el); });

    if (!_paused) _wkInt = setInterval(() => tickWk(el), 1000);
  }

  function getNext() {
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) return `Descanso (${ex.rest}s)`;
    const nex = _workout[_idx + 1];
    return nex ? nex.name : '🏁 Fim do treino!';
  }
  function tickWk(el) {
    if (_paused) return;
    _timer--;
    const t = el.querySelector('#wk-timer');
    if (t) { t.textContent = _timer; if (_timer <= 3 && _timer > 0) { t.classList.add('wk-tick'); beep(880, .08, .15); } }
    if (_timer <= 0) advance(el);
  }
  function advance(el) {
    clearInterval(_wkInt);
    const ex = _workout[_idx];
    if (_phase === 'work' && ex.rest > 0) { _phase = 'rest'; _timer = ex.rest; chime(); }
    else {
      _idx++; _phase = 'work';
      if (_idx >= _workout.length) { renderDone(el); return; }
      _timer = _workout[_idx].work; gong();
    }
    renderPlayer(el);
  }

  function renderDone(el) {
    clearInterval(_wkInt); disposeRig();
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
    el.querySelector('#wk-again').addEventListener('click', () => { _built = false; renderConfig(el); });
  }

  return { show };
})();
