/* מסך הבית: מה שדורש טיפול עכשיו, ומתחתיו תמונת מצב של כל הצוערים. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  var BUCKETS = [
    { key: 'overdue', title: 'באיחור', note: 'עבר תאריך היעד והמשימה עדיין פתוחה' },
    { key: 'soon', title: 'מתקרבות', note: 'תאריך היעד בשבוע הקרוב' },
    { key: 'stale', title: 'תקועות', note: 'פתוחות ללא עדכון ' + store.THRESHOLDS.staleTaskDays + ' יום ומעלה' }
  ];

  function render(container, context) {
    var type = context.type;
    var cadets = store.cadets({ type: type, activeOnly: true });

    if (!store.cadets().length) {
      container.innerHTML = '<div class="screen-head"><div><h2>בית</h2></div></div>';
      container.appendChild(ui.emptyState(
        'המערכת עדיין ריקה',
        'התחל בהוספת הצוערים שלך. אחר כך אפשר להטיל משימות ולתעד פגישות.',
        'הוספת צוער',
        function () { App.screens.cadets.openCadetForm(); }
      ));
      return;
    }

    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>בית</h2><div class="sub">' + util.escape(subtitle(type, cadets.length)) + '</div></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" id="quick-note">הערה מהירה</button>' +
          '<button type="button" class="btn btn--primary" id="quick-task">משימה חדשה</button>' +
        '</div>' +
      '</div>' +
      '<section class="section" id="attention"></section>' +
      '<section class="section" id="overview"></section>';

    container.querySelector('#quick-task').addEventListener('click', function () {
      App.screens.tasks.openCreateForm();
    });
    container.querySelector('#quick-note').addEventListener('click', function () {
      App.screens.cadets.openNoteForm(null);
    });

    renderAttention(container.querySelector('#attention'), type);
    renderOverview(container.querySelector('#overview'), cadets);
  }

  function subtitle(type, count) {
    var label = type === 'personal' ? 'צוערים אישיים'
      : type === 'officer' ? 'צוערים קצינותיים' : 'צוערים פעילים';
    return count + ' ' + label;
  }

  function renderAttention(section, type) {
    var groups = store.attentionGroups(type);
    var total = groups.overdue.length + groups.soon.length + groups.stale.length;

    if (!total) {
      section.innerHTML =
        '<div class="section__head"><h3>דורש טיפול</h3></div>' +
        '<div class="all-clear">אין משימות שדורשות טיפול כרגע.</div>';
      return;
    }

    section.innerHTML =
      '<div class="section__head"><h3>דורש טיפול</h3>' +
        '<span class="section__count">' + total + ' משימות</span></div>' +
      BUCKETS.map(function (bucket) {
        var tasks = groups[bucket.key];
        if (!tasks.length) return '';
        return '<div class="section" style="margin-bottom:18px">' +
          '<div class="section__head">' +
            '<h4>' + util.escape(bucket.title) + '</h4>' +
            '<span class="section__count">' + tasks.length + ' · ' + util.escape(bucket.note) + '</span>' +
          '</div>' +
          '<div class="list">' + tasks.map(function (task) {
            return ui.taskRow(task, { showCadet: true, bucket: bucket.key });
          }).join('') + '</div>' +
        '</div>';
      }).join('');

    ui.bindTaskRows(section, App.screens.tasks.openEditForm);
  }

  function renderOverview(section, cadets) {
    if (!cadets.length) {
      section.innerHTML = '<div class="section__head"><h3>תמונת מצב</h3></div>';
      section.appendChild(ui.emptyState('אין צוערים בסינון הנוכחי', 'שנה את הסינון בראש המסך.'));
      return;
    }

    /* צוער שמזמן לא נפגשנו איתו עולה לראש הרשימה — זה מה שהמסך נועד לחשוף.
       אצל צוער כפול קובע הפער הגדול מבין שני הערוצים. */
    var ordered = cadets.slice().sort(function (a, b) {
      return store.longestGap(b) - store.longestGap(a);
    });

    section.innerHTML =
      '<div class="section__head"><h3>תמונת מצב</h3>' +
        '<span class="section__count">' + cadets.length + ' צוערים</span></div>' +
      '<div class="grid grid--cadets">' + ordered.map(cadetCard).join('') + '</div>';
  }

  function cadetCard(cadet) {
    var summary = store.cadetSummary(cadet);

    return '<a class="card card--link" href="#/cadet/' + util.escape(cadet.id) + '">' +
      '<div class="cadet-card__head">' +
        '<div>' +
          '<div class="cadet-card__name">' + util.escape(cadet.name) + '</div>' +
          (cadet.unit ? '<div class="cadet-card__unit">' + util.escape(cadet.unit) + '</div>' : '') +
        '</div>' +
        ui.roleBadges(cadet) +
      '</div>' +
      '<div class="cadet-card__stats">' +
        '<div class="stat' + (summary.overdueTasks ? ' stat--alert' : '') + '">' +
          '<span>משימות פתוחות:</span>' +
          '<span class="stat__value">' + summary.openTasks + '</span>' +
          (summary.overdueTasks ? '<span class="badge badge--danger">' + summary.overdueTasks + ' באיחור</span>' : '') +
        '</div>' +
        summary.contacts.map(contactRow).join('') +
        '<div class="stat"><span>יעדים פעילים:</span>' +
          '<span class="stat__value">' + summary.activeGoals + '</span></div>' +
      '</div>' +
    '</a>';
  }

  /* שורה לכל ערוץ תיעוד. צוער כפול מקבל שתיים, כך שפער בהצגות לא נחבא
     מאחורי פגישה אישית שהייתה אתמול. */
  function contactRow(record) {
    var text = record.date
      ? (record.role === 'officer' ? 'הציג ' : 'נפגשתם ') + util.relativeDays(record.date)
      : (record.role === 'officer' ? 'עוד לא הציג' : 'עוד לא נפגשתם');
    return '<div class="stat' + (record.isStale ? ' stat--alert' : '') + '">' +
      '<span class="stat__value">' + util.escape(text) + '</span>' +
      (record.date ? ui.sentimentBadge(record.sentiment) : '') +
    '</div>';
  }

  App.screens = App.screens || {};
  App.screens.home = { render: render };
})(window.App);
