/* ══════════════════════════════════════════════════════════════════
   sources.mjs — THE source list. One record per source, read by both
   consumers of the news pipeline:

     topic   which tab the article lands in under Notícias ▸ Todas
     theme   which Destaques theme it feeds, or null when the source is
             deliberately not curated (a format rather than a subject, or
             one removed from curation on quality grounds)

   Before this file there were two lists — feeds.opml + the SRC map for
   V1, curated-sources.mjs for V2 — which meant two parsers, two resolver
   paths and the same Blogger bug fixed twice. feeds.opml is kept as the
   original Feedly import for reference; nothing reads it any more.

   The unit is the SITE, not the feed URL: `feed` is a hint about where a
   site's articles are today. acquire.mjs resolves each source through a
   chain (known feed → autodiscovery → news sitemap → search), so a
   publisher that drops RSS or moves a path keeps working untouched.

   To add a source: append a record to the right topic block. `feed` is
   optional — leave it out and it will be discovered.
══════════════════════════════════════════════════════════════════ */

export const SOURCES = [
  /* ── geral ── */
  { name: 'Diário de Notícias', site: 'https://www.dn.pt', feed: 'https://www.dn.pt/feed/', topic: 'geral', theme: 'portugal', pt: true },
  { name: 'Expresso', site: 'https://expresso.pt', feed: 'http://feeds.feedburner.com/expresso-geral', topic: 'geral', theme: 'portugal', pt: true },
  { name: 'Região de Leiria', site: 'https://www.regiaodeleiria.pt', feed: 'http://feeds.feedburner.com/RegiodeLeiria', topic: 'geral', theme: 'portugal', pt: true },
  { name: 'RTP Notícias / Geral / Últimas', site: 'https://www.rtp.pt', feed: 'http://www.rtp.pt/noticias/rss', topic: 'geral', theme: 'portugal', pt: true },
  { name: 'SIC Notícias', site: 'https://sicnoticias.pt', feed: 'http://feeds.feedburner.com/sicnoticias-ultimas', topic: 'geral', theme: 'portugal', pt: true },

  /* ── mundo ── */
  { name: 'BBC News', site: 'https://www.bbc.co.uk/news/world/europe', feed: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', topic: 'mundo', theme: 'mundo' },
  { name: 'Euronews', site: 'http://www.euronews.com', feed: 'http://feeds.feedburner.com/euronews/en/home/', topic: 'mundo', theme: 'mundo' },
  { name: 'The Guardian — World', site: 'https://www.theguardian.com/world', feed: 'https://www.theguardian.com/world/rss', topic: 'mundo', theme: 'mundo' },

  /* ── tecnologia ── */
  { name: 'A tecnologia está do teu lado', site: 'https://4gnews.pt', feed: 'http://www.4gnews.pt/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'Ars Technica', site: 'https://arstechnica.com', feed: 'https://feeds.arstechnica.com/arstechnica/index', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'Forbes - Innovation', site: 'https://www.forbes.com/innovation', feed: 'http://www.forbes.com/innovation/feed2/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'HowToGeek', site: 'https://www.howtogeek.com', feed: 'https://www.howtogeek.com/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'Leak', site: 'https://www.leak.pt', feed: 'http://feeds.feedburner.com/leak/jOFQ', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'MaisTecnologia', site: 'https://www.maistecnologia.com', feed: 'https://www.maistecnologia.com/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'MakeUseOf - Internet', site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/web-based/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'MakeUseOf - Linux', site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/linux/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'MakeUseOf - Technology News', site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/news/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'MakeUseOf - Windows', site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/windows/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'Minuto Digital', site: 'https://minutodigital.pt', feed: 'https://minutodigital.pt/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'PCGuia', site: 'https://www.pcguia.pt', feed: 'http://www.pcguia.pt/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'Pplware', site: 'https://pplware.sapo.pt', feed: 'http://pplware.sapo.pt/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'TechCrunch', site: 'https://techcrunch.com', feed: 'https://techcrunch.com/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'Tek Notícias', site: 'https://tek.sapo.pt', feed: 'http://tek.sapo.pt/rss', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'The Verge', site: 'https://www.theverge.com', feed: 'https://www.theverge.com/rss/index.xml', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'Xa das 5', site: 'https://xadas5.com', feed: 'http://xadas5.com/feed/', topic: 'tecnologia', theme: 'tecnologia', pt: true },
  { name: 'XDA', site: 'https://www.xda-developers.com', feed: 'http://www.xda-developers.com/feed/', topic: 'tecnologia', theme: 'tecnologia' },
  { name: 'ZDNet', site: 'https://www.zdnet.com', feed: 'http://www.zdnet.com/news/rss.xml', topic: 'tecnologia', theme: 'tecnologia' },

  /* ── ia ── */
  { name: 'Future Tools', site: 'https://www.futuretools.io', feed: 'https://www.futuretools.io/news/rss.xml', topic: 'ia', theme: 'ia' },
  { name: 'Google DeepMind', site: 'https://deepmind.google', feed: 'https://deepmind.google/blog/rss.xml', topic: 'ia', theme: 'ia' },
  { name: 'Latent Space', site: 'https://www.latent.space', feed: 'https://www.latent.space/feed.xml', topic: 'ia', theme: 'ia' },
  { name: 'One Useful Thing', site: 'https://www.oneusefulthing.org', feed: 'https://www.oneusefulthing.org/feed', topic: 'ia', theme: 'ia' },
  { name: 'OpenAI', site: 'https://openai.com', feed: 'https://openai.com/news/rss.xml', topic: 'ia', theme: 'ia' },
  { name: 'Simon Willison', site: 'https://simonwillison.net', feed: 'https://simonwillison.net/atom/everything/', topic: 'ia', theme: 'ia' },

  /* ── tldr ── */
  { name: 'TLDR AI', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/ai', topic: 'tldr', theme: null },
  { name: 'TLDR Data', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/data', topic: 'tldr', theme: null },
  { name: 'TLDR DevOps', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/devops', topic: 'tldr', theme: null },
  { name: 'TLDR IT', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/it', topic: 'tldr', theme: null },
  { name: 'TLDR Tech', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/tech', topic: 'tldr', theme: null },

  /* ── seguranca ── */
  { name: 'BleepingComputer', site: 'https://www.bleepingcomputer.com', feed: 'https://www.bleepingcomputer.com/feed/', topic: 'seguranca', theme: 'seguranca' },
  { name: 'Dark Reading', site: 'https://www.darkreading.com', feed: 'https://www.darkreading.com/rss.xml', topic: 'seguranca', theme: 'seguranca' },
  { name: 'Help Net Security', site: 'https://www.helpnetsecurity.com', feed: 'https://www.helpnetsecurity.com/feed/', topic: 'seguranca', theme: 'seguranca' },
  { name: 'Infosecurity Magazine', site: 'https://www.infosecurity-magazine.com', feed: 'https://www.infosecurity-magazine.com/rss/news/', topic: 'seguranca', theme: 'seguranca' },
  { name: 'Krebs on Security', site: 'https://krebsonsecurity.com', feed: 'https://krebsonsecurity.com/feed/', topic: 'seguranca', theme: 'seguranca' },
  { name: 'SecurityWeek', site: 'https://www.securityweek.com', feed: 'https://www.securityweek.com/feed/', topic: 'seguranca', theme: 'seguranca' },
  { name: 'The Hacker News', site: 'https://thehackernews.com', feed: 'http://thehackernews.com/feeds/posts/default', topic: 'seguranca', theme: 'seguranca' },
  { name: 'The Record', site: 'https://therecord.media', feed: 'https://therecord.media/feed', topic: 'seguranca', theme: 'seguranca' },

  /* ── devops ── */
  { name: 'Cloud Native Computing Foundation', site: 'https://www.cncf.io', feed: 'https://www.cncf.io/feed', topic: 'devops', theme: 'devops' },
  { name: 'Cloud Native Now', site: 'https://cloudnativenow.com', feed: 'http://containerjournal.com/feed/', topic: 'devops', theme: 'devops' },
  { name: 'Data Center Dynamics', site: 'https://www.datacenterdynamics.com', feed: 'https://www.datacenterdynamics.com/en/rss/', topic: 'devops', theme: 'devops' },
  { name: 'DevOps on Medium', site: 'https://medium.com/tag/devops', feed: 'https://medium.com/feed/tag/devops', topic: 'devops', theme: null },
  { name: 'DevOps.com', site: 'https://devops.com', feed: 'http://devops.com/feed/', topic: 'devops', theme: 'devops' },
  { name: 'Google Cloud Blog', site: 'https://cloud.google.com/blog', feed: 'https://cloudblog.withgoogle.com/rss/', topic: 'devops', theme: 'devops' },
  { name: 'InfoWorld', site: 'https://www.infoworld.com', topic: 'devops', theme: 'devops' },
  { name: 'Platform Engineering', site: 'https://platformengineering.org', feed: 'https://platformengineering.org/blog/rss.xml', topic: 'devops', theme: 'devops' },
  { name: 'Reddit — selfhosted', site: 'https://www.reddit.com/r/selfhosted', feed: 'https://www.reddit.com/r/selfhosted/.rss', topic: 'devops', theme: null },
  { name: 'The New Stack', site: 'https://thenewstack.io', feed: 'http://thenewstack.io/feed/', topic: 'devops', theme: 'devops' },
  { name: 'The Register', site: 'https://www.theregister.com', feed: 'https://www.theregister.com/headlines.atom', topic: 'devops', theme: 'devops' },

  /* ── android ── */
  { name: '9to5Google', site: 'https://9to5google.com', feed: 'http://9to5google.com/feed/', topic: 'android', theme: 'android' },
  { name: 'Android Authority', site: 'https://www.androidauthority.com', feed: 'http://feeds.feedburner.com/androidauthority', topic: 'android', theme: 'android' },
  { name: 'Android Police', site: 'https://www.androidpolice.com', feed: 'http://www.androidpolice.com/feed/', topic: 'android', theme: 'android' },
  { name: 'AndroidGeek', site: 'https://androidgeek.pt', feed: 'https://androidgeek.pt/feed/', topic: 'android', theme: 'android', pt: true },
  { name: 'MakeUseOf - Android', site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/google-android/feed/', topic: 'android', theme: 'android' },

  /* ── produtividade ── */
  { name: 'Lifehacker', site: 'https://lifehacker.com', feed: 'https://lifehacker.com/rss', topic: 'produtividade', theme: 'produtividade' },
  { name: 'MakeUseOf - Productivity', site: 'https://www.makeuseof.com', feed: 'https://www.makeuseof.com/feed/category/productivity/', topic: 'produtividade', theme: 'produtividade' },
  { name: 'MakeUseOf - Software', site: 'https://www.makeuseof.com', feed: 'https://www.makeuseof.com/feed/category/software/', topic: 'produtividade', theme: 'produtividade' },
  { name: 'Zapier Blog', site: 'https://zapier.com/blog', feed: 'https://zapier.com/blog/feeds/latest/', topic: 'produtividade', theme: 'produtividade' },

  /* ── ciencia ── */
  { name: 'Live Science', site: 'https://www.livescience.com', feed: 'https://www.livescience.com/feeds/all', topic: 'ciencia', theme: 'ciencia' },
  { name: 'Nature', site: 'https://www.nature.com', feed: 'https://www.nature.com/nature.rss', topic: 'ciencia', theme: 'ciencia' },
  { name: 'New Scientist', site: 'https://www.newscientist.com', feed: 'https://www.newscientist.com/feed/home/', topic: 'ciencia', theme: 'ciencia' },
  { name: 'Phys.org', site: 'https://phys.org', feed: 'https://phys.org/rss-feed/', topic: 'ciencia', theme: 'ciencia' },
  { name: 'Quanta Magazine', site: 'https://www.quantamagazine.org', feed: 'https://www.quantamagazine.org/feed/', topic: 'ciencia', theme: 'ciencia' },
  { name: 'ScienceDaily', site: 'https://www.sciencedaily.com', feed: 'https://www.sciencedaily.com/rss/all.xml', topic: 'ciencia', theme: 'ciencia' },
  { name: 'Scientific American', site: 'https://www.scientificamerican.com', feed: 'https://www.scientificamerican.com/platform/syndication/rss/', topic: 'ciencia', theme: 'ciencia' },
  { name: 'Space.com', site: 'https://www.space.com', feed: 'https://www.space.com/feeds/all', topic: 'ciencia', theme: 'ciencia' },

  /* ── economia ── */
  { name: 'Contas Poupança', site: 'https://contaspoupanca.pt', feed: 'https://rss.impresa.pt/feed/latest/contaspoupanca.rss', topic: 'economia', theme: 'economia', pt: true },
  { name: 'Jornal de Negócios', site: 'https://www.jornaldenegocios.pt', feed: 'https://www.jornaldenegocios.pt/rss', topic: 'economia', theme: 'economia', pt: true },
  { name: 'Literacia Financeira', site: 'https://www.literaciafinanceira.pt', topic: 'economia', theme: 'economia', pt: true, kind: 'scrape', page: 'https://www.literaciafinanceira.pt/artigos', match: '/artigos/[a-z0-9][a-z0-9-]{3,}$' },

  /* ── carros ── */
  { name: 'Autoblog', site: 'http://www.autoblog.pt', feed: 'http://feeds.feedburner.com/autoblogpt', topic: 'carros', theme: 'automovel', pt: true },
  { name: 'InsideEVs', site: 'https://insideevs.com', feed: 'https://insideevs.com/rss/articles/all/', topic: 'carros', theme: 'automovel' },
  { name: 'Motor24', site: 'https://www.motor24.pt', feed: 'https://www.motor24.pt/feed/', topic: 'carros', theme: null, pt: true },
  { name: 'Razão Automóvel', site: 'https://www.razaoautomovel.com', feed: 'http://razaoautomovel.com/feed', topic: 'carros', theme: 'automovel', pt: true },
  { name: 'What Car?', site: 'https://www.whatcar.com', feed: 'https://www.whatcar.com/rss', topic: 'carros', theme: 'automovel' },

  /* ── f1 ── */
  { name: 'AutoSport', site: 'https://www.autosport.pt', feed: 'http://www.autosport.pt/feed/', topic: 'f1', theme: 'automovel', pt: true },
  { name: 'Latest F1 News', site: 'https://www.formula1.com', feed: 'https://www.formula1.com/content/fom-website/en/latest/all.xml', topic: 'f1', theme: 'automovel' },

  /* ── gaming ── */
  { name: 'Eurogamer', site: 'https://www.eurogamer.net', feed: 'https://www.eurogamer.net/feed', topic: 'gaming', theme: 'gaming' },
  { name: 'Eurogamer.pt', site: 'https://www.eurogamer.pt', feed: 'https://www.eurogamer.pt/feed', topic: 'gaming', theme: 'gaming', pt: true },
  { name: 'IGN Portugal', site: 'https://pt.ign.com', feed: 'http://pt.ign.com/feed.xml', topic: 'gaming', theme: 'gaming', pt: true },
  { name: 'PC Gamer', site: 'https://www.pcgamer.com', feed: 'https://www.pcgamer.com/rss/', topic: 'gaming', theme: 'gaming' },
  { name: 'Polygon', site: 'https://www.polygon.com', feed: 'https://www.polygon.com/rss/index.xml', topic: 'gaming', theme: 'gaming' },
  { name: 'Rock Paper Shotgun', site: 'https://www.rockpapershotgun.com', feed: 'https://www.rockpapershotgun.com/feed', topic: 'gaming', theme: 'gaming' },

  /* ── filmes ── */
  { name: '/Film', site: 'https://www.slashfilm.com', feed: 'https://www.slashfilm.com/feed/', topic: 'filmes', theme: 'filmes' },
  { name: 'Aberto até de Madrugada', site: 'https://abertoatedemadrugada.com', feed: 'https://abertoatedemadrugada.com/feeds/posts/default?alt=rss', topic: 'filmes', theme: 'filmes', pt: true },
  { name: 'MovieWeb', site: 'https://movieweb.com', feed: 'https://movieweb.com/feed/', topic: 'filmes', theme: 'filmes' },
  { name: 'ScreenRant', site: 'https://screenrant.com', feed: 'https://screenrant.com/feed/', topic: 'filmes', theme: 'filmes' },

  /* ── factcheck ── */
  { name: 'EU vs Disinfo', site: 'https://euvsdisinfo.eu', feed: 'https://euvsdisinfo.eu/feed/', topic: 'factcheck', theme: null },
  { name: 'FactCheck.org', site: 'https://www.factcheck.org', feed: 'https://www.factcheck.org/feed/', topic: 'factcheck', theme: null },
  { name: 'Lusa — Combate Fake News', site: 'https://combatefakenews.lusa.pt', topic: 'factcheck', theme: null, pt: true, kind: 'scrape', page: 'https://combatefakenews.lusa.pt/', match: 'lusa\\.pt/[a-z0-9-]{55,}/?$', titlefrom: 'slug', datefrom: 'page' },
  { name: 'Polígrafo', site: 'https://poligrafo.sapo.pt', topic: 'factcheck', theme: null, pt: true, kind: 'scrape', page: 'https://poligrafo.sapo.pt/', match: '/fact-check/[a-z0-9-]{6,}', datefrom: 'page' },
  { name: 'Público — Prova dos Factos', site: 'https://www.publico.pt/prova-dos-factos', topic: 'factcheck', theme: null, pt: true, kind: 'scrape', page: 'https://www.publico.pt/prova-dos-factos', match: '/20[0-9]{2}/[0-9]{2}/[0-9]{2}/[a-z0-9/-]+[0-9]$', datefrom: 'url' },
  { name: 'Snopes', site: 'https://www.snopes.com', feed: 'https://www.snopes.com/feed/', topic: 'factcheck', theme: null },
];

/* Lookups the builders need. */
export const byTopic = (id) => SOURCES.filter(s => s.topic === id);
export const byTheme = (id) => SOURCES.filter(s => s.theme === id);
export const curated = () => SOURCES.filter(s => s.theme);
