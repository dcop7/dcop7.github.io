const I18n = (function () {
  'use strict';

  const T = {
    en: {
      // Nav
      'nav.home':'Home','nav.games':'Games','nav.links':'Useful Sites',
      'nav.tools':'Tools','nav.workout':'Workout','nav.media':'Entertainment',
      'nav.games.label':'Games','nav.links.label':'Useful Sites',
      // Games
      'game.hangman':'Hangman','game.runner':'Infinite Runner',
      'game.minesweeper':'Minesweeper','game.bomb':'Defuse Bomb',
      'game.memory':'Memory Cards','game.tictactoe':'Tic-tac-toe',
      'game.wordle':'Word of the Day','game.shooting':'Space Shooter',
      'game.reaction':'Reaction Test','game.neon':'Neon Drawing',
      // Header
      'hdr.search':'Search games, sites, sections…','hdr.lang':'PT',
      // Home widgets
      'home.fav.sites':'🌐 Favourite Sites',
      'home.fav.tools':'🔧 Favourite Tools',
      'home.fav.games':'🎮 Favourite Games',
      'home.world.times':'🕐 World Times',
      // Home daily content
      'home.quote':'💡 Daily Quote','home.riddle':'🤔 Daily Riddle',
      'home.joke':'😄 Daily Joke','home.reveal':'Show answer',
      'home.greet.morning':'Good morning! ☀️','home.greet.afternoon':'Good afternoon! 🌤️',
      'home.greet.evening':'Good evening! 🌙',
      // Weather labels
      'wx.next24':'Next 24 Hours','wx.forecast':'7-Day Forecast',
      'wx.map':'🌍 Real-Time Map','wx.now':'Now','wx.today':'Today',
      'wx.feels.cur':'Feels like:','wx.feels.hi':'Feels up to','wx.min':'Min',
      'wx.loading':'Loading weather…','wx.error':'Error loading weather.',
      'wx.wind':'Wind','wx.wind.max':'Max. Wind','wx.gusts':'Gusts',
      'wx.humidity':'Humidity','wx.pressure':'Pressure','wx.cloud':'Cloud Cover',
      'wx.uv':'UV Index','wx.precip':'Precipitation','wx.rain.prob':'Rain prob.',
      'wx.sunrise':'Sunrise','wx.sunset':'Sunset','wx.dir':'Direction',
      'wx.clouds':'Clouds',
      // Weather conditions
      'wc.0':'Clear','wc.1':'Mainly clear','wc.2':'Partly cloudy','wc.3':'Overcast',
      'wc.45':'Foggy','wc.48':'Icy fog','wc.51':'Light drizzle','wc.53':'Drizzle',
      'wc.55':'Heavy drizzle','wc.61':'Light rain','wc.63':'Rain','wc.65':'Heavy rain',
      'wc.71':'Light snow','wc.73':'Snow','wc.75':'Heavy snow',
      'wc.80':'Showers','wc.81':'Showers','wc.82':'Heavy showers',
      'wc.95':'Thunderstorm','wc.96':'Thunderstorm w/ hail','wc.99':'Severe thunderstorm',
      'wc.unknown':'Unknown',
      // Gauge ticks
      'gauge.wind.calm':'Calm','gauge.wind.light':'Light','gauge.wind.mod':'Moderate',
      'gauge.wind.strong':'Strong','gauge.wind.storm':'Storm',
      'gauge.hum.dry':'Dry','gauge.hum.ok':'Comfortable','gauge.hum.humid':'Humid',
      'gauge.hum.vhum':'Very Humid',
      'gauge.pres.vlow':'Very Low','gauge.pres.low':'Low',
      'gauge.pres.norm':'Normal','gauge.pres.high':'High',
      'gauge.cloud.clear':'Clear','gauge.cloud.pcloud':'Partly Cloudy',
      'gauge.cloud.mostcloud':'Mostly Cloudy','gauge.cloud.cloud':'Overcast',
      'gauge.uv.low':'Low','gauge.uv.mod':'Moderate','gauge.uv.high':'High',
      'gauge.uv.vhigh':'Very High','gauge.uv.extreme':'Extreme',
      'gauge.rain.none':'No rain','gauge.rain.light':'Light',
      'gauge.rain.mod':'Moderate','gauge.rain.heavy':'Heavy',
      // Popup alerts
      'alert.yellow':'Yellow','alert.orange':'Orange','alert.red':'Red',
      // Holidays
      'hol.nat':'🇵🇹 National Holidays','hol.mun':'🏛️ Municipal Holidays',
      'hol.nat.lbl':'National',
      // Media
      'md.title':'Entertainment','md.tv':'TV Episodes',
      'md.trailers':'Trailers','md.theaters':'PT Cinemas','md.digital':'Digital & Blu-ray',
      'md.last':'Last','md.days':'days','md.reload':'Reload',
      'md.comfortable':'Comfortable','md.compact':'Compact','md.ultracompact':'Ultra',
      'md.series':'Series','md.movie':'Film',
      'md.trailer':'Trailer','md.teaser':'Teaser','md.official':'Official',
      'md.cinemas':'PT Cinemas','md.digital2':'Digital',
      'md.noEp':'No episodes in the last {n} days.',
      'md.noTrailers':'No trailers found.','md.noMovies':'No movies found.',
      'md.noReleases':'No releases found.',
      'md.loadingEp':'Loading episodes…','md.loadingTr':'Loading trailers…',
      'md.loadingTh':'Loading movies…','md.loadingDg':'Loading releases…',
      'md.invalidKey':'Invalid TMDB key.',
      'md.freeNote':'General data — for PT dates, add your ',
      'md.freeNoteBtn':'free TMDB key',
      'md.tmdbTitle':'TMDB Key','md.tmdbOptional':'Optional',
      'md.tmdbDesc':'Unlocks precise PT cinema and digital release data. Completely free — just create a TMDB account.',
      'md.tmdbPh':'Paste API key here…','md.tmdbSave':'Save',
      'md.tmdbLink':'Get free key at themoviedb.org →',
      'md.tmdbNote':'Without a key, shows recent popular movies as fallback.',
    },
    pt: {
      // Nav
      'nav.home':'Início','nav.games':'Jogos','nav.links':'Sites Úteis',
      'nav.tools':'Ferramentas','nav.workout':'Treino','nav.media':'Entretenimento',
      'nav.games.label':'Jogos','nav.links.label':'Sites Úteis',
      // Games
      'game.hangman':'Jogo da Forca','game.runner':'Corredor Infinito',
      'game.minesweeper':'Campo de Minas','game.bomb':'Desarmar Bomba',
      'game.memory':'Memória','game.tictactoe':'Jogo do Galo',
      'game.wordle':'Palavra do Dia','game.shooting':'Space Shooter',
      'game.reaction':'Teste de Reação','game.neon':'Neon Drawing',
      // Header
      'hdr.search':'Pesquisar jogos, sites, secções…','hdr.lang':'EN',
      // Home widgets
      'home.fav.sites':'🌐 Sites Favoritos',
      'home.fav.tools':'🔧 Ferramentas Favoritas',
      'home.fav.games':'🎮 Jogos Favoritos',
      'home.world.times':'🕐 Horas Mundiais',
      // Home daily content
      'home.quote':'💡 Inspiração do Dia','home.riddle':'🤔 Adivinha do Dia',
      'home.joke':'😄 Piada do Dia','home.reveal':'Ver resposta',
      'home.greet.morning':'Bom dia! ☀️','home.greet.afternoon':'Boa tarde! 🌤️',
      'home.greet.evening':'Boa noite! 🌙',
      // Weather labels
      'wx.next24':'Próximas 24 Horas','wx.forecast':'Previsão 7 Dias',
      'wx.map':'🌍 Mapa em Tempo Real','wx.now':'Agora','wx.today':'Hoje',
      'wx.feels.cur':'Sensação:','wx.feels.hi':'Sensação até','wx.min':'Mín',
      'wx.loading':'A carregar meteorologia…','wx.error':'Erro ao carregar meteorologia.',
      'wx.wind':'Vento','wx.wind.max':'Vento máx.','wx.gusts':'Rajadas',
      'wx.humidity':'Humidade','wx.pressure':'Pressão','wx.cloud':'Nebulosidade',
      'wx.uv':'Índice UV','wx.precip':'Precipitação','wx.rain.prob':'Prob. chuva',
      'wx.sunrise':'Nascer do Sol','wx.sunset':'Pôr do Sol','wx.dir':'Direção',
      'wx.clouds':'Nuvens',
      // Weather conditions
      'wc.0':'Sol','wc.1':'Principalmente sol','wc.2':'Parcialmente nublado','wc.3':'Nublado',
      'wc.45':'Nevoeiro','wc.48':'Nevoeiro gelado','wc.51':'Chuvisco leve','wc.53':'Chuvisco',
      'wc.55':'Chuvisco forte','wc.61':'Chuva leve','wc.63':'Chuva','wc.65':'Chuva forte',
      'wc.71':'Neve leve','wc.73':'Neve','wc.75':'Neve forte',
      'wc.80':'Aguaceiros','wc.81':'Aguaceiros','wc.82':'Aguaceiros fortes',
      'wc.95':'Trovoada','wc.96':'Trovoada c/ granizo','wc.99':'Trovoada intensa',
      'wc.unknown':'Desconhecido',
      // Gauge ticks
      'gauge.wind.calm':'Calmo','gauge.wind.light':'Suave','gauge.wind.mod':'Moderado',
      'gauge.wind.strong':'Forte','gauge.wind.storm':'Tempestade',
      'gauge.hum.dry':'Seca','gauge.hum.ok':'Confortável','gauge.hum.humid':'Húmida',
      'gauge.hum.vhum':'Muito Húmida',
      'gauge.pres.vlow':'Muito Baixa','gauge.pres.low':'Baixa',
      'gauge.pres.norm':'Normal','gauge.pres.high':'Alta',
      'gauge.cloud.clear':'Limpo','gauge.cloud.pcloud':'Pouco Nublado',
      'gauge.cloud.mostcloud':'Parcialmente Nublado','gauge.cloud.cloud':'Nublado',
      'gauge.uv.low':'Baixo','gauge.uv.mod':'Moderado','gauge.uv.high':'Alto',
      'gauge.uv.vhigh':'Muito Alto','gauge.uv.extreme':'Extremo',
      'gauge.rain.none':'Sem chuva','gauge.rain.light':'Ligeira',
      'gauge.rain.mod':'Moderada','gauge.rain.heavy':'Forte',
      // Popup alerts
      'alert.yellow':'Amarelo','alert.orange':'Laranja','alert.red':'Vermelho',
      // Holidays
      'hol.nat':'🇵🇹 Feriados Nacionais','hol.mun':'🏛️ Feriados Municipais',
      'hol.nat.lbl':'Nacional',
      // Media
      'md.title':'Entretenimento','md.tv':'Episódios de TV',
      'md.trailers':'Trailers','md.theaters':'Cinemas em Portugal','md.digital':'Digital & Blu-ray',
      'md.last':'Últimos','md.days':'dias','md.reload':'Recarregar',
      'md.comfortable':'Confortável','md.compact':'Compacta','md.ultracompact':'Ultra',
      'md.series':'Série','md.movie':'Filme',
      'md.trailer':'Trailer','md.teaser':'Teaser','md.official':'Oficial',
      'md.cinemas':'Cinemas PT','md.digital2':'Digital',
      'md.noEp':'Nenhum episódio nos últimos {n} dias.',
      'md.noTrailers':'Nenhum trailer encontrado.','md.noMovies':'Sem filmes encontrados.',
      'md.noReleases':'Sem lançamentos encontrados.',
      'md.loadingEp':'A carregar episódios…','md.loadingTr':'A carregar trailers…',
      'md.loadingTh':'A carregar filmes…','md.loadingDg':'A carregar lançamentos…',
      'md.invalidKey':'Chave TMDB inválida.',
      'md.freeNote':'Dados gerais — para datas PT, adiciona a ',
      'md.freeNoteBtn':'chave TMDB gratuita',
      'md.tmdbTitle':'Chave TMDB','md.tmdbOptional':'Opcional',
      'md.tmdbDesc':'Desbloqueia dados precisos de cinemas portugueses e lançamentos digitais.',
      'md.tmdbPh':'Cole a chave API aqui…','md.tmdbSave':'Guardar',
      'md.tmdbLink':'Obter chave gratuita em themoviedb.org →',
      'md.tmdbNote':'Sem chave, mostra filmes populares recentes como alternativa.',
    }
  };

  let _lang = localStorage.getItem('site-lang') || 'en';
  document.documentElement.lang = _lang;

  function t(key, vars) {
    const d = T[_lang] || T.en;
    const s = d[key] !== undefined ? d[key] : (T.en[key] !== undefined ? T.en[key] : key);
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : '');
  }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    const btn = document.getElementById('lang-btn');
    if (btn) btn.textContent = t('hdr.lang');
  }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('site-lang', lang);
    document.documentElement.lang = lang;
    applyStatic();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function getLang() { return _lang; }
  function toggle()  { setLang(_lang === 'en' ? 'pt' : 'en'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyStatic);
  else applyStatic();

  return { t, setLang, getLang, toggle };
})();
