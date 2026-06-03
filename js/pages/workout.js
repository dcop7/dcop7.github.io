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
  /* Don't play cues if the user has navigated away from the workout mid-session. */
  function _audible() { return document.getElementById('view-workout')?.classList.contains('active'); }
  function chime() { if (!_audible()) return; beep(784,.15); setTimeout(()=>beep(1047,.25),170); }
  function gong()  { if (!_audible()) return; beep(523,.3,.5); }
  function done()  { if (!_audible()) return; beep(523,.12); setTimeout(()=>beep(659,.12),130); setTimeout(()=>beep(784,.12),260); setTimeout(()=>beep(1047,.4),390); }

  // ── 3D SVG Figures ─────────────────────────────────────────────────
  // viewBox="0 0 80 120" — 3/4 front-right view for standing, side view for floor
  // Back (left) limbs use g3d (dark), front (right) limbs use g3b (bright)
  const D = '<defs>' +
    // Skin (head) — soft sheen
    '<radialGradient id="g3h" cx="37%" cy="30%" r="70%">' +
      '<stop offset="0%" stop-color="#ffe9d2"/>' +
      '<stop offset="48%" stop-color="#f1b487"/>' +
      '<stop offset="100%" stop-color="#b56a3b"/>' +
    '</radialGradient>' +
    // Front (near) limbs — glossy blue with a bright specular edge
    '<linearGradient id="g3b" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#eaf3ff"/>' +
      '<stop offset="20%" stop-color="#8cc0fd"/>' +
      '<stop offset="55%" stop-color="#3b82f6"/>' +
      '<stop offset="100%" stop-color="#1b46c4"/>' +
    '</linearGradient>' +
    // Back (far) limbs — darker, so depth reads clearly
    '<linearGradient id="g3d" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#6f9fe0"/>' +
      '<stop offset="60%" stop-color="#2f5fbf"/>' +
      '<stop offset="100%" stop-color="#153584"/>' +
    '</linearGradient>' +
    // Joints / hands / feet
    '<radialGradient id="g3j" cx="35%" cy="32%" r="68%">' +
      '<stop offset="0%" stop-color="#f0f6ff"/>' +
      '<stop offset="55%" stop-color="#6aa5f8"/>' +
      '<stop offset="100%" stop-color="#214fbe"/>' +
    '</radialGradient>' +
    // Soft unified drop shadow → makes the figure read as one solid 3D body
    '<filter id="g3sh" x="-40%" y="-30%" width="180%" height="170%">' +
      '<feDropShadow dx="0.5" dy="1.1" stdDeviation="1.3" flood-color="#0a1230" flood-opacity="0.5"/>' +
    '</filter>' +
  '</defs>';

  function fig(id, frames) {
    const [f1, f2] = frames;
    return `<div class="wk-fig-svg-wrap">` +
      `<svg class="wk-fig-a" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">${D}<g filter="url(#g3sh)">${f1}</g></svg>` +
      `<svg class="wk-fig-b" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">${D}<g filter="url(#g3sh)">${f2}</g></svg>` +
    `</div>`;
  }

  // 3D primitives
  const h3 = (cx, cy, r=8) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g3h)" stroke="rgba(110,55,22,.4)" stroke-width="0.7"/>`;

  // Cylindrical segment — rotated rounded rect from (x1,y1) to (x2,y2), width w.
  // d=true uses the darker gradient (back/far limbs). A thin dark outline keeps
  // overlapping limbs cleanly separated; rounded caps read as muscle.
  function s3(x1, y1, x2, y2, w=6, d=false) {
    const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
    const ang=(Math.atan2(dy,dx)*180/Math.PI).toFixed(1);
    const f = d ? 'url(#g3d)' : 'url(#g3b)';
    return `<rect x="${(+x1).toFixed(1)}" y="${(y1-w/2).toFixed(1)}" width="${len.toFixed(1)}" height="${w}" rx="${(w/2).toFixed(1)}" fill="${f}" stroke="rgba(8,16,42,.42)" stroke-width="0.7" transform="rotate(${ang},${(+x1).toFixed(1)},${(+y1).toFixed(1)})"/>`;
  }

  // Joint / hand / foot sphere (slightly larger so limbs connect smoothly)
  const j3 = (cx, cy, r=4) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g3j)"/>`;

  // Soft contact shadow on the ground (replaces the old flat line)
  const gn = (y=112) =>
    `<ellipse cx="40" cy="${(+y+1).toFixed(1)}" rx="24" ry="3" fill="rgba(0,0,0,.28)"/>`;

  // ── Figure library ─────────────────────────────────────────────────
  const FIGS = {

    // SQUAT
    squat: fig('squat',[
      // Standing — arms relaxed at sides
      gn(112)+
      s3(38,56,28,82,8,1)+s3(28,82,26,108,7,1)+   // L leg (back)
      s3(30,27,20,47,6,1)+s3(20,47,18,65,5,1)+    // L arm (back)
      s3(40,20,40,56,12)+                          // torso
      s3(42,56,52,82,8)+s3(52,82,54,108,7)+        // R leg (front)
      s3(50,27,62,47,6)+s3(62,47,64,65,5)+         // R arm (front)
      j3(30,27)+j3(50,27)+j3(40,56)+j3(20,47)+j3(62,47)+j3(28,82)+j3(52,82)+
      h3(40,12),
      // Deep squat — thighs parallel, arms forward for balance
      gn(108)+
      s3(40,53,22,73,8,1)+s3(22,73,30,98,7,1)+    // L leg squat
      s3(36,34,16,26,6,1)+                         // L arm out
      s3(40,27,40,53,11)+                          // torso
      s3(40,53,58,73,8)+s3(58,73,50,98,7)+         // R leg squat
      s3(44,34,64,26,6)+                           // R arm out
      j3(40,34)+j3(40,53)+j3(22,73)+j3(58,73)+j3(16,26)+j3(64,26)+
      h3(40,19),
    ]),

    // PUSH-UP
    pushup: fig('pushup',[
      // Up position — arms straight
      gn(66)+
      s3(26,38,24,62,7,1)+                         // L arm (back)
      s3(14,34,66,40,10)+                          // body horizontal
      s3(42,38,44,62,7)+                           // R arm (front)
      s3(58,40,70,58,6)+                           // lower body / feet
      j3(26,38)+j3(42,38)+j3(58,40)+
      h3(13,26,8),
      // Down — chest near floor
      gn(70)+
      s3(26,46,22,66,7,1)+
      s3(14,42,66,48,10)+
      s3(42,46,46,66,7)+
      s3(58,48,70,64,6)+
      j3(26,46)+j3(42,46)+j3(58,48)+
      h3(13,36,8),
    ]),

    // PLANK
    plank: fig('plank',[
      // Forearm plank — body straight
      gn(66)+
      s3(24,40,20,62,7,1)+                         // L forearm (back)
      s3(12,38,62,42,10)+                          // body
      s3(40,40,44,62,7)+                           // R forearm (front)
      s3(58,42,68,60,6)+                           // feet
      j3(24,40)+j3(40,40)+j3(58,42)+
      h3(12,30,8),
      // Slight hip dip
      gn(66)+
      s3(24,40,20,62,7,1)+
      s3(12,38,62,46,10)+
      s3(40,40,44,62,7)+
      s3(60,46,70,62,6)+
      j3(24,40)+j3(40,40)+j3(60,46)+
      h3(12,30,8),
    ]),

    // LUNGE
    lunge: fig('lunge',[
      // Right leg forward lunge
      gn(112)+
      s3(38,56,54,80,8,1)+s3(54,80,58,108,7,1)+   // L leg back (far)
      s3(30,27,20,47,6,1)+s3(20,47,18,65,5,1)+    // L arm (back)
      s3(40,20,40,56,12)+
      s3(42,56,28,78,8)+s3(28,78,24,108,7)+        // R leg forward (near)
      s3(50,27,62,47,6)+s3(62,47,64,65,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(54,80)+j3(28,78)+
      h3(40,12),
      // Left leg forward lunge
      gn(112)+
      s3(42,56,28,80,8,1)+s3(28,80,24,108,7,1)+   // R leg back (far)
      s3(50,27,62,47,6,1)+s3(62,47,64,65,5,1)+    // R arm (back)
      s3(40,20,40,56,12)+
      s3(38,56,52,78,8)+s3(52,78,56,108,7)+        // L leg forward
      s3(30,27,20,47,6)+s3(20,47,18,65,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,80)+j3(52,78)+
      h3(40,12),
    ]),

    // BRIDGE (glute bridge)
    bridge: fig('bridge',[
      // Hips down — lying supine, knees bent
      gn(110)+
      s3(38,97,60,76,10)+                          // torso on floor
      s3(60,76,72,52,8)+                           // thighs up
      s3(72,52,70,28,7)+                           // shins vertical
      s3(38,97,18,100,6)+s3(18,100,14,76,5)+       // arms on floor
      j3(38,97)+j3(60,76)+j3(72,52)+j3(18,100)+
      h3(38,106,8),
      // Hips raised — full bridge
      gn(110)+
      s3(40,102,66,72,10)+
      s3(66,72,64,44,8)+
      s3(64,44,62,20,7)+
      s3(40,102,18,104,6)+s3(18,104,12,80,5)+
      j3(40,102)+j3(66,72)+j3(64,44)+j3(18,104)+
      h3(40,110,8),
    ]),

    // SUPERMAN
    superman: fig('superman',[
      // Lying prone, slight raise
      s3(14,42,58,46,9)+                           // torso
      s3(14,42,2,24,5,1)+                          // L arm forward (back)
      s3(22,38,4,20,5)+                            // R arm forward (front)
      s3(58,46,62,68,7,1)+s3(62,68,66,88,6,1)+    // L leg back
      s3(58,46,68,62,7)+s3(68,62,72,82,6)+         // R leg back (slightly higher)
      j3(14,42)+j3(58,46)+j3(2,24)+j3(62,68)+j3(68,62)+
      h3(10,34,8),
      // Full extension
      s3(14,40,58,44,9)+
      s3(14,40,0,20,5,1)+
      s3(22,36,2,16,5)+
      s3(58,44,62,66,7,1)+s3(62,66,66,86,6,1)+
      s3(58,44,70,58,7)+s3(70,58,74,78,6)+
      j3(14,40)+j3(58,44)+j3(0,20)+j3(62,66)+j3(70,58)+
      h3(10,32,8),
    ]),

    // DIP
    dip: fig('dip',[
      // Arms extended — top of dip
      gn(112)+
      s3(38,56,20,42,7,1)+s3(20,42,16,64,6,1)+    // L arm on chair (back)
      s3(40,20,40,56,12)+
      s3(42,56,60,42,7)+s3(60,42,64,64,6)+         // R arm on chair (front)
      s3(38,56,30,82,8,1)+s3(30,82,28,108,7,1)+   // L leg
      s3(42,56,50,82,8)+s3(50,82,52,108,7)+        // R leg
      j3(30,27)+j3(50,27)+j3(40,56)+j3(20,42)+j3(60,42)+j3(30,82)+j3(50,82)+
      h3(40,12),
      // Arms bent — bottom of dip (body lower)
      gn(112)+
      s3(42,62,20,42,7,1)+s3(20,42,16,64,6,1)+
      s3(40,28,40,62,12)+
      s3(38,62,60,42,7)+s3(60,42,64,64,6)+
      s3(40,62,32,88,8,1)+s3(32,88,30,110,7,1)+
      s3(40,62,48,88,8)+s3(48,88,50,110,7)+
      j3(40,42)+j3(40,62)+j3(20,42)+j3(60,42)+j3(32,88)+j3(48,88)+
      h3(40,20),
    ]),

    // JUMPING JACK
    jumpjack: fig('jumpjack',[
      // Together
      gn(112)+
      s3(38,56,32,82,8,1)+s3(32,82,30,108,7,1)+
      s3(30,27,24,48,6,1)+s3(24,48,22,66,5,1)+
      s3(40,20,40,56,12)+
      s3(42,56,48,82,8)+s3(48,82,50,108,7)+
      s3(50,27,56,48,6)+s3(56,48,58,66,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(24,48)+j3(56,48)+j3(32,82)+j3(48,82)+
      h3(40,12),
      // Wide — arms/legs spread, slightly airborne
      gn(112)+
      s3(38,56,22,80,8,1)+s3(22,80,16,106,7,1)+
      s3(30,27,14,18,6,1)+                         // L arm wide up
      s3(40,18,40,56,12)+
      s3(42,56,58,80,8)+s3(58,80,64,106,7)+
      s3(50,27,66,18,6)+                           // R arm wide up
      j3(30,27)+j3(50,27)+j3(40,56)+j3(22,80)+j3(58,80)+j3(14,18)+j3(66,18)+
      h3(40,10),
    ]),

    // HIGH KNEES
    highknees: fig('highknees',[
      // Left knee raised, right arm forward
      gn(112)+
      s3(38,56,28,74,8,1)+s3(28,74,26,58,7,1)+    // L knee raised (back leg)
      s3(30,27,18,46,6,1)+                         // L arm back
      s3(40,20,40,56,12)+
      s3(42,56,52,80,8)+s3(52,80,54,108,7)+        // R leg on ground
      s3(50,27,64,44,6)+                           // R arm forward
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,74)+j3(52,80)+j3(18,46)+j3(64,44)+
      h3(40,12),
      // Right knee raised, left arm forward
      gn(112)+
      s3(38,56,28,80,8,1)+s3(28,80,26,108,7,1)+   // L leg on ground
      s3(30,27,16,44,6,1)+                         // L arm forward
      s3(40,20,40,56,12)+
      s3(42,56,52,74,8)+s3(52,74,50,58,7)+         // R knee raised
      s3(50,27,62,46,6)+                           // R arm back
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,80)+j3(52,74)+j3(16,44)+j3(62,46)+
      h3(40,12),
    ]),

    // BURPEE
    burpee: fig('burpee',[
      // Jump — arms overhead
      gn(112)+
      s3(38,52,30,78,8,1)+s3(30,78,28,104,7,1)+
      s3(30,25,18,10,6,1)+                         // L arm overhead
      s3(40,18,40,52,12)+
      s3(42,52,50,78,8)+s3(50,78,52,104,7)+
      s3(50,25,62,10,6)+                           // R arm overhead
      j3(30,25)+j3(50,25)+j3(40,52)+j3(30,78)+j3(50,78)+j3(18,10)+j3(62,10)+
      h3(40,8),
      // Plank position
      gn(66)+
      s3(24,40,20,62,7,1)+
      s3(12,38,62,42,10)+
      s3(40,40,44,62,7)+
      s3(58,42,68,60,6)+
      j3(24,40)+j3(40,40)+j3(58,42)+
      h3(12,30,8),
    ]),

    // MOUNTAIN CLIMBER
    climber: fig('climber',[
      // Right knee tucked toward chest
      gn(66)+
      s3(24,40,20,62,7,1)+                         // L forearm
      s3(12,38,62,42,10)+                          // body
      s3(40,40,44,62,7)+                           // R forearm
      s3(62,42,52,66,8,1)+s3(52,66,50,90,7,1)+    // L leg tucked
      s3(62,42,72,68,8)+s3(72,68,74,94,7)+         // R leg extended
      j3(24,40)+j3(40,40)+j3(62,42)+j3(52,66)+j3(72,68)+
      h3(12,30,8),
      // Left knee tucked
      gn(66)+
      s3(24,40,20,62,7,1)+
      s3(12,38,62,42,10)+
      s3(40,40,44,62,7)+
      s3(62,42,70,66,8,1)+s3(70,66,72,92,7,1)+    // R leg extended
      s3(62,42,52,68,8)+s3(52,68,50,90,7)+         // L leg tucked
      j3(24,40)+j3(40,40)+j3(62,42)+j3(52,68)+j3(70,66)+
      h3(12,30,8),
    ]),

    // JUMP SQUAT
    jumpsquat: fig('jumpsquat',[
      // In the air — full extension, arms up
      gn(112)+
      s3(38,48,30,72,8,1)+s3(30,72,28,98,7,1)+
      s3(30,24,18,10,6,1)+
      s3(40,16,40,48,12)+
      s3(42,48,50,72,8)+s3(50,72,52,98,7)+
      s3(50,24,62,10,6)+
      j3(30,24)+j3(50,24)+j3(40,48)+j3(30,72)+j3(50,72)+j3(18,10)+j3(62,10)+
      h3(40,8),
      // Landing squat
      gn(108)+
      s3(40,54,22,74,8,1)+s3(22,74,30,100,7,1)+
      s3(36,34,16,26,6,1)+
      s3(40,27,40,54,11)+
      s3(40,54,58,74,8)+s3(58,74,50,100,7)+
      s3(44,34,64,26,6)+
      j3(40,34)+j3(40,54)+j3(22,74)+j3(58,74)+
      h3(40,19),
    ]),

    // SKATER JUMP
    skater: fig('skater',[
      // Landing on left foot — body leans left, right arm sweeps across
      gn(112)+
      s3(36,56,26,80,9,1)+                         // L landing leg (back, wide)
      s3(50,27,66,38,6,1)+                         // R arm (back, reaching across)
      s3(38,20,38,56,12)+
      s3(56,70,66,50,7)+                           // R leg up/back
      s3(30,27,14,36,6)+                           // L arm reaching right
      j3(38,27)+j3(38,56)+j3(26,80)+j3(56,70)+j3(66,38)+
      h3(34,12),
      // Landing on right foot
      gn(112)+
      s3(30,70,20,50,7,1)+                         // L leg up/back
      s3(30,27,14,38,6,1)+                         // L arm (back)
      s3(42,20,42,56,12)+
      s3(44,56,54,80,9)+                           // R landing leg
      s3(50,27,66,36,6)+                           // R arm
      j3(42,27)+j3(42,56)+j3(54,80)+j3(30,70)+j3(66,36)+
      h3(46,12),
    ]),

    // BOX STEP
    boxstep: fig('boxstep',[
      // Left foot elevated, stepping up
      gn(112)+
      s3(38,56,54,80,8,1)+s3(54,80,56,108,7,1)+   // R leg down (back)
      s3(30,27,20,47,6,1)+s3(20,47,18,65,5,1)+
      s3(40,20,40,56,12)+
      s3(42,56,30,74,8)+s3(30,74,26,98,7)+         // L leg elevated
      s3(50,27,62,47,6)+s3(62,47,64,65,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(54,80)+j3(30,74)+
      h3(40,12),
      // Both feet on step — standing elevated
      gn(100)+
      s3(38,52,28,76,8,1)+s3(28,76,26,100,7,1)+
      s3(30,25,20,45,6,1)+s3(20,45,18,63,5,1)+
      s3(40,18,40,52,12)+
      s3(42,52,52,76,8)+s3(52,76,54,100,7)+
      s3(50,25,62,45,6)+s3(62,45,64,63,5)+
      j3(30,25)+j3(50,25)+j3(40,52)+j3(28,76)+j3(52,76)+
      h3(40,10),
    ]),

    // CRUNCH
    crunch: fig('crunch',[
      // Lying flat — head at left
      gn(74)+
      s3(14,42,58,46,10)+                          // torso flat
      s3(58,46,72,62,8)+                           // thighs bent
      s3(72,62,70,78,7)+                           // lower legs
      s3(14,42,10,58,5,1)+s3(10,58,16,72,5,1)+    // arms at sides
      j3(14,42)+j3(58,46)+j3(72,62)+j3(10,58)+
      h3(10,32,8),
      // Crunching up
      gn(74)+
      s3(22,38,60,48,10)+                          // torso raised
      s3(60,48,74,62,8)+
      s3(74,62,70,80,7)+
      s3(22,38,14,52,5,1)+s3(14,52,18,66,5,1)+
      j3(22,38)+j3(60,48)+j3(74,62)+j3(14,52)+
      h3(18,28,8),
    ]),

    // TWIST (Russian twist)
    twist: fig('twist',[
      // V-sit, arms twist left
      gn(112)+
      s3(40,32,40,62,11)+                          // torso leaning back
      s3(40,62,28,84,8,1)+s3(28,84,24,108,7,1)+   // L leg out
      s3(40,62,52,84,8)+s3(52,84,56,108,7)+        // R leg out
      s3(40,42,18,34,6,1)+                         // arms both going left
      s3(40,42,20,36,6)+
      j3(40,42)+j3(40,62)+j3(28,84)+j3(52,84)+
      h3(40,22),
      // Arms twist right
      gn(112)+
      s3(40,32,40,62,11)+
      s3(40,62,28,84,8,1)+s3(28,84,24,108,7,1)+
      s3(40,62,52,84,8)+s3(52,84,56,108,7)+
      s3(40,42,60,34,6)+
      s3(40,42,62,36,6,1)+
      j3(40,42)+j3(40,62)+j3(28,84)+j3(52,84)+
      h3(40,22),
    ]),

    // SIDE PLANK
    sideplank: fig('sideplank',[
      // Side plank on left forearm — body diagonal
      gn(58)+
      s3(22,48,20,58,6)+                           // supporting forearm
      s3(22,40,64,56,11)+                          // body diagonal
      s3(64,56,74,50,7)+                           // legs
      s3(64,46,72,36,5)+                           // top arm raised
      j3(22,40)+j3(64,56)+j3(72,36)+
      h3(18,32,8),
      // Hip dip
      gn(58)+
      s3(22,48,20,60,6)+
      s3(22,42,64,62,11)+
      s3(64,62,74,54,7)+
      s3(64,52,72,42,5)+
      j3(22,42)+j3(64,62)+j3(72,42)+
      h3(18,34,8),
    ]),

    // BICYCLE CRUNCH
    bicycle: fig('bicycle',[
      // Right elbow meets left knee
      gn(74)+
      s3(38,32,46,62,10)+                          // torso
      s3(46,62,64,78,8)+s3(64,78,66,98,7)+         // R leg extended
      s3(46,62,28,80,8,1)+s3(28,80,26,62,7,1)+    // L knee tucked
      s3(38,32,20,24,6,1)+                         // L elbow forward
      s3(38,32,58,34,6)+                           // R elbow forward
      j3(38,32)+j3(46,62)+j3(64,78)+j3(28,80)+j3(20,24)+j3(58,34)+
      h3(36,22,8),
      // Left elbow meets right knee
      gn(74)+
      s3(42,32,34,62,10)+
      s3(34,62,16,78,8,1)+s3(16,78,14,98,7,1)+
      s3(34,62,56,80,8)+s3(56,80,58,62,7)+
      s3(42,32,22,34,6,1)+
      s3(42,32,62,24,6)+
      j3(42,32)+j3(34,62)+j3(16,78)+j3(56,80)+j3(22,34)+j3(62,24)+
      h3(44,22,8),
    ]),

    // LEG RAISE
    legraise: fig('legraise',[
      // Hanging — legs down (or lying, legs extended down)
      gn(112)+
      s3(38,56,28,82,8,1)+s3(28,82,26,108,7,1)+
      s3(30,27,20,50,6,1)+s3(20,50,18,68,5,1)+
      s3(40,20,40,56,12)+
      s3(42,56,52,82,8)+s3(52,82,54,108,7)+
      s3(50,27,60,50,6)+s3(60,50,62,68,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,82)+j3(52,82)+
      h3(40,12),
      // Legs raised to 90°
      gn(112)+
      s3(30,27,18,50,6,1)+s3(18,50,16,68,5,1)+
      s3(40,20,40,60,12)+
      s3(38,60,24,38,8,1)+                         // L leg raised
      s3(42,60,56,38,8)+                           // R leg raised
      s3(50,27,62,50,6)+s3(62,50,64,68,5)+
      j3(30,27)+j3(50,27)+j3(40,60)+j3(24,38)+j3(56,38)+
      h3(40,12),
    ]),

    // DEAD BUG
    deadbug: fig('deadbug',[
      // Right arm + left leg extended
      gn(76)+
      s3(38,32,38,64,10)+                          // torso flat
      s3(38,44,56,22,5)+                           // R arm up
      s3(38,44,22,50,5,1)+                         // L arm at side
      s3(38,64,26,84,8,1)+s3(26,84,22,104,7,1)+   // L leg down
      s3(38,64,62,76,8)+s3(62,76,64,56,7)+         // R leg raised/bent
      j3(38,44)+j3(38,64)+j3(56,22)+j3(26,84)+j3(62,76)+
      h3(36,22,8),
      // Left arm + right leg extended
      gn(76)+
      s3(42,32,42,64,10)+
      s3(42,44,24,22,5)+                           // L arm up
      s3(42,44,58,50,5,1)+                         // R arm at side
      s3(42,64,56,84,8)+s3(56,84,60,104,7)+        // R leg down
      s3(42,64,18,76,8,1)+s3(18,76,16,56,7,1)+    // L leg raised/bent
      j3(42,44)+j3(42,64)+j3(24,22)+j3(56,84)+j3(18,76)+
      h3(44,22,8),
    ]),

    // WARMUP (marching in place)
    warmup: fig('warmup',[
      // Left knee raised, right arm forward
      gn(112)+
      s3(38,56,28,74,8,1)+s3(28,74,26,58,7,1)+    // L knee raised (back)
      s3(30,27,18,46,6,1)+                         // L arm back
      s3(40,20,40,56,12)+
      s3(42,56,52,80,8)+s3(52,80,54,108,7)+        // R leg on ground
      s3(50,27,64,44,6)+                           // R arm forward
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,74)+j3(52,80)+j3(18,46)+j3(64,44)+
      h3(40,12),
      // Right knee raised, left arm forward
      gn(112)+
      s3(38,56,28,80,8,1)+s3(28,80,26,108,7,1)+
      s3(30,27,16,44,6,1)+                         // L arm forward
      s3(40,20,40,56,12)+
      s3(42,56,52,74,8)+s3(52,74,50,58,7)+         // R knee raised
      s3(50,27,62,46,6)+                           // R arm back
      j3(30,27)+j3(50,27)+j3(40,56)+j3(28,80)+j3(52,74)+j3(16,44)+j3(62,46)+
      h3(40,12),
    ]),

    // COOLDOWN (relaxed breathing)
    cooldown: fig('cooldown',[
      // Arms low, relaxed
      gn(112)+
      s3(38,56,30,82,8,1)+s3(30,82,28,108,7,1)+
      s3(30,27,22,50,6,1)+s3(22,50,20,68,5,1)+
      s3(40,20,40,56,12)+
      s3(42,56,50,82,8)+s3(50,82,52,108,7)+
      s3(50,27,58,50,6)+s3(58,50,60,68,5)+
      j3(30,27)+j3(50,27)+j3(40,56)+j3(22,50)+j3(58,50)+j3(30,82)+j3(50,82)+
      h3(40,12),
      // Arms raised overhead — deep breath
      gn(112)+
      s3(38,56,30,82,8,1)+s3(30,82,28,108,7,1)+
      s3(30,27,18,12,6,1)+                         // L arm raised
      s3(40,20,40,56,12)+
      s3(42,56,50,82,8)+s3(50,82,52,108,7)+
      s3(50,27,62,12,6)+                           // R arm raised
      j3(30,27)+j3(50,27)+j3(40,56)+j3(18,12)+j3(62,12)+j3(30,82)+j3(50,82)+
      h3(40,12),
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
