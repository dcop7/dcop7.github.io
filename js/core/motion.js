/* ══════════════════════════════════════════════════════════════════
   Motion — camada única de motion design do site (Anime.js v3, MIT,
   vendorizada em js/vendor/anime.min.js, global `anime`).

   Filosofia: o movimento existe para dar continuidade, hierarquia e
   resposta tátil — nunca para impressionar. Quatro intervenções, todas
   centralizadas aqui por delegação/observação (zero alterações nos
   módulos de página):

     1. Transição de vista: ao mudar de secção, os blocos principais
        entram com um stagger curto (26ms) e uma subida de 10px — dá
        profundidade e ordem de leitura sem custar tempo percebido.
     2. Feedback de pressão: qualquer botão/cartão comprime ligeiramente
        ao premir e solta com uma mola suave — o site "responde ao dedo".
     3. Modais partilhados (GameProgress/Fotografia): entrada com
        scale+fade curtos em vez de aparecerem instantaneamente.
     4. Command palette: os resultados assentam com um micro-stagger.

   Regras duras: só transform/opacity (GPU), durações <400ms, tudo
   removido do inline-style ao terminar (não luta com :hover/CSS), e
   TUDO desligado com prefers-reduced-motion ou sem a lib (o site
   funciona exatamente igual sem esta camada).
══════════════════════════════════════════════════════════════════ */
const Motion = (function () {
  'use strict';

  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ok = () => typeof anime !== 'undefined' && !reduced();

  /* limpar estilos inline no fim para devolver o controlo ao CSS */
  const clear = els => (Array.isArray(els) ? els : [els]).forEach(el => {
    if (el) { el.style.transform = ''; el.style.opacity = ''; }
  });

  /* ── 1 · transição de vista (routechange + carga inicial) ──────── */
  let _lastView = null;

  function viewIn(view) {
    if (!ok() || !view) return;
    const inner = view.querySelector('.view-inner') || view;
    const kids = Array.from(inner.children)
      .filter(el => el instanceof HTMLElement && el.offsetParent !== null)
      .slice(0, 12);
    if (!kids.length) return;
    anime.remove(kids);
    anime.set(kids, { opacity: 0, translateY: 10 });
    anime({
      targets: kids,
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 320,
      delay: anime.stagger(26),
      easing: 'cubicBezier(.22,.9,.32,1)',
      complete: () => clear(kids),
    });
  }

  function onRoute() {
    const view = document.querySelector('.view.active');
    if (!view || view === _lastView) return;   /* sub-rota no mesmo ecrã: não repetir */
    _lastView = view;
    viewIn(view);
  }
  document.addEventListener('routechange', () => requestAnimationFrame(onRoute));

  /* ── 2 · feedback de pressão (delegado, site inteiro) ──────────── */
  /* Nota: elementos cujo layout depende de transform próprio (ex.: o
     leque de cartas da Sueca) ficam DE FORA — um transform inline
     destruí-los-ia. */
  const PRESS_SEL = [
    '.btn', '.chip', '.seg-btn', '.icon-btn', '.hdr-icon-btn', '.sb-nav-item',
    '.game-hub-card', '.gh-daily', '.gh-diff-btn', '.gh-stats-btn',
    '.sk-btn', '.sk-ibtn', '.sk-seg-btn',
    '.arch-btn', '.arch-ibtn', '.arch-lvl',
    '.ph-chip', '.ph-gear-btn', '.ph-field-pill', '.ph-scn-card', '.ph-back',
    '.dc-card', '.dc-cat', '.lp-link-card', '.bc-back', '.cp-item',
  ].join(',');

  let _pressed = null;
  document.addEventListener('pointerdown', e => {
    if (!ok() || (e.button !== undefined && e.button !== 0)) return;
    const el = e.target.closest && e.target.closest(PRESS_SEL);
    if (!el || el.disabled) return;
    _pressed = el;
    anime.remove(el);
    anime({ targets: el, scale: 0.965, duration: 90, easing: 'easeOutQuad' });
  }, { passive: true, capture: true });

  function release(spring) {
    const el = _pressed;
    if (!el) return;
    _pressed = null;
    if (!ok()) { el.style.transform = ''; return; }
    anime.remove(el);
    anime({
      targets: el, scale: 1,
      duration: 180,
      easing: spring ? 'spring(1, 120, 14, 0)' : 'easeOutQuad',
      complete: () => clear(el),
    });
  }
  document.addEventListener('pointerup', () => release(true), { passive: true, capture: true });
  document.addEventListener('pointercancel', () => release(false), { passive: true, capture: true });

  /* ── 3 · modais partilhados (aparecem no <body>) ───────────────── */
  const MODAL_SEL = '.gp-modal-back,.ph-modal-overlay';
  new MutationObserver(muts => {
    if (!ok()) return;
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (!(n instanceof HTMLElement) || !n.matches || !n.matches(MODAL_SEL)) return;
      const box = n.firstElementChild;
      anime.remove(n);
      anime.set(n, { opacity: 0 });
      anime({ targets: n, opacity: [0, 1], duration: 150, easing: 'linear', complete: () => clear(n) });
      if (box) {
        anime.remove(box);
        anime({
          targets: box, scale: [0.95, 1], translateY: [8, 0], duration: 260,
          easing: 'cubicBezier(.22,1,.36,1)', complete: () => clear(box),
        });
      }
    }));
  }).observe(document.body, { childList: true });

  /* ── 4 · command palette: resultados assentam com micro-stagger ── */
  let _cpWired = false;
  function wireCp() {
    if (_cpWired) return;
    const res = document.getElementById('cp-results');
    if (!res) return;
    _cpWired = true;
    new MutationObserver(() => {
      if (!ok()) return;
      const items = Array.from(res.querySelectorAll('.cp-item')).slice(0, 9);
      if (items.length < 2) return;
      anime.remove(items);
      anime.set(items, { opacity: 0, translateY: 4 });
      anime({
        targets: items, opacity: 1, translateY: 0, duration: 140,
        delay: anime.stagger(11), easing: 'easeOutQuad',
        complete: () => clear(items),
      });
    }).observe(res, { childList: true });
  }

  /* ── 5 · trocas de tab/seg dentro da mesma vista ───────────────── */
  /* Genérico e sem registo por página: no clique num botão de tab,
     observa a vista ativa durante 120ms e anima o primeiro painel que
     for substituído (childList) ou revelado (class/hidden). */
  function swapIn(container) {
    if (!ok() || !(container instanceof HTMLElement)) return;
    const kids = Array.from(container.children).filter(el => el instanceof HTMLElement).slice(0, 10);
    const tgt = kids.length > 1 ? kids : [container];
    anime.remove(tgt);
    anime.set(tgt, { opacity: 0, translateY: 6 });
    anime({
      targets: tgt, opacity: 1, translateY: 0, duration: 190,
      delay: kids.length > 1 ? anime.stagger(14) : 0,
      easing: 'easeOutQuad', complete: () => clear(tgt),
    });
  }
  const TAB_SEL = '.seg-btn,[role="tab"],.nw-topic,.dc-cat';
  document.addEventListener('click', e => {
    if (!ok()) return;
    const tab = e.target.closest && e.target.closest(TAB_SEL);
    if (!tab) return;
    const view = document.querySelector('.view.active');
    if (!view) return;
    let done = false;
    const obs = new MutationObserver(muts => {
      if (done) return;
      for (const m of muts) {
        const el = m.target;
        if (!(el instanceof HTMLElement) || el === view) continue;
        if (m.type === 'childList' && m.addedNodes.length) {
          done = true; obs.disconnect(); swapIn(el); return;
        }
        if (m.type === 'attributes' && el.tagName !== 'BUTTON' && el.tagName !== 'A' &&
            el.children.length && el.offsetParent !== null && !el.hidden) {
          done = true; obs.disconnect(); swapIn(el); return;
        }
      }
    });
    obs.observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    setTimeout(() => { done = true; obs.disconnect(); }, 120);
  }, true);

  /* ── 6 · primeiro render assíncrono dos widgets da home ────────── */
  /* Os dados (meteo, descoberta, eventos…) chegam depois da shell; o
     primeiro preenchimento de cada contentor entra com stagger — uma
     única vez por sessão (atualizações seguintes são silenciosas). */
  const _homeSeen = new WeakSet();
  function wireHome() {
    const hv = document.getElementById('view-home');
    if (!hv || hv._mWired) return;
    hv._mWired = true;
    new MutationObserver(muts => {
      if (!ok() || !hv.classList.contains('active')) return;
      muts.forEach(m => {
        const c = m.target;
        if (!(c instanceof HTMLElement) || _homeSeen.has(c)) return;
        if (m.addedNodes.length < 2) return;          /* só substituições em bloco */
        _homeSeen.add(c);
        swapIn(c);
      });
    }).observe(hv, { childList: true, subtree: true });
  }

  /* ── 7 · drawer mobile: itens da sidebar em cascata ────────────── */
  document.addEventListener('click', e => {
    if (!ok() || !(e.target.closest && e.target.closest('#sb-toggle'))) return;
    if (window.innerWidth >= 900 || !document.body.classList.contains('sb-open')) return;
    const items = Array.from(document.querySelectorAll('.sb-nav-item')).slice(0, 18);
    if (!items.length) return;
    anime.remove(items);
    anime.set(items, { opacity: 0, translateX: -10 });
    anime({
      targets: items, opacity: 1, translateX: 0, duration: 200,
      delay: anime.stagger(12), easing: 'easeOutQuad', complete: () => clear(items),
    });
  });

  /* ── 8 · tema claro/escuro com cross-fade nativo ───────────────── */
  /* View Transitions API (Chrome 111+): snapshot + crossfade de 250ms
     na troca de tema — progressivo, zero custo onde não existe. */
  function wireTheme() {
    if (typeof ThemeManager === 'undefined' || !document.startViewTransition) return;
    const orig = ThemeManager.apply.bind(ThemeManager);
    ThemeManager.apply = function (...args) {
      if (!ok()) return orig(...args);
      try { document.startViewTransition(() => orig(...args)); }
      catch (e) { orig(...args); }
    };
  }

  /* ── arranque ──────────────────────────────────────────────────── */
  function boot() {
    requestAnimationFrame(() => { onRoute(); wireCp(); wireHome(); wireTheme(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* helpers públicos para módulos que queiram movimento pontual
     (mesma linguagem: curto, transform/opacity, auto-limpeza) */
  function pop(el) {
    if (!ok() || !el) return;
    anime.remove(el);
    anime({ targets: el, scale: [0.95, 1], opacity: [0, 1], duration: 220, easing: 'cubicBezier(.22,1,.36,1)', complete: () => clear(el) });
  }
  function stagger(els, opts) {
    if (!ok() || !els || !els.length) return;
    const list = Array.from(els).slice(0, (opts && opts.max) || 14);
    anime.remove(list);
    anime.set(list, { opacity: 0, translateY: (opts && opts.y) || 8 });
    anime({
      targets: list, opacity: 1, translateY: 0,
      duration: (opts && opts.duration) || 280,
      delay: anime.stagger((opts && opts.step) || 22),
      easing: 'cubicBezier(.22,.9,.32,1)',
      complete: () => clear(list),
    });
  }

  return { ok, viewIn, pop, stagger };
})();
window.Motion = Motion;
