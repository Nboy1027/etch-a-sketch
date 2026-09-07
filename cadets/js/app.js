/* ניתוב, מסנן סוג הצוער הגלובלי, וחיבור הכול יחד. */
(function (App) {
  'use strict';

  var store = App.store;

  var ROUTES = [
    { pattern: /^#\/home$/, name: 'home', render: function (c, ctx) { App.screens.home.render(c, ctx); } },
    { pattern: /^#\/cadets$/, name: 'cadets', render: function (c, ctx) { App.screens.cadets.render(c, ctx); } },
    { pattern: /^#\/cadet\/(.+)$/, name: 'cadets', keys: ['id'],
      render: function (c, ctx) { App.screens.cadets.renderDetail(c, ctx); } },
    { pattern: /^#\/tasks$/, name: 'tasks', render: function (c, ctx) { App.screens.tasks.render(c, ctx); } },
    { pattern: /^#\/meetings$/, name: 'meetings', render: function (c, ctx) { App.screens.meetings.render(c, ctx); } },
    { pattern: /^#\/group\/(.+)$/, name: 'meetings', keys: ['id'],
      render: function (c, ctx) { App.screens.meetings.renderGroupDetail(c, ctx); } },
    { pattern: /^#\/settings$/, name: 'settings', render: function (c, ctx) { App.screens.settings.render(c, ctx); } }
  ];

  function match() {
    var hash = location.hash || '#/home';
    for (var i = 0; i < ROUTES.length; i++) {
      var found = hash.match(ROUTES[i].pattern);
      if (found) {
        var params = {};
        (ROUTES[i].keys || []).forEach(function (key, index) {
          params[key] = decodeURIComponent(found[index + 1]);
        });
        return { route: ROUTES[i], params: params };
      }
    }
    return { route: ROUTES[0], params: {} };
  }

  function render() {
    var current = match();
    var container = document.getElementById('screen');
    var context = { type: store.getSetting('typeFilter') || 'all', params: current.params };

    container.innerHTML = '';
    current.route.render(container, context);

    document.querySelectorAll('#app-nav a').forEach(function (link) {
      link.classList.toggle('is-active', link.dataset.route === current.route.name);
    });
  }

  function renderTypeFilter() {
    var active = store.getSetting('typeFilter') || 'all';
    document.querySelectorAll('#type-filter .chip').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.dataset.type === active);
    });
  }

  function start() {
    store.init();

    document.querySelectorAll('#type-filter .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        store.setSetting('typeFilter', chip.dataset.type);
        renderTypeFilter();
      });
    });

    /* כל שינוי בנתונים מצייר מחדש את המסך הנוכחי — מקור אמת אחד לתצוגה. */
    store.subscribe(render);

    /* שתי לשוניות פתוחות של המערכת קוראות מאותו אחסון. בלי זה, לשונית ישנה
       הייתה דורסת בשמירה הבאה שלה את מה שנשמר בלשונית השנייה. */
    window.addEventListener('storage', function (event) {
      if (event.key === store.STORAGE_KEY) store.reload();
    });

    window.addEventListener('hashchange', function () {
      window.scrollTo(0, 0);
      render();
    });

    if (!location.hash) location.hash = '#/home';
    renderTypeFilter();
    render();
  }

  App.render = render;
  document.addEventListener('DOMContentLoaded', start);
})(window.App);
