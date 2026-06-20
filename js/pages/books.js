/* ══════════════════════════════════════════════════════════════════
   BOOK DISCOVERY — a digital "library of discovery" (LIVE, no backend)
   Browse books by area → category → subcategory/age, with ranked rails
   (most popular / classics / trending / new / discover). All book data is
   fetched LIVE from the Open Library API in the browser (CORS-open, no key)
   and cached in sessionStorage — no GitHub Action, no static dataset.
   Google Books is used best-effort only for a single book's description.
   ══════════════════════════════════════════════════════════════════ */
const BookDiscovery = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const YEAR = new Date().getFullYear();

  /* ════════════════════════ LIVE DATA (Open Library) ════════════════════════ */
  const BooksData = (function () {
    const OL = 'https://openlibrary.org';
    const FIELDS = 'key,title,author_name,first_publish_year,edition_count,ratings_average,ratings_count,want_to_read_count,already_read_count,cover_i,ia';
    const mem = new Map();
    let gate = 0;
    const slot = () => { const now = Date.now(), at = Math.max(now, gate); gate = at + 220; return at <= now ? Promise.resolve() : new Promise(r => setTimeout(r, at - now)); };

    async function get(url, ttl = 2700000) {
      const hit = mem.get(url); if (hit && Date.now() - hit.t < ttl) return hit.data;
      try { const raw = sessionStorage.getItem('bk:' + url); if (raw) { const o = JSON.parse(raw); if (Date.now() - o.t < ttl) { mem.set(url, o); return o.data; } } } catch {}
      await slot();
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      const o = { t: Date.now(), data }; mem.set(url, o);
      try { sessionStorage.setItem('bk:' + url, JSON.stringify(o)); } catch {}
      return data;
    }

    const coverUrl = (coverId, size = 'M') => coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : '';

    function normalize(d) {
      const id = (d.key || '').replace('/works/', '');
      return {
        id, title: d.title || '', authors: d.author_name || [], year: d.first_publish_year || null,
        cover: d.cover_i || null, editions: d.edition_count || 0,
        ratingAvg: d.ratings_average || 0, ratingCount: d.ratings_count || 0,
        want: d.want_to_read_count || 0, read: d.already_read_count || 0,
      };
    }
    async function search(q, { sort = '', limit = 24, page = 1 } = {}) {
      let url = `${OL}/search.json?q=${encodeURIComponent(q)}&limit=${limit}&page=${page}&fields=${FIELDS}`;
      if (sort) url += '&sort=' + sort;
      const data = await get(url);
      return (data.docs || []).map(normalize);
    }
    /* precise lookup of one specific (curated) book by title (+ author) using
       Open Library's title=/author= fields → the right edition, not a generic hit. */
    async function lookup(title, author) {
      const url = `${OL}/search.json?title=${encodeURIComponent(title)}${author ? '&author=' + encodeURIComponent(author) : ''}&limit=4&fields=${FIELDS}`;
      let data; try { data = await get(url); } catch { return null; }
      const docs = (data.docs || []).map(normalize);
      // prefer a real match with a cover + the most editions (the canonical work)
      return docs.sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0) || (b.editions - a.editions) || (b.want - a.want))[0] || null;
    }
    async function work(olid) {
      try { return await get(`${OL}/works/${olid}.json`); } catch { return null; }
    }
    /* fetch any OL entity by its key, e.g. "/authors/OL..A" or "/works/OL..W" */
    async function entity(key) {
      if (!key) return null;
      try { return await get(`${OL}${key}.json`); } catch { return null; }
    }
    async function gbDescription(title, author) {
      try {
        const q = encodeURIComponent(`intitle:${title}${author ? ' inauthor:' + author : ''}`);
        const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&country=PT`);
        if (!r.ok) return null;
        const j = await r.json();
        return j.items?.[0]?.volumeInfo?.description || null;
      } catch { return null; }
    }
    return { search, lookup, work, entity, coverUrl, gbDescription };
  })();

  /* ════════════════════════ BOOK SCORE ════════════════════════
     Community-popularity score (0–100) from Open Library signals so rails
     rank by real interest, not random order. */
  function score(b) {
    const want = Math.log10(1 + (b.want || 0));
    const rc = Math.log10(1 + (b.ratingCount || 0));
    const avg = (b.ratingAvg || 0) / 5;
    const ed = Math.log10(1 + (b.editions || 0));
    const award = isAward(b) ? 1 : 0;
    return Math.min(100, Math.round(11 * want + 6 * rc + 14 * avg + 5 * ed + 8 * award));
  }
  /* Small curated set of award-winning / canonical books → 🏆 badge (matched
     loosely by title; live data can't give us literary-prize lists). */
  const AWARDS = new Set(['dune', 'the lord of the rings', '1984', 'sapiens', 'atomic habits', 'the hobbit',
    'to kill a mockingbird', 'the name of the wind', 'project hail mary', 'the midnight library', 'educated',
    'thinking, fast and slow', 'a brief history of time', 'the selfish gene', 'cosmos', 'brave new world',
    'fahrenheit 451', 'the catcher in the rye', 'pride and prejudice', 'the alchemist', 'man\'s search for meaning']);
  const isAward = b => AWARDS.has(norm(b.title));

  /* ════════════════════════ TAXONOMY (curated, embedded) ════════════════════════
     area → groups → leaves. Each leaf: { id, label, q (Open Library query) }.
     `q` uses subject/text; rails sort it live (readinglog/editions/new). */
  const TAXONOMY = [
    { id: 'kids', emoji: '👶', label: 'Crianças e jovens', label_en: 'Kids & teens', groups: [
      { label: '0–3', leaves: [
        { id: 'k-animals', label: 'Animais', q: 'subject:"animals" subject:"board books"' },
        { id: 'k-sounds', label: 'Sons', q: 'subject:"sound books" subject:"toy and movable books"' },
        { id: 'k-colors', label: 'Cores', q: 'subject:"color" subject:"board books"' } ] },
      { label: '4–6', leaves: [
        { id: 'k-emotions', label: 'Emoções', q: 'subject:"emotions" subject:"picture books"' },
        { id: 'k-friendship', label: 'Amizade', q: 'subject:"friendship" subject:"picture books"' },
        { id: 'k-animals2', label: 'Animais', q: 'subject:"animals" subject:"picture books"' },
        { id: 'k-adventure', label: 'Aventura', q: 'subject:"adventure" subject:"picture books"' },
        { id: 'k-bedtime', label: 'Hora de dormir', q: 'subject:"bedtime" subject:"picture books"' } ] },
      { label: '7–10', leaves: [
        { id: 'k-science', label: 'Ciência', q: 'subject:"science" subject:"juvenile literature"' },
        { id: 'k-history', label: 'História', q: 'subject:"history" subject:"juvenile literature"' },
        { id: 'k-fantasy', label: 'Fantasia', q: 'subject:"fantasy" subject:"juvenile fiction"' },
        { id: 'k-mystery', label: 'Mistério', q: 'subject:"mystery" subject:"juvenile fiction"' } ] },
    ] },
    { id: 'dev', emoji: '🧠', label: 'Desenvolvimento pessoal', label_en: 'Personal development', groups: [{ leaves: [
      { id: 'd-habits', label: 'Hábitos', q: 'subject:habits' },
      { id: 'd-productivity', label: 'Produtividade', q: 'subject:"time management" subject:productivity' },
      { id: 'd-communication', label: 'Comunicação', q: 'subject:"interpersonal communication"' },
      { id: 'd-eq', label: 'Inteligência emocional', q: 'subject:"emotional intelligence"' },
      { id: 'd-finance', label: 'Finanças pessoais', q: 'subject:"personal finance"' } ] }] },
    { id: 'science', emoji: '🔬', label: 'Ciência', label_en: 'Science', groups: [{ leaves: [
      { id: 's-astronomy', label: 'Astronomia', q: 'subject:astronomy' },
      { id: 's-biology', label: 'Biologia', q: 'subject:biology' },
      { id: 's-body', label: 'Corpo humano', q: 'subject:"human body" subject:anatomy' },
      { id: 's-animals', label: 'Animais', q: 'subject:zoology subject:animals' },
      { id: 's-evolution', label: 'Evolução', q: 'subject:evolution' },
      { id: 's-ai', label: 'Inteligência artificial', q: 'subject:"artificial intelligence"' },
      { id: 's-programming', label: 'Programação', q: 'subject:"computer programming"' } ] }] },
    { id: 'history', emoji: '🌍', label: 'História e cultura', label_en: 'History & culture', groups: [{ leaves: [
      { id: 'h-civ', label: 'Civilizações', q: 'subject:"civilization" subject:"ancient history"' },
      { id: 'h-wars', label: 'Guerras', q: 'subject:"military history" subject:war' },
      { id: 'h-portugal', label: 'Portugal', q: 'subject:"portugal history"' },
      { id: 'h-cultures', label: 'Culturas do mundo', q: 'subject:"manners and customs" subject:culture' },
      { id: 'h-myth', label: 'Mitologia', q: 'subject:mythology' } ] }] },
    { id: 'fiction', emoji: '🎭', label: 'Ficção', label_en: 'Fiction', groups: [{ leaves: [
      { id: 'f-fantasy', label: 'Fantasia', q: 'subject:fantasy' },
      { id: 'f-scifi', label: 'Ficção científica', q: 'subject:"science fiction"' },
      { id: 'f-mystery', label: 'Mistério', q: 'subject:"mystery fiction" subject:detective' },
      { id: 'f-horror', label: 'Terror', q: 'subject:horror' },
      { id: 'f-romance', label: 'Romance', q: 'subject:"romance fiction"' } ] }] },
  ];
  const LEAVES = {};
  TAXONOMY.forEach(a => a.groups.forEach(g => g.leaves.forEach(l => { LEAVES[l.id] = { ...l, areaId: a.id, area: a }; })));

  /* ════════════════════════ CURATED REFERENCE BOOKS ════════════════════════
     Per leaf, the best-known / most-recommended titles — shown FIRST (the
     "Essenciais" rail), resolved precisely via BooksData.lookup (title+author)
     so we don't depend on noisy generic subject queries. Canonical titles
     (often the English original) resolve reliably on Open Library; a few PT
     titles are included and simply skip if OL doesn't have them. {t,a}. */
  const CURATED = {
    // 👶 0–3
    'k-animals': [{ t: 'The Very Hungry Caterpillar', a: 'Eric Carle' }, { t: 'Dear Zoo', a: 'Rod Campbell' }, { t: 'Brown Bear, Brown Bear, What Do You See?', a: 'Bill Martin' }, { t: "Where's Spot?", a: 'Eric Hill' }, { t: 'Goodnight Gorilla', a: 'Peggy Rathmann' }],
    'k-sounds': [{ t: 'Moo, Baa, La La La!', a: 'Sandra Boynton' }, { t: "Don't Push the Button!", a: 'Bill Cotter' }, { t: 'The Very Busy Spider', a: 'Eric Carle' }, { t: 'Peek-a-Boo!', a: 'Janet Ahlberg' }],
    'k-colors': [{ t: 'Press Here', a: 'Hervé Tullet' }, { t: 'Mix It Up!', a: 'Hervé Tullet' }, { t: 'The Mixed-Up Chameleon', a: 'Eric Carle' }, { t: "Little Blue and Little Yellow", a: 'Leo Lionni' }],
    // 👶 4–6
    'k-emotions': [{ t: 'The Colour Monster', a: 'Anna Llenas' }, { t: 'In My Heart', a: 'Jo Witek' }, { t: 'The Way I Feel', a: 'Janan Cain' }, { t: 'When Sophie Gets Angry', a: 'Molly Bang' }],
    'k-friendship': [{ t: 'The Rainbow Fish', a: 'Marcus Pfister' }, { t: 'Should I Share My Ice Cream?', a: 'Mo Willems' }, { t: 'Frog and Toad Are Friends', a: 'Arnold Lobel' }, { t: 'Stick Man', a: 'Julia Donaldson' }],
    'k-animals2': [{ t: 'The Gruffalo', a: 'Julia Donaldson' }, { t: "We're Going on a Bear Hunt", a: 'Michael Rosen' }, { t: 'Dear Zoo', a: 'Rod Campbell' }, { t: 'The Tiger Who Came to Tea', a: 'Judith Kerr' }],
    'k-adventure': [{ t: 'Where the Wild Things Are', a: 'Maurice Sendak' }, { t: 'Room on the Broom', a: 'Julia Donaldson' }, { t: 'The Gruffalo', a: 'Julia Donaldson' }, { t: 'O Cuquedo', a: 'Clara Cunha' }],
    'k-bedtime': [{ t: 'Guess How Much I Love You', a: 'Sam McBratney' }, { t: 'Goodnight Moon', a: 'Margaret Wise Brown' }, { t: 'The Rabbit Who Wants to Fall Asleep', a: 'Carl-Johan Forssén Ehrlin' }, { t: 'Llama Llama Red Pajama', a: 'Anna Dewdney' }],
    // 👶 7–10
    'k-science': [{ t: 'The Magic School Bus', a: 'Joanna Cole' }, { t: 'National Geographic Kids' }, { t: 'A Really Short History of Nearly Everything', a: 'Bill Bryson' }],
    'k-history': [{ t: 'Horrible Histories', a: 'Terry Deary' }, { t: 'Who Was Albert Einstein?', a: 'Jess Brallier' }],
    'k-fantasy': [{ t: "Harry Potter and the Philosopher's Stone", a: 'J. K. Rowling' }, { t: 'The Bad Guys', a: 'Aaron Blabey' }, { t: 'Diary of a Wimpy Kid', a: 'Jeff Kinney' }, { t: 'Charlie and the Chocolate Factory', a: 'Roald Dahl' }, { t: 'Dog Man', a: 'Dav Pilkey' }, { t: 'The Lion, the Witch and the Wardrobe', a: 'C. S. Lewis' }],
    'k-mystery': [{ t: 'Diary of a Wimpy Kid', a: 'Jeff Kinney' }, { t: 'The 13-Storey Treehouse', a: 'Andy Griffiths' }, { t: 'The Boxcar Children', a: 'Gertrude Chandler Warner' }, { t: 'The Bad Guys', a: 'Aaron Blabey' }],
    // 🧠 Desenvolvimento pessoal
    'd-habits': [{ t: 'Atomic Habits', a: 'James Clear' }, { t: 'The Power of Habit', a: 'Charles Duhigg' }, { t: 'Tiny Habits', a: 'BJ Fogg' }],
    'd-productivity': [{ t: 'Deep Work', a: 'Cal Newport' }, { t: 'Getting Things Done', a: 'David Allen' }, { t: 'The 7 Habits of Highly Effective People', a: 'Stephen Covey' }],
    'd-communication': [{ t: 'How to Win Friends and Influence People', a: 'Dale Carnegie' }, { t: 'Never Split the Difference', a: 'Chris Voss' }, { t: 'Crucial Conversations', a: 'Kerry Patterson' }],
    'd-eq': [{ t: 'Emotional Intelligence', a: 'Daniel Goleman' }, { t: 'The Body Keeps the Score', a: 'Bessel van der Kolk' }, { t: 'Daring Greatly', a: 'Brené Brown' }],
    'd-finance': [{ t: 'The Psychology of Money', a: 'Morgan Housel' }, { t: 'Rich Dad, Poor Dad', a: 'Robert Kiyosaki' }, { t: 'The Richest Man in Babylon', a: 'George Clason' }],
    // 🔬 Ciência
    's-astronomy': [{ t: 'Cosmos', a: 'Carl Sagan' }, { t: 'A Brief History of Time', a: 'Stephen Hawking' }, { t: 'Astrophysics for People in a Hurry', a: 'Neil deGrasse Tyson' }],
    's-biology': [{ t: 'The Selfish Gene', a: 'Richard Dawkins' }, { t: 'The Gene', a: 'Siddhartha Mukherjee' }],
    's-body': [{ t: 'Being Mortal', a: 'Atul Gawande' }, { t: 'The Body', a: 'Bill Bryson' }],
    's-evolution': [{ t: 'On the Origin of Species', a: 'Charles Darwin' }, { t: 'Sapiens', a: 'Yuval Noah Harari' }, { t: 'The Selfish Gene', a: 'Richard Dawkins' }],
    's-ai': [{ t: 'Life 3.0', a: 'Max Tegmark' }, { t: 'Superintelligence', a: 'Nick Bostrom' }, { t: 'Human Compatible', a: 'Stuart Russell' }],
    's-programming': [{ t: 'Clean Code', a: 'Robert Martin' }, { t: 'The Pragmatic Programmer', a: 'Andrew Hunt' }, { t: 'Structure and Interpretation of Computer Programs', a: 'Harold Abelson' }],
    // 🌍 História e cultura
    'h-civ': [{ t: 'Sapiens', a: 'Yuval Noah Harari' }, { t: 'Guns, Germs, and Steel', a: 'Jared Diamond' }, { t: 'A History of the World in 100 Objects', a: 'Neil MacGregor' }],
    'h-wars': [{ t: 'The Second World War', a: 'Antony Beevor' }, { t: 'The Guns of August', a: 'Barbara Tuchman' }],
    'h-portugal': [{ t: 'História de Portugal', a: 'José Hermano Saraiva' }, { t: 'Os Lusíadas', a: 'Luís de Camões' }],
    'h-myth': [{ t: 'Mythos', a: 'Stephen Fry' }, { t: 'Norse Mythology', a: 'Neil Gaiman' }, { t: "D'Aulaires' Book of Greek Myths", a: 'Ingri d\'Aulaire' }],
    // 🎭 Ficção
    'f-fantasy': [{ t: 'The Lord of the Rings', a: 'J. R. R. Tolkien' }, { t: "Harry Potter and the Philosopher's Stone", a: 'J. K. Rowling' }, { t: 'A Game of Thrones', a: 'George R. R. Martin' }, { t: 'The Name of the Wind', a: 'Patrick Rothfuss' }, { t: 'Mistborn', a: 'Brandon Sanderson' }],
    'f-scifi': [{ t: 'Dune', a: 'Frank Herbert' }, { t: '1984', a: 'George Orwell' }, { t: 'Project Hail Mary', a: 'Andy Weir' }, { t: 'The Three-Body Problem', a: 'Liu Cixin' }, { t: "The Hitchhiker's Guide to the Galaxy", a: 'Douglas Adams' }],
    'f-mystery': [{ t: 'And Then There Were None', a: 'Agatha Christie' }, { t: 'Gone Girl', a: 'Gillian Flynn' }, { t: 'The Girl with the Dragon Tattoo', a: 'Stieg Larsson' }],
    'f-horror': [{ t: 'It', a: 'Stephen King' }, { t: 'The Shining', a: 'Stephen King' }, { t: 'Dracula', a: 'Bram Stoker' }, { t: 'Frankenstein', a: 'Mary Shelley' }],
    'f-romance': [{ t: 'Pride and Prejudice', a: 'Jane Austen' }, { t: 'It Ends with Us', a: 'Colleen Hoover' }, { t: 'The Notebook', a: 'Nicholas Sparks' }, { t: 'Me Before You', a: 'Jojo Moyes' }],
  };

  /* PT bookstores — search by ISBN/title (no API). */
  const STORES = [
    { name: 'Wook', url: q => 'https://www.wook.pt/pesquisa/' + encodeURIComponent(q) },
    { name: 'Bertrand', url: q => 'https://www.bertrand.pt/pesquisa/' + encodeURIComponent(q) },
    { name: 'FNAC', url: q => 'https://www.fnac.pt/SearchResult/ResultList.aspx?Search=' + encodeURIComponent(q) },
    { name: 'Continente', url: q => 'https://www.continente.pt/pesquisa/?q=' + encodeURIComponent(q) },
  ];

  /* ════════════════════════ STATE ════════════════════════ */
  let _root = null, _filters = null;

  /* ════════════════════════ CARDS ════════════════════════ */
  function bookCard(b) {
    const sc = b.score != null ? b.score : score(b);
    const cover = b.cover ? BooksData.coverUrl(b.cover, 'M') : '';
    return `<button class="bk-card" data-book="${esc(b.id)}">
      <div class="bk-cover">${cover ? `<img src="${cover}" alt="" loading="lazy" onerror="this.closest('.bk-cover').classList.add('bk-nocover')">` : ''}<span class="bk-cover-fallback">📖</span>
        ${sc >= 60 ? `<span class="bk-score">${sc}</span>` : ''}${isAward(b) ? '<span class="bk-award" title="Clássico/Prémio">🏆</span>' : ''}</div>
      <div class="bk-card-body">
        <div class="bk-title">${esc(b.title)}</div>
        <div class="bk-author">${esc((b.authors || [])[0] || '')}</div>
        <div class="bk-meta">${b.ratingAvg ? `<span class="bk-star">★ ${b.ratingAvg.toFixed(1)}</span>` : ''}${b.want ? `<span class="bk-want">👥 ${fmtN(b.want)}</span>` : ''}</div>
      </div>
    </button>`;
  }
  const fmtN = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : '' + n;
  function skeletonRail() { return `<div class="bk-rail-track">${Array.from({ length: 6 }, () => '<div class="bk-card bk-skel"><div class="bk-cover"></div><div class="bk-card-body"><div class="bk-skline"></div><div class="bk-skline sm"></div></div></div>').join('')}</div>`; }

  /* rails with hover arrows (same UX as the other discovery sections) */
  function railShell(emoji, title, sub, id) {
    return `<section class="bk-rail" id="rail-${id}">
      <div class="bk-rail-hd"><h2>${emoji} ${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <div class="bk-rail-wrap"><button class="bk-rail-nav prev" aria-label="‹" hidden>‹</button>
        <div class="bk-rail-body">${skeletonRail()}</div>
        <button class="bk-rail-nav next" aria-label="›" hidden>›</button></div></section>`;
  }
  function fillRail(id, books, emptyMsg) {
    const sec = _root.querySelector('#rail-' + id); if (!sec) return;
    const body = sec.querySelector('.bk-rail-body');
    if (!books || !books.length) { sec.style.display = 'none'; return; }
    body.innerHTML = `<div class="bk-rail-track">${books.map(bookCard).join('')}</div>`;
    wireBooks(body); wireOneRail(sec);
  }
  function wireOneRail(wrap) {
    const track = wrap.querySelector('.bk-rail-track'), prev = wrap.querySelector('.prev'), next = wrap.querySelector('.next');
    if (!track) return;
    const sync = () => { const max = track.scrollWidth - track.clientWidth - 2; prev.hidden = track.scrollLeft <= 2; next.hidden = track.scrollLeft >= max; };
    const step = () => Math.max(240, Math.round(track.clientWidth * 0.8));
    prev.onclick = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
    next.onclick = () => track.scrollBy({ left: step(), behavior: 'smooth' });
    track.addEventListener('scroll', sync, { passive: true }); requestAnimationFrame(sync);
  }

  /* ════════════════════════ HUB ════════════════════════ */
  /* category bar shared with Gaming — lets the user switch within Product Discovery */
  function catBar() {
    return `<div class="dc-cats">
      <button class="dc-cat" data-go="discovery/gaming"><span>🎮</span>Gaming</button>
      <button class="dc-cat on" data-go="discovery/books"><span>📚</span>${_t('Books', 'Livros')}</button>
    </div>`;
  }
  function wireCats() { _root.querySelectorAll('.dc-cat[data-go]').forEach(el => el.onclick = () => { location.hash = el.dataset.go; }); }

  function renderHub() {
    _root.innerHTML = `<div class="bk-wrap">
      <header class="bk-hero">
        <h1>📚 ${_t('Books', 'Livros')}</h1>
        <p>${_t('A library of discovery — explore by area, age and interest, ranked by real popularity.', 'Uma biblioteca de descoberta — explora por área, idade e interesse, ordenado por popularidade real.')}</p>
        <label class="bk-search"><span aria-hidden="true">🔍</span><input id="bk-q" type="search" placeholder="${_t('Search any book…', 'Pesquisar qualquer livro…')}" autocomplete="off"></label>
        <div class="bk-meta">${_t('Live data from Open Library', 'Dados ao vivo da Open Library')}</div>
      </header>
      ${catBar()}
      <div class="bk-areas">${TAXONOMY.map(areaCard).join('')}</div>
    </div>`;
    wireCats();
    const q = _root.querySelector('#bk-q');
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) { _filters = { q: q.value.trim() }; location.hash = 'discovery/books/search'; } });
    _root.querySelectorAll('[data-leaf]').forEach(el => el.onclick = () => { location.hash = 'discovery/books/' + el.dataset.leaf; });
  }
  function areaCard(a) {
    const chips = a.groups.map(g => `${g.label ? `<span class="bk-grp-lbl">${esc(g.label)}</span>` : ''}${g.leaves.map(l => `<button class="bk-leaf-chip" data-leaf="${esc(l.id)}">${esc(l.label)}</button>`).join('')}`).join('');
    return `<section class="bk-area"><div class="bk-area-hd"><span class="bk-area-em">${a.emoji}</span><h2>${esc(_lang() === 'en' ? a.label_en : a.label)}</h2></div><div class="bk-leaves">${chips}</div></section>`;
  }

  /* ════════════════════════ LEAF (5 rails, live) ════════════════════════ */
  function renderLeaf(leafId) {
    const leaf = LEAVES[leafId]; if (!leaf) { renderHub(); return; }
    const area = leaf.area;
    const siblings = area.groups.flatMap(g => g.leaves);
    _root.innerHTML = `<div class="bk-wrap">
      <div class="bk-topbar"><button class="bk-back" id="bk-back">← ${_t('Library', 'Biblioteca')}</button>
        <div class="bk-crumb">${area.emoji} ${esc(_lang() === 'en' ? area.label_en : area.label)} <span>›</span> <b>${esc(leaf.label)}</b></div></div>
      <div class="bk-chips">${siblings.map(l => `<button class="bk-chip${l.id === leafId ? ' on' : ''}" data-leaf="${esc(l.id)}">${esc(l.label)}</button>`).join('')}</div>
      ${(CURATED[leafId] || []).length ? railShell('📌', _t('Essentials', 'Essenciais'), _t('The best-known, recommended first', 'Os mais conhecidos, recomendados primeiro'), 'cur') : ''}
      ${railShell('⭐', _t('Most popular', 'Mais populares'), _t('Most-read in this topic', 'Os mais lidos neste tema'), 'pop')}
      ${railShell('🏆', _t('Must-read classics', 'Clássicos obrigatórios'), _t('Stood the test of time', 'Resistiram ao tempo'), 'classic')}
      ${railShell('🔥', _t('Trending', 'Tendências'), _t('Recent and rising', 'Recentes e a subir'), 'trend')}
      ${railShell('🆕', _t('New releases', 'Novidades'), _t('Just published', 'Acabados de publicar'), 'new')}
      ${railShell('🎲', _t('Discover more', 'Descobrir outros'), _t('Beyond the obvious', 'Para além do óbvio'), 'disc')}
    </div>`;
    _root.querySelector('#bk-back').onclick = () => { location.hash = 'discovery/books'; };
    _root.querySelectorAll('.bk-chip[data-leaf]').forEach(el => el.onclick = () => { location.hash = 'discovery/books/' + el.dataset.leaf; });

    const q = leaf.q;
    // curated reference books FIRST (precise lookups), then dynamic discovery
    const curated = CURATED[leafId] || [];
    if (curated.length) {
      Promise.all(curated.map(c => BooksData.lookup(c.t, c.a).catch(() => null)))
        .then(bs => {
          const seen = new Set();
          const list = bs.filter(b => b && b.id && !seen.has(b.id) && seen.add(b.id)).map(withScore);
          fillRail('cur', list);
        }).catch(() => fillRail('cur', []));
    }
    // fire the dynamic rails live (each cached independently)
    load('pop', () => BooksData.search(q, { sort: 'readinglog', limit: 24 }).then(rankPop));
    load('classic', () => BooksData.search(q, { sort: 'editions', limit: 24 }).then(bs => bs.filter(b => b.ratingCount >= 5 || b.editions >= 8).slice(0, 20)));
    load('new', () => BooksData.search(q, { sort: 'new', limit: 24 }).then(bs => bs.filter(b => b.year >= YEAR - 6)));
    load('trend', () => BooksData.search(`${q} AND first_publish_year:[${YEAR - 4} TO ${YEAR}]`, { sort: 'readinglog', limit: 20 }).then(rankPop));
    load('disc', () => BooksData.search(q, { sort: 'readinglog', limit: 50, page: 2 }).then(bs => shuffle(bs).slice(0, 20).map(withScore)));
  }
  const withScore = b => (b.score = score(b), b);
  const rankPop = bs => bs.map(withScore).sort((a, b) => b.score - a.score).slice(0, 20);
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
  function load(railId, fn) { fn().then(bs => fillRail(railId, bs)).catch(() => fillRail(railId, [])); }

  /* ════════════════════════ SEARCH ════════════════════════ */
  function renderSearch() {
    const q0 = (_filters && _filters.q) || '';
    _root.innerHTML = `<div class="bk-wrap">
      <div class="bk-topbar"><button class="bk-back" id="bk-back">← ${_t('Library', 'Biblioteca')}</button>
        <label class="bk-search" style="flex:1"><span aria-hidden="true">🔍</span><input id="bk-q" type="search" value="${esc(q0)}" placeholder="${_t('Search…', 'Pesquisar…')}" autocomplete="off"></label></div>
      <div class="bk-count" id="bk-count"></div>
      <div class="bk-grid" id="bk-grid">${q0 ? skeletonRail() : `<div class="bk-empty">${_t('Type to search.', 'Escreve para pesquisar.')}</div>`}</div>
    </div>`;
    const input = _root.querySelector('#bk-q'); input.focus();
    let t; const run = () => {
      const q = input.value.trim(); if (!q) { _root.querySelector('#bk-grid').innerHTML = `<div class="bk-empty">${_t('Type to search.', 'Escreve para pesquisar.')}</div>`; _root.querySelector('#bk-count').textContent = ''; return; }
      _root.querySelector('#bk-grid').innerHTML = skeletonRail();
      BooksData.search(q, { sort: 'readinglog', limit: 40 }).then(bs => {
        bs = bs.map(withScore).sort((a, b) => b.score - a.score);
        _root.querySelector('#bk-count').textContent = `${bs.length} ${_t('results', 'resultados')}`;
        _root.querySelector('#bk-grid').innerHTML = bs.length ? `<div class="bk-grid-in">${bs.map(bookCard).join('')}</div>` : `<div class="bk-empty">${_t('No results.', 'Sem resultados.')}</div>`;
        wireBooks(_root);
      }).catch(() => { _root.querySelector('#bk-grid').innerHTML = `<div class="bk-empty">⚠ ${_t('Search failed.', 'Pesquisa falhou.')}</div>`; });
    };
    _root.querySelector('#bk-back').onclick = () => { location.hash = 'discovery/books'; };
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 350); });
    if (q0) run();
  }

  /* ════════════════════════ BOOK DETAIL ════════════════════════ */
  function renderDetail(olid) {
    _root.innerHTML = `<div class="bk-wrap"><div class="bk-topbar"><button class="bk-back" id="bk-back">← ${_t('Back', 'Voltar')}</button></div><div class="bk-loading"><div class="ex-loading-spinner"></div></div></div>`;
    _root.querySelector('#bk-back').onclick = () => { if (history.length > 1) history.back(); else location.hash = 'discovery/books'; };
    BooksData.work(olid).then(async w => {
      if (!w) { _root.querySelector('.bk-loading').outerHTML = `<div class="bk-empty">${_t('Book not found.', 'Livro não encontrado.')}</div>`; return; }
      const title = w.title || '';
      const authors = (w.authors || []).map(a => a.author?.key).filter(Boolean);
      const coverId = (w.covers || [])[0];
      const subjects = (w.subjects || []).slice(0, 8);
      let desc = typeof w.description === 'string' ? w.description : (w.description?.value || '');
      desc = desc.replace(/\[?\(?https?:\/\/\S+\)?\]?/g, '').replace(/[-=]{3,}.*/s, '').trim();
      const authorName = await BooksData.entity(authors[0]).then(a => a?.name).catch(() => null);
      if (!desc) { const gb = await BooksData.gbDescription(title, authorName); if (gb) desc = gb; }
      const buyQ = title + (authorName ? ' ' + authorName : '');
      const cover = coverId ? BooksData.coverUrl(coverId, 'L') : '';
      _root.querySelector('.bk-wrap').innerHTML = `
        <div class="bk-topbar"><button class="bk-back" id="bk-back2">← ${_t('Back', 'Voltar')}</button></div>
        <article class="bk-detail">
          <div class="bk-d-cover">${cover ? `<img src="${cover}" alt="" onerror="this.style.display='none'">` : '📖'}</div>
          <div class="bk-d-main">
            <h1>${esc(title)}</h1>
            ${authorName ? `<div class="bk-d-author">${esc(authorName)}</div>` : ''}
            <div class="bk-d-tags">${subjects.map(s => `<span class="bk-tag">${esc(s)}</span>`).join('')}</div>
            ${desc ? `<p class="bk-d-desc">${esc(desc).slice(0, 900)}</p>` : `<p class="bk-d-desc bk-muted">${_t('No description available.', 'Sem descrição disponível.')}</p>`}
            <div class="bk-d-buy"><span class="bk-buy-lbl">🛒 ${_t('Find it at', 'Comprar em')}:</span>${STORES.map(s => `<a class="bk-buy" href="${s.url(buyQ)}" target="_blank" rel="noopener">${s.name}</a>`).join('')}</div>
            <a class="bk-ol-link" href="https://openlibrary.org/works/${esc(olid)}" target="_blank" rel="noopener">${_t('View on Open Library', 'Ver na Open Library')} ↗</a>
          </div>
        </article>
        <section class="bk-rail" id="rail-similar"><div class="bk-rail-hd"><h2>🔗 ${_t('Similar books', 'Livros semelhantes')}</h2></div>
          <div class="bk-rail-wrap"><button class="bk-rail-nav prev" aria-label="‹" hidden>‹</button><div class="bk-rail-body">${skeletonRail()}</div><button class="bk-rail-nav next" aria-label="›" hidden>›</button></div></section>`;
      _root.querySelector('#bk-back2').onclick = () => { if (history.length > 1) history.back(); else location.hash = 'discovery/books'; };
      if (subjects[0]) BooksData.search('subject:' + JSON.stringify(subjects[0]).replace(/"/g, ''), { sort: 'readinglog', limit: 14 })
        .then(bs => fillRail('similar', bs.map(withScore).filter(b => b.id !== olid).slice(0, 12))).catch(() => fillRail('similar', []));
      else fillRail('similar', []);
    }).catch(() => { const l = _root.querySelector('.bk-loading'); if (l) l.outerHTML = `<div class="bk-empty">⚠ ${_t('Could not load the book.', 'Não foi possível carregar o livro.')}</div>`; });
  }

  function wireBooks(scope) { (scope || _root).querySelectorAll('[data-book]').forEach(el => el.onclick = () => { location.hash = 'discovery/books/b/' + el.dataset.book; }); }

  /* ════════════════════════ PUBLIC ════════════════════════ */
  function show(sub) {
    _root = document.getElementById('view-discovery'); if (!_root) return;   // Books is a category of Product Discovery
    if (!sub) { renderHub(); return; }
    if (sub === 'search') { renderSearch(); return; }
    if (sub.startsWith('b/')) { renderDetail(sub.slice(2)); return; }
    if (LEAVES[sub]) { renderLeaf(sub); return; }
    renderHub();
  }
  return { show };
})();
