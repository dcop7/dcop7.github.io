// ── APP TIME — single source of truth for the current date/time ──────
// One central ticker for the whole app. Anything that shows or depends on
// "now" subscribes to these document events instead of keeping its own
// setInterval or a snapshot taken at page load:
//   time:second → every tick                     (detail: { now })
//   time:minute → the minute changed
//   time:hour   → the hour changed
//   time:period → greeting period changed (morning / afternoon / evening)
//   time:day    → the local calendar day changed
// Day change is detected by comparing local Y-M-D keys — never by adding
// 86400000 — so month/year rollovers and DST transitions are inherently
// correct. The ticker also re-checks on visibilitychange/pageshow/focus/
// online because intervals are throttled in background tabs and suspended
// across OS sleep: a tab left open for days catches up the instant it wakes,
// firing every boundary event that was crossed while asleep.
const AppTime = (function () {
  const now = () => new Date();
  const dayKey = d => {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const period = d => { const h = (d || new Date()).getHours(); return h < 12 ? 'morning' : h < 19 ? 'afternoon' : 'evening'; };

  let last = null;
  function fire(name, n) { document.dispatchEvent(new CustomEvent(name, { detail: { now: n } })); }
  function check() {
    const n = new Date();
    const cur = { day: dayKey(n), hour: n.getHours(), min: n.getMinutes(), per: period(n) };
    if (last) {
      fire('time:second', n);
      if (cur.min !== last.min || cur.hour !== last.hour || cur.day !== last.day) fire('time:minute', n);
      if (cur.hour !== last.hour || cur.day !== last.day) fire('time:hour', n);
      if (cur.per !== last.per) fire('time:period', n);
      if (cur.day !== last.day) fire('time:day', n);
    }
    last = cur;
  }
  check();                       // seed `last` without firing events
  setInterval(check, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);

  return { now, today, dayKey, period };
})();
window.AppTime = AppTime;
