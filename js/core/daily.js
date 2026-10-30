/* ══════════════════════════════════════════════════════════════════
   Daily — sorteios "do dia" partilhados entre secções
   ──────────────────────────────────────────────────────────────────
   A piada do dia aparece no Humor e na página Hoje; se cada uma fizesse
   as contas à sua maneira podiam discordar. Aqui vive a única versão.

   O dia do ano conta-se em calendário (Date.UTC), não em milissegundos
   locais: a conta antiga `(agora - 0 de janeiro) / 86400000` perdia uma
   hora com a hora de verão e, entre a meia-noite e a uma, devolvia o dia
   anterior.
   ══════════════════════════════════════════════════════════════════ */
const Daily = (function () {
  'use strict';

  const today = () => (typeof AppTime !== 'undefined' ? AppTime.now() : new Date());

  function dayOfYear(d) {
    d = d || today();
    return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
  }

  /* Semente numérica do dia: a mesma fórmula que o Humor sempre usou,
     para a piada de hoje não mudar com esta refatoração. */
  function daySeed(d) { d = d || today(); return d.getFullYear() * 1000 + dayOfYear(d); }

  /* index: categorias do data/humor/index.json · loadCat(id) → piadas[] */
  async function jokeOfDay(index, loadCat) {
    if (!index || !index.length) return null;
    const seed = daySeed();
    const cat = index[seed % index.length];
    const jokes = await loadCat(cat.id);
    return jokes && jokes.length ? jokes[seed % jokes.length] : null;
  }

  return { dayOfYear, daySeed, jokeOfDay };
})();
