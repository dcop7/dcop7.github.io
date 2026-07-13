const I18n = (function () {
  'use strict';

  const T = {
    en: {
      // Nav
      'nav.home':'Home','nav.games':'Games','nav.links':'Useful Sites',
      'nav.tools':'Tools',
      'nav.cheatsheets':'Cheatsheets','nav.visual':'Visual',
      'nav.photography':'Photography','nav.settings':'Settings',
      'nav.quiz':'Quizzes','nav.humor':'Humour','nav.explorer':'Explore','nav.ocorrencias':'PT Incidents','nav.eventos':'Events','nav.noticias':'News','nav.f1':'Formula 1','nav.oss':'Tech Discovery','nav.discovery':'Gaming Deals',
      'nav.netlab':'Network Lab','nav.funlab':'Fun Lab','nav.autolab':'Auto Intelligence',
      'nav.grp.discover':'Discover','nav.grp.tools':'Tools','nav.grp.fun':'Fun','nav.grp.photo':'Photography',
      'nav.games.label':'Games','nav.links.label':'Useful Sites',
      // Theme panel + header tooltips
      'theme.title':'Theme','theme.dark':'Dark','theme.light':'Light',
      'hdr.textsize':'Text size','hdr.theme':'Change theme','hdr.lang.title':'Switch language',
      'hdr.menu':'Menu','hdr.fav.edit':'Edit favourites',
      'lp.all':'All','lp.title':'🔗 Useful Sites',
      'lp.count':'{n} sites in {m} categories',
      // Games
      'game.hangman':'Hangman',
      'game.minesweeper':'Minesweeper','game.bomb':'Defuse Bomb',
      'game.memory':'Memory Cards','game.chess':'Chess',
      'game.battleship':'Battleship','game.uno':'Uno','game.sueca':'Sueca',
      'game.wordle':'Word of the Day','game.neon-shooter':'Neon Space Shooter',
      'game.reaction':'Reaction Test',
      'game.gravity-lab':'Gravity Lab','game.archery':'Archery',
      // Header
      'hdr.search':'Search games, sites, sections…','hdr.lang':'PT',
      // Home widgets
      'home.fav.sites':'🌐 Favourite Sites',
      'home.fav.tools':'🔧 Favourite Tools',
      'home.fav.games':'🎮 Favourite Games',
      'home.world.times':'🕐 Portugal Time',
      // Home daily content
      'home.quote':'💡 Daily Quote','home.riddle':'🤔 Daily Riddle',
      'home.joke':'😄 Daily Joke','home.reveal':'Show answer',
      'home.greet.morning':'Good morning! ☀️','home.greet.afternoon':'Good afternoon! 🌤️',
      'home.greet.evening':'Good evening! 🌙',
      // Quiz
      'quiz.title':'Quizzes','quiz.sub':'Learning through play',
      'quiz.search':'Search quizzes…','quiz.start':'Start','quiz.retry':'Try again',
      'quiz.back':'Back to quizzes','quiz.score':'Score','quiz.highscore':'High score',
      'quiz.next':'Next','quiz.finish':'Finish','quiz.loading':'Loading questions…',
      'quiz.error':'Failed to load questions. Try again.',
      'quiz.correct':'Correct!','quiz.wrong':'Wrong!',
      'quiz.final.title':'Quiz complete!','quiz.final.great':'Excellent!',
      'quiz.final.good':'Well done!','quiz.final.ok':'Keep practising!',
      'quiz.question':'Question','quiz.of':'of',
      'quiz.age':'Age','quiz.lang':'Language',
      'quiz.settings.title':'Quiz Settings','quiz.settings.sub':'Customise quizzes',
      'quiz.settings.age':'Quiz age','quiz.settings.age.desc':'Adjusts question difficulty and vocabulary',
      'quiz.settings.lang':'Quiz language','quiz.settings.lang.desc':'Language used in quizzes',
      'quiz.cat.geografia':'Geography','quiz.cat.natureza':'Nature & Science',
      'quiz.cat.escola':'School','quiz.cat.cultura':'General Knowledge',
      'quiz.cat.visual':'Visual & Fun','quiz.cat.tecnologia':'Technology',
      'quiz.cat.imagens':'Guess from the Image',
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
      // Settings
      'st.title':'Settings','st.sub':'Customise your experience',
      'st.appearance':'Appearance',
      'st.theme':'Theme','st.theme.desc':'Dark or light mode',
      'st.wallpaper':'Dynamic wallpaper','st.wallpaper.desc':'Theme-matched background (requires internet)',
      'st.fontsize':'Font size','st.fontsize.desc':'Adjusts text size across the site',
      'st.lang':'Language','st.lang.desc':'Interface language',
      'st.interface':'Interface',
      'st.density':'Display density','st.density.desc':'Card density across all pages',
      'st.density.comfortable':'Comfortable','st.density.compact':'Compact','st.density.list':'List',
      'st.games':'Games',
      'st.age':'Default age','st.age.desc':'Word and puzzle difficulty at startup',
      // Quiz settings
      'st.quiz':'Quizzes',
      'st.quiz.age':'Quiz age','st.quiz.age.desc':'Question difficulty and vocabulary level',
      'st.quiz.lang':'Quiz language','st.quiz.lang.desc':'Language used inside quizzes',
    },
    pt: {
      // Nav
      'nav.home':'Início','nav.games':'Jogos','nav.links':'Sites Úteis',
      'nav.tools':'Ferramentas',
      'nav.cheatsheets':'Cheatsheets','nav.visual':'Visual',
      'nav.photography':'Fotografia','nav.settings':'Definições',
      'nav.quiz':'Quizzes','nav.humor':'Humor','nav.explorer':'Explorar','nav.ocorrencias':'Ocorrências PT','nav.eventos':'Eventos','nav.noticias':'Notícias','nav.f1':'Fórmula 1','nav.oss':'Descobrir Tech','nav.discovery':'Gaming Deals',
      'nav.netlab':'Network Lab','nav.funlab':'Fun Lab','nav.autolab':'Auto Intelligence',
      'nav.grp.discover':'Descobrir','nav.grp.tools':'Ferramentas','nav.grp.fun':'Diversão','nav.grp.photo':'Fotografia',
      'nav.games.label':'Jogos','nav.links.label':'Sites Úteis',
      // Painel de tema + dicas do cabeçalho
      'theme.title':'Tema','theme.dark':'Escuro','theme.light':'Claro',
      'hdr.textsize':'Tamanho do texto','hdr.theme':'Mudar tema','hdr.lang.title':'Mudar idioma',
      'hdr.menu':'Menu','hdr.fav.edit':'Editar favoritos',
      'lp.all':'Todos','lp.title':'🔗 Sites Úteis',
      'lp.count':'{n} sites em {m} categorias',
      // Games
      'game.hangman':'Jogo da Forca',
      'game.minesweeper':'Campo de Minas','game.bomb':'Desarmar Bomba',
      'game.memory':'Memória','game.chess':'Xadrez',
      'game.battleship':'Batalha Naval','game.uno':'Uno','game.sueca':'Sueca',
      'game.wordle':'Palavra do Dia','game.neon-shooter':'Neon Space Shooter',
      'game.reaction':'Teste de Reação',
      'game.gravity-lab':'Gravity Lab','game.archery':'Tiro ao Arco',
      // Header
      'hdr.search':'Pesquisar jogos, sites, secções…','hdr.lang':'EN',
      // Home widgets
      'home.fav.sites':'🌐 Sites Favoritos',
      'home.fav.tools':'🔧 Ferramentas Favoritas',
      'home.fav.games':'🎮 Jogos Favoritos',
      'home.world.times':'🕐 Hora de Portugal',
      // Home daily content
      'home.quote':'💡 Frase do Dia','home.riddle':'🤔 Adivinha do Dia',
      'home.joke':'😄 Piada do Dia','home.reveal':'Ver resposta',
      'home.greet.morning':'Bom dia! ☀️','home.greet.afternoon':'Boa tarde! 🌤️',
      'home.greet.evening':'Boa noite! 🌙',
      // Quiz
      'quiz.title':'Quizzes','quiz.sub':'Aprender a brincar',
      'quiz.search':'Pesquisar quizzes…','quiz.start':'Começar','quiz.retry':'Tentar novamente',
      'quiz.back':'Voltar aos quizzes','quiz.score':'Pontuação','quiz.highscore':'Recorde',
      'quiz.next':'Seguinte','quiz.finish':'Terminar','quiz.loading':'A carregar perguntas…',
      'quiz.error':'Não foi possível carregar as perguntas. Tenta novamente.',
      'quiz.correct':'Correcto!','quiz.wrong':'Errado!',
      'quiz.final.title':'Quiz concluído!','quiz.final.great':'Excelente!',
      'quiz.final.good':'Muito bem!','quiz.final.ok':'Continua a praticar!',
      'quiz.question':'Pergunta','quiz.of':'de',
      'quiz.age':'Idade','quiz.lang':'Idioma',
      'quiz.settings.title':'Definições de Quizzes','quiz.settings.sub':'Personaliza os quizzes',
      'quiz.settings.age':'Idade dos quizzes','quiz.settings.age.desc':'Ajusta a dificuldade e o vocabulário das perguntas',
      'quiz.settings.lang':'Idioma dos quizzes','quiz.settings.lang.desc':'Idioma utilizado dentro dos quizzes',
      'quiz.cat.geografia':'Geografia','quiz.cat.natureza':'Natureza e Ciência',
      'quiz.cat.escola':'Escola','quiz.cat.cultura':'Cultura Geral',
      'quiz.cat.visual':'Visual e Divertido','quiz.cat.tecnologia':'Tecnologia',
      'quiz.cat.imagens':'Adivinha pela Imagem',
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
      // Settings
      'st.title':'Definições','st.sub':'Personaliza a tua experiência',
      'st.appearance':'Aparência',
      'st.theme':'Tema','st.theme.desc':'Modo escuro ou claro',
      'st.wallpaper':'Wallpaper dinâmico','st.wallpaper.desc':'Imagem de fundo adaptada ao tema (requer internet)',
      'st.fontsize':'Tamanho da letra','st.fontsize.desc':'Ajusta o tamanho do texto em todo o site',
      'st.lang':'Língua','st.lang.desc':'Idioma da interface',
      'st.interface':'Interface',
      'st.density':'Densidade de informação','st.density.desc':'Visualização dos conteúdos em todas as páginas',
      'st.density.comfortable':'Confortável','st.density.compact':'Compacta','st.density.list':'Lista',
      'st.games':'Jogos',
      'st.age':'Idade padrão','st.age.desc':'Dificuldade das palavras e desafios ao iniciar',
      // Quiz settings
      'st.quiz':'Quizzes',
      'st.quiz.age':'Idade dos quizzes','st.quiz.age.desc':'Nível de dificuldade e vocabulário das perguntas',
      'st.quiz.lang':'Idioma dos quizzes','st.quiz.lang.desc':'Idioma utilizado dentro dos quizzes',
    }
  };

  let _lang = localStorage.getItem('site-lang') || 'pt';
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
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
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
