/* ══════════════════════════════════════════════════════════════════
   curated-sources.mjs — GENERATED, then hand-maintained.

   The source list for Notícias AI (V2). Unlike feeds.opml, the unit here
   is the SITE, not the feed URL: a feed is only a hint about where that
   site's articles can be found today. curated-fetch.mjs resolves each
   site through a chain (known feed → autodiscovery → news sitemap), so
   a publisher that drops RSS, moves its feed or renames a path keeps
   working without anyone editing this file.

   To add a source: append { name, site } to the right theme. The feed is
   optional — leave it out and it will be discovered.
   To remove one: delete the line.

   Derived from data/news/feeds.opml on 2026-08-23; V1 still reads the
   OPML and is unaffected by anything here.
══════════════════════════════════════════════════════════════════ */

export const SOURCES = {
  portugal: [
    { name: 'SIC Notícias',                    site: 'https://sicnoticias.pt', feed: 'http://feeds.feedburner.com/sicnoticias-ultimas', pt: true, },
    { name: 'Diário de Notícias',              site: 'https://www.dn.pt', feed: 'https://www.dn.pt/feed/', pt: true, },
    { name: 'RTP Notícias / Geral / Últimas',  site: 'https://www.rtp.pt', feed: 'http://www.rtp.pt/noticias/rss', pt: true, },
    { name: 'Expresso',                        site: 'https://expresso.pt', feed: 'http://feeds.feedburner.com/expresso-geral', pt: true, },
    { name: 'Região de Leiria',                site: 'https://www.regiaodeleiria.pt', feed: 'http://feeds.feedburner.com/RegiodeLeiria', pt: true, },
  ],
  mundo: [
    { name: 'The Guardian — World',  site: 'https://www.theguardian.com/world', feed: 'https://www.theguardian.com/world/rss', },
    { name: 'BBC News',              site: 'https://www.bbc.co.uk/news/world/europe', feed: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', },
    { name: 'Euronews',              site: 'http://www.euronews.com', feed: 'http://feeds.feedburner.com/euronews/en/home/', },
  ],
  tecnologia: [
    { name: 'MakeUseOf - Technology News',    site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/news/feed/', },
    { name: 'MakeUseOf - Internet',           site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/web-based/feed/', },
    { name: 'MakeUseOf - Windows',            site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/windows/feed/', },
    { name: 'MakeUseOf - Linux',              site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/linux/feed/', },
    { name: 'Pplware',                        site: 'https://pplware.sapo.pt', feed: 'http://pplware.sapo.pt/feed/', pt: true, },
    { name: 'MaisTecnologia',                 site: 'https://www.maistecnologia.com', feed: 'https://www.maistecnologia.com/feed/', pt: true, },
    { name: 'Leak',                           site: 'https://www.leak.pt', feed: 'http://feeds.feedburner.com/leak/jOFQ', pt: true, },
    { name: 'Tek Notícias',                   site: 'https://tek.sapo.pt', feed: 'http://tek.sapo.pt/rss', pt: true, },
    { name: 'PCGuia',                         site: 'https://www.pcguia.pt', feed: 'http://www.pcguia.pt/feed/', pt: true, },
    { name: 'Minuto Digital',                 site: 'https://minutodigital.pt', feed: 'https://minutodigital.pt/feed/', pt: true, },
    { name: 'Xa das 5',                       site: 'https://xadas5.com', feed: 'http://xadas5.com/feed/', pt: true, },
    { name: 'A tecnologia está do teu lado',  site: 'https://4gnews.pt', feed: 'http://www.4gnews.pt/feed/', pt: true, },
    { name: 'XDA',                            site: 'https://www.xda-developers.com', feed: 'http://www.xda-developers.com/feed/', },
    { name: 'ZDNet',                          site: 'https://www.zdnet.com', feed: 'http://www.zdnet.com/news/rss.xml', },
    { name: 'Forbes - Innovation',            site: 'https://www.forbes.com/innovation', feed: 'http://www.forbes.com/innovation/feed2/', },
    { name: 'TechCrunch',                     site: 'https://techcrunch.com', feed: 'https://techcrunch.com/feed/', },
    { name: 'The Verge',                      site: 'https://www.theverge.com', feed: 'https://www.theverge.com/rss/index.xml', },
    { name: 'Ars Technica',                   site: 'https://arstechnica.com', feed: 'https://feeds.arstechnica.com/arstechnica/index', },
    { name: 'HowToGeek',                      site: 'https://www.howtogeek.com', feed: 'https://www.howtogeek.com/feed/', },
  ],
  ia: [
    { name: 'Simon Willison',    site: 'https://simonwillison.net', feed: 'https://simonwillison.net/atom/everything/', },
    { name: 'OpenAI',            site: 'https://openai.com', feed: 'https://openai.com/news/rss.xml', },
    { name: 'Google DeepMind',   site: 'https://deepmind.google', feed: 'https://deepmind.google/blog/rss.xml', },
    { name: 'Latent Space',      site: 'https://www.latent.space', feed: 'https://www.latent.space/feed.xml', },
    { name: 'One Useful Thing',  site: 'https://www.oneusefulthing.org', feed: 'https://www.oneusefulthing.org/feed', },
    { name: 'Future Tools',      site: 'https://www.futuretools.io', feed: 'https://www.futuretools.io/news/rss.xml', },
  ],
  seguranca: [
    { name: 'The Hacker News',    site: 'https://thehackernews.com', feed: 'http://thehackernews.com/feeds/posts/default', },
    { name: 'Krebs on Security',  site: 'https://krebsonsecurity.com', feed: 'https://krebsonsecurity.com/feed/', },
    { name: 'BleepingComputer',   site: 'https://www.bleepingcomputer.com', feed: 'https://www.bleepingcomputer.com/feed/', },
    { name: 'Dark Reading',       site: 'https://www.darkreading.com', feed: 'https://www.darkreading.com/rss.xml', },
  ],
  /* Reworked 2026-08-23 after the quality audit. The theme was producing
     2 curated stories from 31 candidates, and 29 of those 31 came from
     two sources that do not publish news: `DevOps on Medium` (a tag feed
     of tutorials — "How to Install Docker Desktop") and `Reddit —
     selfhosted` (discussion threads — "Why Proxmox?"). Both are dropped.

     Replacements were chosen by measured publication RATE, not just by
     reachability, because a 24h window never sees a weekly blog. Rates
     over the 7 days to 2026-08-23: The Register 5.7/day, The New Stack
     3.7, InfoWorld 2.9, Data Center Dynamics 2.9, Google Cloud 2.3.
     Rejected after measuring: Techmeme (an aggregator of these same
     outlets — it would duplicate every story), InfoQ DevOps/Cloud (0 and
     0.1/day), SDxCentral (feed does not resolve), and the vendor blogs
     Kubernetes/HashiCorp/Docker/Grafana/GitLab/Red Hat (all under
     1.5/day, and mostly release notes the prompt rejects anyway). */
  devops: [
    { name: 'The Register',                       site: 'https://www.theregister.com', feed: 'https://www.theregister.com/headlines.atom', },
    { name: 'The New Stack',                      site: 'https://thenewstack.io', feed: 'http://thenewstack.io/feed/', },
    { name: 'InfoWorld',                          site: 'https://www.infoworld.com', },
    { name: 'Data Center Dynamics',               site: 'https://www.datacenterdynamics.com', feed: 'https://www.datacenterdynamics.com/en/rss/', },
    { name: 'DevOps.com',                         site: 'https://devops.com', feed: 'http://devops.com/feed/', },
    { name: 'Google Cloud Blog',                  site: 'https://cloud.google.com/blog', feed: 'https://cloudblog.withgoogle.com/rss/', },
    { name: 'Cloud Native Now',                   site: 'https://cloudnativenow.com', feed: 'http://containerjournal.com/feed/', },
    { name: 'Platform Engineering',               site: 'https://platformengineering.org', feed: 'https://platformengineering.org/blog/rss.xml', },
    { name: 'Cloud Native Computing Foundation',  site: 'https://www.cncf.io', feed: 'https://www.cncf.io/feed', },
  ],
  android: [
    { name: 'MakeUseOf - Android',  site: 'https://www.makeuseof.com', feed: 'http://www.makeuseof.com/service/google-android/feed/', },
    { name: '9to5Google',           site: 'https://9to5google.com', feed: 'http://9to5google.com/feed/', },
    { name: 'Android Police',       site: 'https://www.androidpolice.com', feed: 'http://www.androidpolice.com/feed/', },
    { name: 'AndroidGeek',          site: 'https://androidgeek.pt', feed: 'https://androidgeek.pt/feed/', pt: true, },
    { name: 'Android Authority',    site: 'https://www.androidauthority.com', feed: 'http://feeds.feedburner.com/androidauthority', },
  ],
  produtividade: [
    { name: 'MakeUseOf - Productivity',  site: 'https://www.makeuseof.com', feed: 'https://www.makeuseof.com/feed/category/productivity/', },
    { name: 'Lifehacker',                site: 'https://lifehacker.com', feed: 'https://lifehacker.com/rss', },
  ],
  ciencia: [
    { name: 'ScienceDaily',   site: 'https://www.sciencedaily.com', feed: 'https://www.sciencedaily.com/rss/all.xml', },
    { name: 'Nature',         site: 'https://www.nature.com', feed: 'https://www.nature.com/nature.rss', },
    { name: 'New Scientist',  site: 'https://www.newscientist.com', feed: 'https://www.newscientist.com/feed/home/', },
  ],
  economia: [
    { name: 'Contas Poupança',       site: 'https://contaspoupanca.pt', feed: 'https://rss.impresa.pt/feed/latest/contaspoupanca.rss', pt: true, },
    { name: 'Jornal de Negócios',    site: 'https://www.jornaldenegocios.pt', feed: 'https://www.jornaldenegocios.pt/rss', pt: true, },
    { name: 'Literacia Financeira',  site: 'https://www.literaciafinanceira.pt', pt: true, },
  ],
  automovel: [
    { name: 'Razão Automóvel',  site: 'https://www.razaoautomovel.com', feed: 'http://razaoautomovel.com/feed', pt: true, },
    { name: 'Autoblog',         site: 'http://www.autoblog.pt', feed: 'http://feeds.feedburner.com/autoblogpt', pt: true, },
    { name: 'AutoSport',        site: 'https://www.autosport.pt', feed: 'http://www.autosport.pt/feed/', pt: true, },
    { name: 'Latest F1 News',   site: 'https://www.formula1.com', feed: 'https://www.formula1.com/content/fom-website/en/latest/all.xml', },
    /* Motor24 removido 2026-08-23. O domínio continua de pé, mas o feed
       passou a servir a redação generalista do grupo (Diário de Notícias):
       dos 4 artigos devolvidos, 0 eram automóveis — futebol, dívida dos
       EUA, política. O sitemap de recurso resolve literalmente para
       dn.pt/news_sitemap.xml. Não é uma fonte de automóveis, e injetava no
       tema `automovel` cópias do que `portugal` já cobre. Fica no
       feeds.opml do V1, que é uma lista cronológica e não é afetado. */
    { name: 'What Car?',        site: 'https://www.whatcar.com', feed: 'https://www.whatcar.com/rss', },
    { name: 'InsideEVs',        site: 'https://insideevs.com', feed: 'https://insideevs.com/rss/articles/all/', },
  ],
  gaming: [
    { name: 'IGN Portugal',  site: 'https://pt.ign.com', feed: 'http://pt.ign.com/feed.xml', pt: true, },
    { name: 'Eurogamer.pt',  site: 'https://www.eurogamer.pt', feed: 'https://www.eurogamer.pt/feed', pt: true, },
  ],
  filmes: [
    { name: 'MovieWeb',                 site: 'https://movieweb.com', feed: 'https://movieweb.com/feed/', },
    { name: '/Film',                    site: 'https://www.slashfilm.com', feed: 'https://www.slashfilm.com/feed/', },
    { name: 'ScreenRant',               site: 'https://screenrant.com', feed: 'https://screenrant.com/feed/', },
    { name: 'Aberto até de Madrugada',  site: 'https://abertoatedemadrugada.com', feed: 'https://abertoatedemadrugada.com/feeds/posts/default?alt=rss', pt: true, },
  ],
};
