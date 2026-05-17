/* ── GameInput — keyboard, touch, virtual D-pad ── */
const GameInput = (function () {
  /* ── Keyboard tracker ── */
  function createKeyboard() {
    const _keys = new Set();
    const _down = new Map();
    const _up   = new Map();

    function onKeyDown(e) {
      if (!_keys.has(e.code)) {
        _keys.add(e.code);
        _down.set(e.code, true);
      }
    }
    function onKeyUp(e) {
      _keys.delete(e.code);
      _up.set(e.code, true);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    return {
      held:      (code) => _keys.has(code),
      pressed:   (code) => _down.has(code),
      released:  (code) => _up.has(code),
      flush()    { _down.clear(); _up.clear(); },
      destroy()  {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup',   onKeyUp);
        _keys.clear(); _down.clear(); _up.clear();
      },
    };
  }

  /* ── Virtual D-pad / touch controls ── */
  function createTouchControls(container, opts = {}) {
    const labels = opts.labels || { up: '▲', down: '▼', left: '◀', right: '▶', a: 'A', b: 'B' };
    const dirs   = opts.dirs !== false;
    const btns   = opts.buttons || [];
    const _state = {};

    const wrap = document.createElement('div');
    wrap.className = 'gei-dpad-wrap';
    wrap.style.cssText = 'position:absolute;bottom:1rem;left:0;right:0;display:flex;align-items:flex-end;justify-content:space-between;padding:0 .75rem;pointer-events:none;user-select:none;z-index:10;';

    function _btn(label, key, style = '') {
      const el = document.createElement('button');
      el.className = 'gei-btn';
      el.textContent = label;
      el.style.cssText = `pointer-events:auto;width:44px;height:44px;border-radius:8px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:.9rem;cursor:pointer;transition:background .1s;${style}`;
      _state[key] = false;

      function down(e) { e.preventDefault(); _state[key] = true; el.style.background = 'rgba(255,255,255,.28)'; }
      function up()    { _state[key] = false; el.style.background = 'rgba(255,255,255,.12)'; }
      el.addEventListener('touchstart',  down, { passive: false });
      el.addEventListener('touchend',    up,   { passive: false });
      el.addEventListener('touchcancel', up,   { passive: false });
      el.addEventListener('mousedown',   down);
      el.addEventListener('mouseup',     up);
      el.addEventListener('mouseleave',  up);
      return el;
    }

    if (dirs) {
      const dpad = document.createElement('div');
      dpad.style.cssText = 'display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:3px;';
      const grid = [
        null, _btn(labels.up,    'up'),    null,
        _btn(labels.left, 'left'), _btn('·', 'center', 'cursor:default;opacity:.3;'), _btn(labels.right, 'right'),
        null, _btn(labels.down,  'down'),  null,
      ];
      grid.forEach(el => {
        const cell = document.createElement('div');
        if (el) cell.appendChild(el);
        dpad.appendChild(cell);
      });
      wrap.appendChild(dpad);
    }

    if (btns.length) {
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex;gap:6px;align-items:flex-end;';
      btns.forEach(key => btnGroup.appendChild(_btn(labels[key] || key.toUpperCase(), key)));
      wrap.appendChild(btnGroup);
    }

    container.style.position = 'relative';
    container.appendChild(wrap);

    return {
      get: (key) => !!_state[key],
      destroy() { wrap.remove(); },
    };
  }

  return { createKeyboard, createTouchControls };
})();
