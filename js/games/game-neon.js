const NeonGame = (function () {
  'use strict';

  function init(root) {
    if (!root) return;

    root.innerHTML = `
      <div>
        <div class="t-row" style="margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem">
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Cor</span>
            <div class="tool-colors" id="neon-colors">
              ${['#6366f1','#22d3ee','#10b981','#f59e0b','#ef4444','#a855f7','#f0f','#0ff'].map((c,i)=>
                `<button class="tcol${i===0?' active':''}" data-c="${c}" style="--tc:${c}"></button>`).join('')}
            </div>
          </div>
          <div class="tool-opts-grp">
            <span class="tool-opts-lbl">Espessura</span>
            <div class="tool-seg" id="neon-size">
              ${[2,4,8,14,20].map((s,i)=>`<button class="tsb${i===1?' active':''}" data-s="${s}">${s}</button>`).join('')}
            </div>
          </div>
          <button class="t-btn t-btn-ghost" id="neon-clear">🗑 Limpar</button>
          <button class="t-btn t-btn-ghost" id="neon-dl">💾 PNG</button>
        </div>
        <canvas id="neon-canvas" style="background:#000;border:1px solid var(--border);border-radius:var(--radius);cursor:crosshair;display:block;width:100%;touch-action:none"></canvas>
      </div>`;

    const canvas = root.querySelector('#neon-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false, color = '#6366f1', size = 4;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.parentElement.clientWidth - 2;
      const cssH = Math.max(450, window.innerHeight * 0.55);
      const img = canvas.toDataURL();
      canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cssW, cssH);
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, cssW, cssH);
      image.src = img;
    }
    resize();

    function applyStyle() {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowBlur = size * 5;
      ctx.shadowColor = color;
      ctx.globalCompositeOperation = 'lighter';
    }
    applyStyle();

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    }

    function down(e) { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function up() { drawing = false; ctx.beginPath(); }

    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', up); canvas.addEventListener('mouseleave', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);

    root.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      color = b.dataset.c;
      root.querySelectorAll('[data-c]').forEach(x => x.classList.remove('active')); b.classList.add('active');
      applyStyle();
    }));
    root.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      size = +b.dataset.s;
      root.querySelectorAll('[data-s]').forEach(x => x.classList.remove('active')); b.classList.add('active');
      applyStyle();
    }));
    root.querySelector('#neon-clear').addEventListener('click', () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    });
    root.querySelector('#neon-dl').addEventListener('click', () => {
      const a = document.createElement('a'); a.download = 'neon-art.png'; a.href = canvas.toDataURL(); a.click();
    });
    window.addEventListener('resize', resize);
  }

  return { init };
})();
