/* רשימת הצוערים וכרטיס הצוער על כל לשוניותיו. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  var TABS = [
    { key: 'details', label: 'פרטים' },
    { key: 'tasks', label: 'משימות' },
    { key: 'meetings', label: 'פגישות' },
    { key: 'notes', label: 'הערות' },
    { key: 'goals', label: 'יעדים' },
    { key: 'timeline', label: 'ציר זמן' }
  ];

  var activeTab = 'details';

  /* ===== טפסים ===== */

  function openCadetForm(cadetId) {
    var cadet = cadetId ? store.cadet(cadetId) : null;
    ui.openForm({
      title: cadet ? 'עריכת צוער' : 'צוער חדש',
      values: cadet || { roles: ['personal'], active: 'true' },
      fields: [
        { name: 'name', label: 'שם מלא', required: true },
        [
          {
            name: 'roles', label: 'סוג צוער', type: 'checkgroup', required: true,
            options: store.CADET_ROLES,
            hint: 'אפשר לסמן את שניהם — צוער שהוא גם חניך אישי וגם חניך קצינותי.'
          },
          { name: 'unit', label: 'כיתה / צוות' }
        ],
        [
          { name: 'phone', label: 'טלפון', type: 'tel' },
          { name: 'enlistDate', label: 'תאריך גיוס', type: 'date' }
        ],
        { name: 'keepPoints', label: 'נקודות לשימור', type: 'textarea', rows: 3,
          placeholder: 'מה עובד אצלו ושווה לחזק' },
        { name: 'improvePoints', label: 'נקודות לשיפור', type: 'textarea', rows: 3,
          placeholder: 'מה דורש עבודה' },
        { name: 'background', label: 'רקע קודם', type: 'textarea', rows: 3 },
        {
          name: 'active', label: 'סטטוס', type: 'select',
          options: [{ value: 'true', label: 'פעיל' }, { value: 'false', label: 'לא פעיל' }],
          hint: 'צוער לא פעיל נשמר עם כל ההיסטוריה שלו, אבל לא מופיע בתמונת המצב ובהטלת משימות.'
        }
      ],
      onSubmit: function (result) {
        result.active = result.active === 'true';
        if (cadet) result.id = cadet.id;
        var id = store.saveCadet(result);
        ui.toast(cadet ? 'הפרטים עודכנו' : 'הצוער נוסף');
        if (!cadet) location.hash = '#/cadet/' + id;
      }
    });
  }

  function openNoteForm(cadetId, noteId) {
    var note = noteId ? store.note(noteId) : null;
    var cadets = store.cadets({ activeOnly: true });
    if (!cadets.length) {
      ui.toast('צריך להוסיף צוער אחד לפחות');
      return;
    }

    var fields = [];
    /* מכרטיס הצוער הזהות ידועה; מהערה מהירה במסך הבית צריך לבחור. */
    if (!cadetId) {
      fields.push({
        name: 'cadetId', label: 'צוער', type: 'select', required: true,
        options: cadets.map(function (c) {
          return { value: c.id, label: c.name + ' · ' + store.rolesLabel(c) };
        })
      });
    }
    fields.push([
      { name: 'date', label: 'תאריך', type: 'date', required: true },
      { name: 'tone', label: 'אופי', type: 'select', options: store.TONES }
    ]);
    fields.push({ name: 'text', label: 'ההערה', type: 'textarea', rows: 4, required: true });

    ui.openForm({
      title: note ? 'עריכת הערה' : 'הערה שוטפת',
      values: note || { date: util.today(), tone: 'neutral', cadetId: cadets[0].id },
      fields: fields,
      onSubmit: function (result) {
        if (note) result.id = note.id;
        result.cadetId = cadetId || result.cadetId;
        store.saveNote(result);
        ui.toast(note ? 'ההערה עודכנה' : 'ההערה נרשמה');
      }
    });
  }

  function openGoalForm(cadetId, goalId) {
    var goal = goalId ? store.goal(goalId) : null;
    ui.openForm({
      title: goal ? 'עריכת יעד' : 'יעד אישי חדש',
      values: goal || { status: 'active', targetDate: '' },
      fields: [
        { name: 'title', label: 'היעד', required: true, placeholder: 'לאן אנחנו חותרים' },
        { name: 'description', label: 'פירוט', type: 'textarea', rows: 3 },
        [
          { name: 'targetDate', label: 'תאריך יעד משוער', type: 'date' },
          { name: 'status', label: 'סטטוס', type: 'select', options: store.GOAL_STATUSES }
        ]
      ],
      onSubmit: function (result) {
        if (goal) result.id = goal.id;
        result.cadetId = cadetId;
        store.saveGoal(result);
        ui.toast(goal ? 'היעד עודכן' : 'היעד נוסף');
      }
    });
  }

  /* ===== רשימת הצוערים ===== */

  function renderList(container, context) {
    var cadets = store.cadets({ type: context.type });

    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>צוערים</h2><div class="sub">' + cadets.length + ' בתצוגה</div></div>' +
        '<button type="button" class="btn btn--primary" id="add-cadet">צוער חדש</button>' +
      '</div>' +
      '<div class="grid grid--cadets" id="cadet-grid"></div>';

    container.querySelector('#add-cadet').addEventListener('click', function () { openCadetForm(); });

    var grid = container.querySelector('#cadet-grid');
    if (!cadets.length) {
      grid.replaceWith(ui.emptyState(
        'אין צוערים בתצוגה',
        'הוסף צוער, או שנה את הסינון בראש המסך.',
        'צוער חדש', function () { openCadetForm(); }
      ));
      return;
    }

    grid.innerHTML = cadets.map(function (cadet) {
      var summary = store.cadetSummary(cadet);
      return '<a class="card card--link" href="#/cadet/' + util.escape(cadet.id) + '">' +
        '<div class="cadet-card__head">' +
          '<div>' +
            '<div class="cadet-card__name">' + util.escape(cadet.name) +
              (cadet.active === false ? ' <span class="badge">לא פעיל</span>' : '') + '</div>' +
            (cadet.unit ? '<div class="cadet-card__unit">' + util.escape(cadet.unit) + '</div>' : '') +
          '</div>' +
          ui.roleBadges(cadet) +
        '</div>' +
        '<div class="cadet-card__stats">' +
          '<div class="stat"><span>משימות פתוחות:</span>' +
            '<span class="stat__value">' + summary.openTasks + '</span></div>' +
          '<div class="stat"><span>יעדים פעילים:</span>' +
            '<span class="stat__value">' + summary.activeGoals + '</span></div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  /* ===== כרטיס הצוער ===== */

  function renderDetail(container, context) {
    var cadet = store.cadet(context.params.id);
    if (!cadet) {
      container.innerHTML = '<div class="screen-head"><h2>הצוער לא נמצא</h2></div>';
      container.appendChild(ui.emptyState('הצוער לא נמצא', 'ייתכן שהוא נמחק.', 'חזרה לרשימה',
        function () { location.hash = '#/cadets'; }));
      return;
    }

    var contactLines = store.contacts(cadet).map(function (record) {
      var text = record.date
        ? (record.role === 'officer' ? 'הצגה אחרונה: ' : 'פגישה אחרונה: ') +
          util.formatDate(record.date) + ' · ' + util.relativeDays(record.date)
        : (record.role === 'officer' ? 'עוד לא הציג במפגש' : 'עוד לא נערכה פגישה אישית');
      return '<div class="sub' + (record.isStale ? ' due--overdue' : '') + '">' +
        util.escape(text) + '</div>';
    }).join('');

    container.innerHTML =
      '<div class="screen-head">' +
        '<div>' +
          '<div class="row"><h2>' + util.escape(cadet.name) + '</h2>' + ui.roleBadges(cadet) +
            (cadet.active === false ? '<span class="badge">לא פעיל</span>' : '') + '</div>' +
          contactLines +
        '</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn--ghost" href="#/cadets">לרשימה</a>' +
          '<button type="button" class="btn" id="edit-cadet">עריכת פרטים</button>' +
        '</div>' +
      '</div>' +
      '<div class="tabs" id="cadet-tabs">' +
        TABS.map(function (tab) {
          return '<button type="button" class="tab' + (tab.key === activeTab ? ' is-active' : '') +
            '" data-tab="' + tab.key + '">' + tab.label + '</button>';
        }).join('') +
      '</div>' +
      '<div id="tab-body"></div>';

    container.querySelector('#edit-cadet').addEventListener('click', function () { openCadetForm(cadet.id); });
    container.querySelectorAll('[data-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTab = button.dataset.tab;
        App.render();
      });
    });

    var body = container.querySelector('#tab-body');
    ({
      details: renderDetails,
      tasks: renderTasksTab,
      meetings: renderMeetingsTab,
      notes: renderNotesTab,
      goals: renderGoalsTab,
      timeline: renderTimelineTab
    }[activeTab] || renderDetails)(body, cadet);
  }

  function renderDetails(body, cadet) {
    var rows = [
      ['סוג צוער', store.rolesLabel(cadet)],
      ['כיתה / צוות', cadet.unit],
      ['טלפון', cadet.phone],
      ['תאריך גיוס', cadet.enlistDate ? util.formatDate(cadet.enlistDate) : ''],
      ['סטטוס', cadet.active === false ? 'לא פעיל' : 'פעיל']
    ].filter(function (row) { return row[1]; });

    body.innerHTML =
      '<div class="card stack">' +
        rows.map(function (row) {
          return '<div class="stat"><span>' + util.escape(row[0]) + ':</span>' +
            '<span class="stat__value">' + util.escape(row[1]) + '</span></div>';
        }).join('') +
        (cadet.background
          ? '<div><div class="card__meta">רקע קודם</div><div>' +
            util.escapeMultiline(cadet.background) + '</div></div>'
          : '') +
      '</div>' +
      pointsCard(cadet) +
      '<div class="btn-row" style="margin-top:14px">' +
        '<button type="button" class="btn btn--danger btn--sm" id="delete-cadet">מחיקת הצוער</button>' +
      '</div>';

    body.querySelector('#delete-cadet').addEventListener('click', function () {
      ui.confirm({
        title: 'מחיקת צוער',
        message: 'מחיקת ' + cadet.name + ' תמחק גם את כל המשימות, הפגישות, ההערות והיעדים שלו. ' +
          'הפעולה אינה הפיכה.\n\nאם המטרה היא רק להסיר אותו מהתצוגה השוטפת, עדיף לסמן אותו כ"לא פעיל" בעריכת הפרטים.',
        confirmLabel: 'מחיקה',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) return;
        store.deleteCadet(cadet.id);
        ui.toast('הצוער נמחק');
        location.hash = '#/cadets';
      });
    });
  }

  /* שתי הנקודות שאני מנהל ידנית — התמונה המזוקקת שלי על הצוער,
     נפרדת ממה שנרשם בפגישה ספציפית. */
  function pointsCard(cadet) {
    var blocks = [
      ['נקודות לשימור', cadet.keepPoints, 'ok'],
      ['נקודות לשיפור', cadet.improvePoints, 'warn']
    ];
    if (!cadet.keepPoints && !cadet.improvePoints) {
      return '<div class="card" style="margin-top:14px">' +
        '<div class="card__meta">נקודות לשימור ולשיפור</div>' +
        '<div class="hint">עוד לא הוזנו. אפשר למלא אותן ב"עריכת פרטים".</div></div>';
    }
    return '<div class="stack" style="margin-top:14px">' + blocks.map(function (block) {
      if (!block[1]) return '';
      return '<div class="card" style="border-right:3px solid var(--' + block[2] + ')">' +
        '<div class="card__meta">' + util.escape(block[0]) + '</div>' +
        '<div>' + util.escapeMultiline(block[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  function renderTasksTab(body, cadet) {
    var tasks = util.sortBy(store.tasks({ cadetId: cadet.id }), function (t) { return t.dueDate; });
    var open = tasks.filter(store.isOpen);
    var closed = tasks.filter(function (t) { return !store.isOpen(t); });

    body.innerHTML =
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-task">משימה חדשה</button>' +
      '</div>' +
      (open.length
        ? '<div class="section"><div class="section__head"><h4>פתוחות</h4>' +
            '<span class="section__count">' + open.length + '</span></div>' +
          '<div class="list">' + open.map(function (task) {
            return ui.taskRow(task, { bucket: store.attentionBucket(task) });
          }).join('') + '</div></div>'
        : '<div class="all-clear">אין משימות פתוחות.</div>') +
      (closed.length
        ? '<div class="section"><div class="section__head"><h4>היסטוריה</h4>' +
            '<span class="section__count">' + closed.length + '</span></div>' +
          '<div class="list">' + closed.map(function (task) {
            return ui.taskRow(task, {});
          }).join('') + '</div></div>'
        : '');

    body.querySelector('#add-task').addEventListener('click', function () {
      App.screens.tasks.openCreateForm({ cadetIds: [cadet.id] });
    });
    ui.bindTaskRows(body, App.screens.tasks.openEditForm);
  }

  /* הכרטיס מציג את הערוצים שהצוער שייך אליהם: פגישות אישיות לתפקיד האישי,
     רישומי ההצגות לתפקיד הקצינותי. צוער כפול מקבל את שניהם, זה מתחת לזה. */
  function renderMeetingsTab(body, cadet) {
    body.innerHTML = '';
    if (store.hasRole(cadet, 'personal')) body.appendChild(personalSection(cadet));
    if (store.hasRole(cadet, 'officer')) body.appendChild(presentationsSection(cadet));
  }

  function sectionHost(name, title, actionLabel, onAction) {
    var host = document.createElement('section');
    host.className = 'section';
    host.dataset.section = name;
    host.innerHTML =
      '<div class="section__head"><h4>' + util.escape(title) + '</h4></div>' +
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm">' + util.escape(actionLabel) + '</button>' +
      '</div>' +
      '<div class="stack"></div>';
    host.querySelector('button').addEventListener('click', onAction);
    host.list = host.querySelector('.stack');
    return host;
  }

  function personalSection(cadet) {
    var meetings = store.meetings({ cadetId: cadet.id });
    var host = sectionHost('personal-meetings', 'פגישות אישיות', 'פגישה חדשה', function () {
      App.screens.meetings.openMeetingForm(cadet.id);
    });

    if (!meetings.length) {
      host.list.appendChild(ui.emptyState('עוד לא תועדה פגישה', 'תעד את הפגישה האישית הראשונה.'));
      return host;
    }
    host.list.innerHTML = meetings.map(function (meeting) {
      return App.screens.meetings.meetingCard(meeting);
    }).join('');
    App.screens.meetings.bindMeetingCards(host.list);
    return host;
  }

  function presentationsSection(cadet) {
    var entries = store.presentationsFor(cadet.id);
    var absences = store.groupMeetings().filter(function (meeting) {
      return meeting.entries.some(function (entry) {
        return entry.cadetId === cadet.id && entry.absent;
      });
    });

    var host = sectionHost('presentations', 'הצגות במפגשי קצינות', 'מפגש קצינות חדש', function () {
      App.screens.meetings.openGroupMeetingEditor();
    });

    if (absences.length) {
      var note = document.createElement('div');
      note.className = 'card';
      note.style.marginBottom = '12px';
      note.innerHTML = '<div class="card__meta">' +
        (absences.length === 1 ? 'נעדר ממפגש אחד' : 'נעדר מ-' + absences.length + ' מפגשים') + ': ' +
        absences.map(function (m) { return util.formatDate(m.date); }).join(', ') + '</div>';
      host.list.appendChild(note);
    }

    if (!entries.length) {
      host.list.appendChild(ui.emptyState('עוד לא הציג במפגש',
        'לאחר מפגש קצינות שבו הוא מציג, הרישום יופיע כאן.'));
      return host;
    }
    var list = document.createElement('div');
    list.className = 'stack';
    list.innerHTML = entries.map(function (entry) {
      return App.screens.meetings.presentationCard(entry);
    }).join('');
    host.list.appendChild(list);
    return host;
  }

  function renderNotesTab(body, cadet) {
    var notes = store.notes(cadet.id);
    body.innerHTML =
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-note">הערה חדשה</button>' +
      '</div>' +
      '<div class="stack" id="note-list"></div>';

    body.querySelector('#add-note').addEventListener('click', function () { openNoteForm(cadet.id); });

    var list = body.querySelector('#note-list');
    if (!notes.length) {
      list.appendChild(ui.emptyState('אין הערות', 'רשום תצפית קצרה מהשטח.'));
      return;
    }

    var toneClass = { positive: 'ok', negative: 'danger', neutral: '' };
    list.innerHTML = notes.map(function (note) {
      return '<div class="card">' +
        '<div class="row">' +
          '<span class="card__meta">' + util.formatDate(note.date) + '</span>' +
          '<span class="badge badge--' + (toneClass[note.tone] || '') + '">' +
            util.escape(store.label('tone', note.tone)) + '</span>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-note-edit="' + util.escape(note.id) + '">עריכה</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-note-delete="' + util.escape(note.id) + '">מחיקה</button>' +
        '</div>' +
        '<div style="margin-top:6px">' + util.escapeMultiline(note.text) + '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('[data-note-edit]').forEach(function (button) {
      button.addEventListener('click', function () { openNoteForm(cadet.id, button.dataset.noteEdit); });
    });
    list.querySelectorAll('[data-note-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        ui.confirm({ title: 'מחיקת הערה', message: 'למחוק את ההערה?', confirmLabel: 'מחיקה', danger: true })
          .then(function (confirmed) {
            if (!confirmed) return;
            store.deleteNote(button.dataset.noteDelete);
            ui.toast('ההערה נמחקה');
          });
      });
    });
  }

  function renderGoalsTab(body, cadet) {
    var goals = store.goals(cadet.id);
    var active = goals.filter(function (g) { return g.status === 'active'; });
    var rest = goals.filter(function (g) { return g.status !== 'active'; });

    body.innerHTML =
      '<p class="hint">יעד הוא כיוון לטווח ארוך. משימה נקודתית שנגזרת ממנו נרשמת בלשונית המשימות.</p>' +
      '<div class="btn-row" style="margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary btn--sm" id="add-goal">יעד חדש</button>' +
      '</div>' +
      '<div class="stack" id="goal-list"></div>';

    body.querySelector('#add-goal').addEventListener('click', function () { openGoalForm(cadet.id); });

    var list = body.querySelector('#goal-list');
    if (!goals.length) {
      list.appendChild(ui.emptyState('אין יעדים', 'הגדר יעד אישי לצוער.'));
      return;
    }

    var statusClass = { active: '', achieved: 'ok', cancelled: 'danger' };
    list.innerHTML = active.concat(rest).map(function (goal) {
      return '<div class="card">' +
        '<div class="row">' +
          '<span class="card__title">' + util.escape(goal.title) + '</span>' +
          '<span class="badge badge--' + (statusClass[goal.status] || '') + '">' +
            util.escape(store.label('goalStatus', goal.status)) + '</span>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-goal-edit="' + util.escape(goal.id) + '">עריכה</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-goal-delete="' + util.escape(goal.id) + '">מחיקה</button>' +
        '</div>' +
        (goal.targetDate ? '<div class="card__meta">יעד: ' + util.formatDate(goal.targetDate) + '</div>' : '') +
        (goal.description ? '<div style="margin-top:6px">' + util.escapeMultiline(goal.description) + '</div>' : '') +
      '</div>';
    }).join('');

    list.querySelectorAll('[data-goal-edit]').forEach(function (button) {
      button.addEventListener('click', function () { openGoalForm(cadet.id, button.dataset.goalEdit); });
    });
    list.querySelectorAll('[data-goal-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        ui.confirm({ title: 'מחיקת יעד', message: 'למחוק את היעד?', confirmLabel: 'מחיקה', danger: true })
          .then(function (confirmed) {
            if (!confirmed) return;
            store.deleteGoal(button.dataset.goalDelete);
            ui.toast('היעד נמחק');
          });
      });
    });
  }

  function renderTimelineTab(body, cadet) {
    var events = store.timeline(cadet.id);
    if (!events.length) {
      body.innerHTML = '';
      body.appendChild(ui.emptyState('ציר הזמן ריק', 'כאן יופיעו כל האירועים של הצוער ברצף אחד.'));
      return;
    }

    var kindLabel = { task: 'משימה', meeting: 'פגישה', presentation: 'הצגה', note: 'הערה', goal: 'יעד' };
    body.innerHTML = '<div class="stack">' + events.map(function (event) {
      return '<div class="card">' +
        '<div class="row">' +
          '<span class="badge">' + util.escape(kindLabel[event.kind] || '') + '</span>' +
          '<span class="card__meta">' + util.formatDate(event.date) + '</span>' +
          (event.sentiment ? ui.sentimentBadge(event.sentiment) : '') +
          (event.status ? '<span class="badge">' + util.escape(store.label('status', event.status)) + '</span>' : '') +
        '</div>' +
        '<div class="card__title" style="margin-top:4px">' + util.escape(event.title) + '</div>' +
        (event.detail ? '<div class="task__desc">' + util.escapeMultiline(event.detail) + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  App.screens = App.screens || {};
  App.screens.cadets = {
    render: renderList,
    renderDetail: renderDetail,
    openCadetForm: openCadetForm,
    openNoteForm: openNoteForm,
    openGoalForm: openGoalForm
  };
})(window.App);
