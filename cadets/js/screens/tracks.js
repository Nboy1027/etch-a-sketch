/* קצינויות: הצוותים בעולם הקצינות. לכל קצינות חברים, פגישות פא"ן,
   משימות משותפות ויעדים משותפים. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  var TABS = [
    { key: 'members', label: 'חברים' },
    { key: 'tasks', label: 'משימות' },
    { key: 'meetings', label: 'פא"ן' },
    { key: 'goals', label: 'יעדים' }
  ];

  var activeTab = 'members';

  function openTrackForm(trackId) {
    var track = trackId ? store.track(trackId) : null;
    ui.openForm({
      title: track ? 'עריכת קצינות' : 'קצינות חדשה',
      values: track || { active: 'true' },
      fields: [
        { name: 'name', label: 'שם הקצינות', required: true, placeholder: 'סיורים, מחשוב ואמצעים...' },
        { name: 'description', label: 'תיאור', type: 'textarea', rows: 3 },
        {
          name: 'active', label: 'סטטוס', type: 'select',
          options: [{ value: 'true', label: 'פעילה' }, { value: 'false', label: 'לא פעילה' }]
        }
      ],
      onSubmit: function (result) {
        result.active = result.active === 'true';
        if (track) result.id = track.id;
        var id = store.saveTrack(result);
        ui.toast(track ? 'הקצינות עודכנה' : 'הקצינות נוספה');
        if (!track) location.hash = '#/track/' + id;
      }
    });
  }

  /* ===== רשימת הקצינויות ===== */

  function renderList(container) {
    var tracks = store.tracks();

    container.innerHTML =
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary" id="add-track">קצינות חדשה</button>' +
      '</div>' +
      '<div class="grid grid--cadets" id="track-grid"></div>';

    container.querySelector('#add-track').addEventListener('click', function () { openTrackForm(); });

    var grid = container.querySelector('#track-grid');
    if (!tracks.length) {
      grid.replaceWith(ui.emptyState(
        'אין קצינויות',
        'קצינות היא צוות בעולם הקצינות — למשל סיורים או מחשוב ואמצעים. ' +
        'הפגישות, המשימות והיעדים שלה מוגדרים לקבוצה כולה.',
        'קצינות חדשה', function () { openTrackForm(); }
      ));
      return;
    }

    grid.innerHTML = tracks.map(function (track) {
      var summary = store.trackSummary(track);
      return '<a class="card card--link" href="#/track/' + util.escape(track.id) + '">' +
        '<div class="cadet-card__head">' +
          '<div><div class="cadet-card__name">' + util.escape(track.name) +
            (track.active === false ? ' <span class="badge">לא פעילה</span>' : '') + '</div></div>' +
          '<span class="badge badge--officer">' + util.plural(summary.members, 'חבר אחד', 'חברים') + '</span>' +
        '</div>' +
        '<div class="cadet-card__stats">' +
          '<div class="stat' + (summary.overdueTasks ? ' stat--alert' : '') + '">' +
            '<span>משימות פתוחות:</span><span class="stat__value">' + summary.openTasks + '</span>' +
            (summary.overdueTasks ? '<span class="badge badge--danger">' + summary.overdueTasks + ' באיחור</span>' : '') +
          '</div>' +
          '<div class="stat' + (summary.isStale ? ' stat--alert' : '') + '">' +
            '<span class="stat__value">' + util.escape(lastMeetingText(summary)) + '</span>' +
            (summary.lastMeeting ? ui.sentimentBadge(summary.lastMeeting.sentiment) : '') +
          '</div>' +
          '<div class="stat"><span>יעדים פעילים:</span>' +
            '<span class="stat__value">' + summary.activeGoals + '</span></div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  function lastMeetingText(summary) {
    return summary.lastMeeting ? 'פא"ן ' + util.relativeDays(summary.lastMeeting.date) : 'עוד לא נערך פא"ן';
  }

  /* ===== כרטיס הקצינות ===== */

  function renderDetail(container, context) {
    var track = store.track(context.params.id);
    if (!track) {
      container.innerHTML = '<div class="screen-head"><h2>הקצינות לא נמצאה</h2></div>';
      container.appendChild(ui.emptyState('הקצינות לא נמצאה', 'ייתכן שהיא נמחקה.', 'לרשימה',
        function () { location.hash = '#/cadets'; }));
      return;
    }

    var summary = store.trackSummary(track);

    container.innerHTML =
      '<div class="screen-head">' +
        '<div>' +
          '<div class="row"><h2>' + util.escape(track.name) + '</h2>' +
            '<span class="badge badge--officer">קצינות</span>' +
            (track.active === false ? '<span class="badge">לא פעילה</span>' : '') + '</div>' +
          '<div class="sub' + (summary.isStale ? ' due--overdue' : '') + '">' +
            util.escape(lastMeetingText(summary)) + ' · ' +
            util.plural(summary.members, 'חבר אחד', 'חברים') + '</div>' +
        '</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn--ghost" href="#/cadets">לרשימה</a>' +
          '<button type="button" class="btn" id="edit-track">עריכה</button>' +
        '</div>' +
      '</div>' +
      '<div class="tabs">' +
        TABS.map(function (tab) {
          return '<button type="button" class="tab' + (tab.key === activeTab ? ' is-active' : '') +
            '" data-tab="' + tab.key + '">' + tab.label + '</button>';
        }).join('') +
      '</div>' +
      '<div id="tab-body"></div>';

    container.querySelector('#edit-track').addEventListener('click', function () { openTrackForm(track.id); });
    container.querySelectorAll('[data-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTab = button.dataset.tab;
        App.render();
      });
    });

    var body = container.querySelector('#tab-body');
    ({
      members: renderMembers,
      tasks: renderTasks,
      meetings: renderMeetings,
      goals: renderGoals
    }[activeTab] || renderMembers)(body, track);
  }

  function renderMembers(body, track) {
    var members = store.trackMembers(track.id);
    body.innerHTML =
      (track.description ? '<div class="card" style="margin-bottom:14px">' +
        util.escapeMultiline(track.description) + '</div>' : '') +
      '<p class="hint">צוער משויך לקצינות בעריכת הפרטים שלו, בשדה "קצינות".</p>' +
      '<div class="grid grid--cadets" id="member-grid"></div>' +
      '<div class="btn-row" style="margin-top:18px">' +
        '<button type="button" class="btn btn--danger btn--sm" id="delete-track">מחיקת הקצינות</button>' +
      '</div>';

    var grid = body.querySelector('#member-grid');
    if (!members.length) {
      grid.replaceWith(ui.emptyState('אין חברים בקצינות',
        'שייך צוערים אליה דרך "עריכת פרטים" בכרטיס הצוער.'));
    } else {
      grid.innerHTML = members.map(function (cadet) {
        var summary = store.cadetSummary(cadet);
        return '<a class="card card--link" href="#/cadet/' + util.escape(cadet.id) + '">' +
          '<div class="cadet-card__head">' +
            '<div><div class="cadet-card__name">' + util.escape(cadet.name) + '</div></div>' +
            ui.roleBadges(cadet) +
          '</div>' +
          '<div class="cadet-card__stats">' +
            '<div class="stat"><span>משימות פתוחות:</span>' +
              '<span class="stat__value">' + summary.openTasks + '</span></div>' +
          '</div>' +
        '</a>';
      }).join('');
    }

    body.querySelector('#delete-track').addEventListener('click', function () {
      ui.confirm({
        title: 'מחיקת קצינות',
        message: 'ימחקו גם הפא"נים, המשימות והיעדים של הקצינות. ' +
          'הצוערים עצמם יישארו במערכת עם כל ההיסטוריה האישית שלהם, ללא שיוך לקצינות.',
        confirmLabel: 'מחיקה', danger: true
      }).then(function (confirmed) {
        if (!confirmed) return;
        store.deleteTrack(track.id);
        ui.toast('הקצינות נמחקה');
        location.hash = '#/cadets';
      });
    });
  }

  function renderTasks(body, track) {
    var tasks = util.sortBy(store.tasks({ trackId: track.id }), function (t) { return t.dueDate; });
    var open = tasks.filter(store.isOpen);
    var closed = tasks.filter(function (t) { return !store.isOpen(t); });

    body.innerHTML =
      '<p class="hint">משימת קצינות היא משימה אחת עם סטטוס משותף לכל הקבוצה.</p>' +
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-task">משימה לקצינות</button>' +
      '</div>' +
      (open.length
        ? '<div class="list">' + open.map(function (task) {
            return ui.taskRow(task, { bucket: store.attentionBucket(task) });
          }).join('') + '</div>'
        : '<div class="all-clear">אין משימות פתוחות.</div>') +
      (closed.length
        ? '<div class="section" style="margin-top:18px"><div class="section__head"><h4>היסטוריה</h4>' +
            '<span class="section__count">' + closed.length + '</span></div>' +
          '<div class="list">' + closed.map(function (task) { return ui.taskRow(task, {}); }).join('') + '</div></div>'
        : '');

    body.querySelector('#add-task').addEventListener('click', function () {
      App.screens.tasks.openCreateForm({ owner: 'track', trackId: track.id });
    });
    ui.bindTaskRows(body, App.screens.tasks.openEditForm);
  }

  function renderMeetings(body, track) {
    var meetings = store.trackMeetings(track.id);
    body.innerHTML =
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-meeting">פא"ן חדש</button>' +
      '</div>' +
      '<div class="stack" id="meeting-list"></div>';

    body.querySelector('#add-meeting').addEventListener('click', function () {
      App.screens.meetings.openTrackMeetingEditor(null, track.id);
    });

    var list = body.querySelector('#meeting-list');
    if (!meetings.length) {
      list.appendChild(ui.emptyState('עוד לא נערך פא"ן',
        'פא"ן הוא פגישה עם הקצינות הזו: תוכן משותף לקבוצה, ובתוכו שורה אישית לכל חבר.'));
      return;
    }
    list.innerHTML = meetings.map(App.screens.meetings.trackMeetingCard).join('');
    App.screens.meetings.bindTrackMeetingCards(list);
  }

  function renderGoals(body, track) {
    body.innerHTML =
      '<p class="hint">יעד של קצינות נמדד על הקבוצה כולה — סימון אחד לכל תקופה.</p>' +
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-goal">יעד לקצינות</button>' +
      '</div>' +
      '<div id="goal-host"></div>';

    body.querySelector('#add-goal').addEventListener('click', function () {
      App.screens.goals.openGoalForm(null, null, track.id);
    });
    App.screens.goals.renderGoalsInto(body.querySelector('#goal-host'), null, { trackId: track.id });
  }

  App.screens = App.screens || {};
  App.screens.tracks = {
    renderList: renderList,
    renderDetail: renderDetail,
    openTrackForm: openTrackForm
  };
})(window.App);
