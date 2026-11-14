/* DCOP7 Productivity — textos do shell, registados no I18n partilhado do
   portal (mesma preferência de língua: localStorage['site-lang']). Os
   textos longos de cada página vivem junto do módulo, em {pt,en}. */
(function () {
  'use strict';
  if (typeof I18n === 'undefined' || !I18n.add) return;
  I18n.add({
    pt: {
      'pr.skip': 'Saltar para o conteúdo', 'pr.nav.areas': 'Áreas',
      'pr.area.learn': 'Aprender', 'pr.area.explore': 'Explorar', 'pr.area.experiment': 'Experimentar', 'pr.area.apply': 'Aplicar',
      'pr.area.learn.d': 'O modelo, os métodos e a estrutura', 'pr.area.explore.d': 'Mapa do sistema, relações e ferramentas',
      'pr.area.experiment.d': 'Playground de bases de dados e captura', 'pr.area.apply.d': 'Uma semana no sistema e o teu próprio sistema',
      'pr.lang.title': 'Switch to English', 'pr.lang.switch': 'English', 'pr.lang.btn': 'EN',
      'pr.theme': 'Mudar o tema', 'pr.theme.switch': 'Tema claro / escuro', 'pr.portal.title': 'Voltar ao Diogo Universe',
      'pr.menu.open': 'Abrir índice', 'pr.menu.close': 'Fechar índice',
      'pr.foot.about': 'Um sistema pessoal de produtividade que se aprende a fazer: capturar, triar e rever. Os exemplos são fictícios e tudo corre no teu browser — não há contas, sincronização nem ligação às tuas ferramentas. Funciona offline.',
      'pr.foot.areas': 'Áreas', 'pr.foot.short': 'Atalhos', 'pr.foot.base': 'DCOP7 Productivity · parte do Diogo Universe', 'pr.foot.local': 'Simulação local · sem contas',
      'pr.x.notion': 'Playground de bases de dados', 'pr.a.week': 'Uma semana no sistema', 'pr.e.tools': 'Diretório de ferramentas',
      'pr.offline': 'Sem ligação. O que já abriste continua disponível.', 'pr.online': 'Ligação restabelecida.',
      'pr.site.tag': 'um sistema pessoal de produtividade',
    },
    en: {
      'pr.skip': 'Skip to content', 'pr.nav.areas': 'Areas',
      'pr.area.learn': 'Learn', 'pr.area.explore': 'Explore', 'pr.area.experiment': 'Experiment', 'pr.area.apply': 'Apply',
      'pr.area.learn.d': 'The model, the methods and the structure', 'pr.area.explore.d': 'System map, relations and tools',
      'pr.area.experiment.d': 'Database playground and capture', 'pr.area.apply.d': 'A week in the system and your own system',
      'pr.lang.title': 'Mudar para português', 'pr.lang.switch': 'Português', 'pr.lang.btn': 'PT',
      'pr.theme': 'Change theme', 'pr.theme.switch': 'Light / dark theme', 'pr.portal.title': 'Back to Diogo Universe',
      'pr.menu.open': 'Open index', 'pr.menu.close': 'Close index',
      'pr.foot.about': 'A personal productivity system you learn by doing: capture, triage and review. The examples are fictional and everything runs in your browser — no accounts, no sync, no connection to your tools. Works offline.',
      'pr.foot.areas': 'Areas', 'pr.foot.short': 'Shortcuts', 'pr.foot.base': 'DCOP7 Productivity · part of Diogo Universe', 'pr.foot.local': 'Local simulation · no accounts',
      'pr.x.notion': 'Database playground', 'pr.a.week': 'A week in the system', 'pr.e.tools': 'Tool directory',
      'pr.offline': 'Offline. What you have already opened is still available.', 'pr.online': 'Back online.',
      'pr.site.tag': 'a personal productivity system',
    },
  });
})();
