/* פגישות: פגישות אישיות לצוערים אישיים, ומפגשי קצינות לצוערים הקצינותיים. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  var activeTab = 'personal';
  var personalFilters = { cadetId: '', sentiment: '' };

  /* שדות התבנית, זהים לפגישה אישית ולהצגה במפגש — כדי שאפשר יהיה להשוות בין הסוגים. */
  var TEMPLATE = [
    { key: 'topics', label: 'נושאים שעלו בשיחה', presentedLabel: 'מה הציג' },
    { key: 'strengths', label: 'נקודות לשימור' },
    { key: 'improvements', label: 'נקודות לשיפור' },
    { key: 'followups', label: 'סיכומים לפעם הבאה' }
  ];

  /* ===== פגישה אישית ===== */

  function openMeetingForm(cadetId, meetingId) {
    var meeting = meetingId ? store.meeting(meetingId) : null;
    var personal = store.cadets({ type: 'personal', activeOnly: true });

    if (!cadetId && !personal.length) {
      ui.toast('אין צוערים אישיים. צוערים קצינותיים מתועדים דרך מפגש קצינות.');
      return;
    }

    var fields = [];
    if (!cadetId) {
      fields.push({
        name: 'cadetId', label: 'צוער', type: 'select', required: true,
        options: personal.map(function (c) { return { value: c.id, label: c.name }; })
      });
    }
    fields.push([
      { name: 'date', label: 'תאריך', type: 'date', required: true },
      { name: 'sentiment', label: 'תחושה כללית', type: 'select', options: store.SENTIMENTS }
    ]);
    TEMPLATE.forEach(function (field) {
      fields.push({ name: field.key, label: field.label, type: 'textarea', rows: 2 });
    });
    fields.push({ name: 'freeText', label: 'מלל חופשי', type: 'textarea', rows: 3,
      hint: 'כל השדות אופציונליים — רשום רק מה שרלוונטי.' });

    ui.openForm({
      title: meeting ? 'עריכת פגישה' : 'פגישה אישית',
      wide: true,
      values: meeting || { date: util.today(), sentiment: 'good', cadetId: (personal[0] || {}).id },
      fields: fields,
      onSubmit: function (result) {
        if (meeting) result.id = meeting.id;
        result.cadetId = cadetId || result.cadetId || meeting.cadetId;
        store.saveMeeting(result);
        ui.toast(meeting ? 'הפגישה עודכנה' : 'הפגישה תועדה');
      }
    });
  }

  function templateBlocks(record, options) {
    var opts = options || {};
    return TEMPLATE.map(function (field) {
      var value = record[opts.presentedKey && field.key === 'topics' ? opts.presentedKey : field.key];
      if (!value) return '';
      var label = opts.presentedKey && field.key === 'topics' ? field.presentedLabel : field.label;
      return '<div style="margin-top:8px"><div class="card__meta">' + util.escape(label) + '</div>' +
        '<div>' + util.escapeMultiline(value) + '</div></div>';
    }).join('') +
    (record.freeText
      ? '<div style="margin-top:8px"><div class="card__meta">מלל חופשי</div><div>' +
        util.escapeMultiline(record.freeText) + '</div></div>'
      : '');
  }

  function meetingCard(meeting, options) {
    var opts = options || {};
    return '<div class="card">' +
      '<div class="row">' +
        '<span class="card__title">' + util.formatDate(meeting.date) + '</span>' +
        (opts.showCadet
          ? '<a href="#/cadet/' + util.escape(meeting.cadetId) + '">' +
            util.escape(store.cadetName(meeting.cadetId)) + '</a>' : '') +
        ui.sentimentBadge(meeting.sentiment) +
        '<span class="spacer"></span>' +
        (meeting.followups
          ? '<button type="button" class="btn btn--sm" data-meeting-task="' + util.escape(meeting.id) + '">משימה מהסיכום</button>'
          : '') +
        '<button type="button" class="btn btn--sm btn--ghost" data-meeting-edit="' + util.escape(meeting.id) + '">עריכה</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-meeting-delete="' + util.escape(meeting.id) + '">מחיקה</button>' +
      '</div>' +
      templateBlocks(meeting) +
    '</div>';
  }

  function bindMeetingCards(container) {
    container.querySelectorAll('[data-meeting-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        var meeting = store.meeting(button.dataset.meetingEdit);
        openMeetingForm(meeting.cadetId, meeting.id);
      });
    });
    container.querySelectorAll('[data-meeting-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        ui.confirm({ title: 'מחיקת פגישה', message: 'למחוק את תיעוד הפגישה?', confirmLabel: 'מחיקה', danger: true })
          .then(function (confirmed) {
            if (!confirmed) return;
            store.deleteMeeting(button.dataset.meetingDelete);
            ui.toast('הפגישה נמחקה');
          });
      });
    });
    container.querySelectorAll('[data-meeting-task]').forEach(function (button) {
      button.addEventListener('click', function () {
        var meeting = store.meeting(button.dataset.meetingTask);
        App.screens.tasks.openCreateForm({
          title: '', description: meeting.followups, cadetIds: [meeting.cadetId]
        });
      });
    });
  }

  function presentationCard(entry) {
    return '<div class="card">' +
      '<div class="row">' +
        '<span class="card__title">' + util.formatDate(entry.date) + '</span>' +
        '<span class="badge">מפגש קצינות</span>' +
        ui.sentimentBadge(entry.sentiment) +
        '<span class="spacer"></span>' +
        '<a class="btn btn--sm btn--ghost" href="#/group/' + util.escape(entry.groupMeetingId) + '">למפגש המלא</a>' +
      '</div>' +
      templateBlocks(entry, { presentedKey: 'presented' }) +
    '</div>';
  }

  /* ===== מפגש קצינות =====
     עורך ייעודי לרישום תוך כדי המפגש: כל הצוערים מוכנים מראש, ומתקדמים ממציג למציג.
     המפגש נשמר אוטומטית מרגע ההקלדה הראשונה, כדי שלא ילך לאיבוד באמצע. */

  function openGroupMeetingEditor(meetingId) {
    var existing = meetingId ? store.groupMeeting(meetingId) : null;
    var officers = store.cadets({ type: 'officer', activeOnly: true });

    if (!existing && !officers.length) {
      ui.toast('אין צוערים קצינותיים פעילים');
      return;
    }

    var draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : { date: util.today(), summary: '', entries: [] };

    /* משתתפים = כל הקצינותיים הפעילים, בתוספת מי שכבר תועד במפגש קיים. */
    var participants = officers.slice();
    draft.entries.forEach(function (entry) {
      if (!util.byId(participants, entry.cadetId)) {
        var cadet = store.cadet(entry.cadetId);
        if (cadet) participants.push(cadet);
      }
    });
    participants.forEach(function (cadet) {
      if (!entryFor(draft, cadet.id)) {
        draft.entries.push({
          cadetId: cadet.id, absent: false, presented: '',
          strengths: '', improvements: '', followups: '', sentiment: 'good', freeText: ''
        });
      }
    });

    var saveTimer = null;
    var dirty = false;
    function scheduleSave() {
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(commit, 400);
    }
    function commit() {
      if (!dirty) return;
      clearTimeout(saveTimer);
      draft.id = store.saveGroupMeeting(draft);
      dirty = false;
      status.textContent = 'נשמר · ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }

    var content = document.createElement('div');
    content.className = 'form';
    content.innerHTML =
      '<div class="field-row">' +
        '<div class="field"><label for="gm-date">תאריך המפגש</label>' +
          '<input type="date" id="gm-date" value="' + util.escape(draft.date) + '"></div>' +
        '<div class="field"><label>שמירה</label><div class="field__hint" id="gm-status">נשמר אוטומטית תוך כדי הקלדה</div></div>' +
      '</div>' +
      '<div class="field"><label for="gm-summary">סיכום כללי למפגש</label>' +
        '<textarea id="gm-summary" rows="3" placeholder="דברים שנאמרו למליאה, נושאים רוחביים">' +
        util.escape(draft.summary || '') + '</textarea></div>' +
      '<div class="tabs" id="gm-presenters"></div>' +
      '<div id="gm-entry"></div>';

    var status = content.querySelector('#gm-status');
    var current = participants.length ? participants[0].id : null;

    content.querySelector('#gm-date').addEventListener('input', function (event) {
      draft.date = event.target.value;
      scheduleSave();
    });
    content.querySelector('#gm-summary').addEventListener('input', function (event) {
      draft.summary = event.target.value;
      scheduleSave();
    });

    function renderPresenterTabs() {
      content.querySelector('#gm-presenters').innerHTML = participants.map(function (cadet) {
        var entry = entryFor(draft, cadet.id);
        var mark = entry.absent ? ' (נעדר)' : (hasContent(entry) ? ' ✓' : '');
        return '<button type="button" class="tab' + (cadet.id === current ? ' is-active' : '') +
          '" data-presenter="' + util.escape(cadet.id) + '">' + util.escape(cadet.name + mark) + '</button>';
      }).join('');
      content.querySelectorAll('[data-presenter]').forEach(function (button) {
        button.addEventListener('click', function () {
          commit();
          current = button.dataset.presenter;
          renderPresenterTabs();
          renderEntry();
        });
      });
    }

    function renderEntry() {
      var host = content.querySelector('#gm-entry');
      if (!current) { host.innerHTML = ''; return; }
      var entry = entryFor(draft, current);
      var cadet = store.cadet(current);

      host.innerHTML =
        '<div class="card stack">' +
          '<div class="row">' +
            '<strong>' + util.escape(cadet ? cadet.name : '') + '</strong>' +
            '<span class="spacer"></span>' +
            '<label class="picker__item"><input type="checkbox" id="gm-absent"' +
              (entry.absent ? ' checked' : '') + '><span>נעדר מהמפגש</span></label>' +
          '</div>' +
          '<div id="gm-fields"></div>' +
        '</div>';

      host.querySelector('#gm-absent').addEventListener('change', function (event) {
        entry.absent = event.target.checked;
        scheduleSave();
        renderPresenterTabs();
        renderEntry();
      });

      var fields = host.querySelector('#gm-fields');
      if (entry.absent) {
        fields.innerHTML = '<p class="hint">צוער שנעדר אינו מתועד, והמונה של "מתי הציג לאחרונה" ' +
          'לא מתאפס עבורו — כך שהיעדרות חוזרת בולטת במסך הבית.</p>';
        return;
      }

      fields.className = 'form';
      fields.innerHTML =
        '<div class="field"><label for="gm-presented">מה הציג</label>' +
          '<textarea id="gm-presented" rows="3" placeholder="ההתקדמות בקצינות שהוצגה">' +
          util.escape(entry.presented || '') + '</textarea></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="gm-strengths">נקודות לשימור</label>' +
            '<textarea id="gm-strengths" rows="2">' + util.escape(entry.strengths || '') + '</textarea></div>' +
          '<div class="field"><label for="gm-improvements">נקודות לשיפור</label>' +
            '<textarea id="gm-improvements" rows="2">' + util.escape(entry.improvements || '') + '</textarea></div>' +
        '</div>' +
        '<div class="field"><label for="gm-followups">סיכומים לפעם הבאה</label>' +
          '<textarea id="gm-followups" rows="2">' + util.escape(entry.followups || '') + '</textarea></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="gm-sentiment">תחושה כללית</label>' +
            '<select id="gm-sentiment">' + store.SENTIMENTS.map(function (option) {
              return '<option value="' + option.value + '"' +
                (option.value === entry.sentiment ? ' selected' : '') + '>' + option.label + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label for="gm-free">מלל חופשי</label>' +
            '<textarea id="gm-free" rows="2">' + util.escape(entry.freeText || '') + '</textarea></div>' +
        '</div>';

      [['#gm-presented', 'presented'], ['#gm-strengths', 'strengths'],
       ['#gm-improvements', 'improvements'], ['#gm-followups', 'followups'],
       ['#gm-sentiment', 'sentiment'], ['#gm-free', 'freeText']].forEach(function (pair) {
        fields.querySelector(pair[0]).addEventListener('input', function (event) {
          entry[pair[1]] = event.target.value;
          scheduleSave();
          renderPresenterTabs();
        });
      });
    }

    renderPresenterTabs();
    renderEntry();

    ui.openModal({
      title: existing ? 'עריכת מפגש קצינות' : 'מפגש קצינות חדש',
      content: content,
      wide: true,
      onClose: commit,
      buttons: [
        {
          label: 'סיום',
          className: 'btn--primary',
          onClick: function (modal) {
            commit();
            modal.close();
            /* המפגש נוצר לרוב מלשונית אחרת — מעבירים לרשימה שבה הוא באמת מופיע. */
            activeTab = 'group';
            App.render();
            ui.toast('המפגש נשמר');
          }
        }
      ]
    });
  }

  function entryFor(meeting, cadetId) {
    for (var i = 0; i < meeting.entries.length; i++) {
      if (meeting.entries[i].cadetId === cadetId) return meeting.entries[i];
    }
    return null;
  }

  function hasContent(entry) {
    return !!(entry.presented || entry.strengths || entry.improvements || entry.followups || entry.freeText);
  }

  /* ===== מסך הפגישות ===== */

  function render(container, context) {
    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>פגישות</h2></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" id="new-meeting">פגישה אישית</button>' +
          '<button type="button" class="btn btn--primary" id="new-group">מפגש קצינות</button>' +
        '</div>' +
      '</div>' +
      '<div class="tabs">' +
        '<button type="button" class="tab' + (activeTab === 'personal' ? ' is-active' : '') +
          '" data-mtab="personal">פגישות אישיות</button>' +
        '<button type="button" class="tab' + (activeTab === 'group' ? ' is-active' : '') +
          '" data-mtab="group">מפגשי קצינות</button>' +
      '</div>' +
      '<div id="meetings-body"></div>';

    container.querySelector('#new-meeting').addEventListener('click', function () { openMeetingForm(null); });
    container.querySelector('#new-group').addEventListener('click', function () { openGroupMeetingEditor(); });
    container.querySelectorAll('[data-mtab]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTab = button.dataset.mtab;
        App.render();
      });
    });

    var body = container.querySelector('#meetings-body');
    if (activeTab === 'personal') renderPersonal(body, context);
    else renderGroupList(body);
  }

  function renderPersonal(body, context) {
    var personal = store.cadets({ type: 'personal' });

    body.innerHTML =
      '<div class="filters">' +
        '<select id="pm-cadet"></select>' +
        '<select id="pm-sentiment"></select>' +
      '</div>' +
      '<div class="stack" id="pm-list"></div>';

    fill(body.querySelector('#pm-cadet'),
      [{ value: '', label: 'כל הצוערים' }].concat(personal.map(function (c) {
        return { value: c.id, label: c.name };
      })), personalFilters.cadetId);
    fill(body.querySelector('#pm-sentiment'),
      [{ value: '', label: 'כל התחושות' }].concat(store.SENTIMENTS), personalFilters.sentiment);

    body.querySelector('#pm-cadet').addEventListener('change', function (event) {
      personalFilters.cadetId = event.target.value;
      App.render();
    });
    body.querySelector('#pm-sentiment').addEventListener('change', function (event) {
      personalFilters.sentiment = event.target.value;
      App.render();
    });

    /* הלשונית מציגה פגישות אישיות בלבד, אך עדיין מכבדת את מסנן הכותרת:
       בחירת "קצינותיים" משאירה רק צוערים כפולים — כאלה שהם גם אישיים. */
    var meetings = store.meetings({
      type: context.type,
      cadetId: personalFilters.cadetId,
      sentiment: personalFilters.sentiment
    }).filter(function (meeting) {
      return store.hasRole(store.cadet(meeting.cadetId), 'personal');
    });

    var list = body.querySelector('#pm-list');
    if (!meetings.length) {
      list.appendChild(ui.emptyState('אין פגישות בתצוגה',
        context.type === 'officer'
          ? 'הסינון בראש המסך מוגבל לצוערים קצינותיים. פגישה אישית תופיע כאן רק לצוער שהוא גם אישי וגם קצינותי — השאר מתועדים בלשונית מפגשי קצינות.'
          : 'תעד פגישה אישית ראשונה.'));
      return;
    }
    list.innerHTML = meetings.map(function (meeting) {
      return meetingCard(meeting, { showCadet: true });
    }).join('');
    bindMeetingCards(list);
  }

  function renderGroupList(body) {
    var meetings = store.groupMeetings();
    body.innerHTML = '<div class="stack" id="gm-list"></div>';
    var list = body.querySelector('#gm-list');

    if (!meetings.length) {
      list.appendChild(ui.emptyState('אין מפגשי קצינות',
        'מפגש קצינות הוא אירוע אחד שבו כל הצוערים הקצינותיים מציגים בתורם.',
        'מפגש קצינות חדש', function () { openGroupMeetingEditor(); }));
      return;
    }

    list.innerHTML = meetings.map(function (meeting) {
      var presented = meeting.entries.filter(function (e) { return !e.absent; });
      var absent = meeting.entries.filter(function (e) { return e.absent; });
      return '<div class="card">' +
        '<div class="row">' +
          '<a class="card__title" href="#/group/' + util.escape(meeting.id) + '">מפגש ' +
            util.formatDate(meeting.date) + '</a>' +
          '<span class="badge">' + presented.length + ' הציגו</span>' +
          (absent.length ? '<span class="badge badge--warn">' + absent.length + ' נעדרו</span>' : '') +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-gm-edit="' + util.escape(meeting.id) + '">עריכה</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-gm-delete="' + util.escape(meeting.id) + '">מחיקה</button>' +
        '</div>' +
        (meeting.summary ? '<div class="task__desc">' + util.escapeMultiline(meeting.summary) + '</div>' : '') +
      '</div>';
    }).join('');

    bindGroupActions(list);
  }

  function bindGroupActions(container) {
    container.querySelectorAll('[data-gm-edit]').forEach(function (button) {
      button.addEventListener('click', function () { openGroupMeetingEditor(button.dataset.gmEdit); });
    });
    container.querySelectorAll('[data-gm-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        ui.confirm({
          title: 'מחיקת מפגש',
          message: 'מחיקת המפגש תמחק גם את רישומי ההצגות של כל המשתתפים בו. להמשיך?',
          confirmLabel: 'מחיקה', danger: true
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.deleteGroupMeeting(button.dataset.gmDelete);
          ui.toast('המפגש נמחק');
          if (location.hash.indexOf('#/group/') === 0) location.hash = '#/meetings';
        });
      });
    });
  }

  /* ===== מסך מפגש בודד ===== */

  function renderGroupDetail(container, context) {
    var meeting = store.groupMeeting(context.params.id);
    if (!meeting) {
      container.innerHTML = '<div class="screen-head"><h2>המפגש לא נמצא</h2></div>';
      container.appendChild(ui.emptyState('המפגש לא נמצא', 'ייתכן שהוא נמחק.', 'לרשימת הפגישות',
        function () { location.hash = '#/meetings'; }));
      return;
    }

    var presented = meeting.entries.filter(function (e) { return !e.absent; });
    var absent = meeting.entries.filter(function (e) { return e.absent; });

    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>מפגש קצינות · ' + util.formatDate(meeting.date) + '</h2>' +
          '<div class="sub">' + presented.length + ' הציגו' +
          (absent.length ? ' · ' + absent.length + ' נעדרו' : '') + '</div></div>' +
        '<div class="btn-row">' +
          '<a class="btn btn--ghost" href="#/meetings">לרשימה</a>' +
          '<button type="button" class="btn" data-gm-edit="' + util.escape(meeting.id) + '">עריכה</button>' +
        '</div>' +
      '</div>' +
      (meeting.summary
        ? '<div class="card" style="margin-bottom:16px"><div class="card__meta">סיכום כללי למפגש</div>' +
          '<div>' + util.escapeMultiline(meeting.summary) + '</div></div>'
        : '') +
      (absent.length
        ? '<div class="card" style="margin-bottom:16px"><div class="card__meta">נעדרו</div><div>' +
          absent.map(function (entry) { return util.escape(store.cadetName(entry.cadetId)); }).join(', ') +
          '</div></div>'
        : '') +
      '<div class="stack">' + presented.map(function (entry) {
        return '<div class="card">' +
          '<div class="row">' +
            '<a class="card__title" href="#/cadet/' + util.escape(entry.cadetId) + '">' +
              util.escape(store.cadetName(entry.cadetId)) + '</a>' +
            ui.sentimentBadge(entry.sentiment) +
          '</div>' +
          templateBlocks(entry, { presentedKey: 'presented' }) +
        '</div>';
      }).join('') + '</div>';

    bindGroupActions(container);
  }

  function fill(select, options, value) {
    select.innerHTML = options.map(function (option) {
      return '<option value="' + util.escape(option.value) + '"' +
        (String(option.value) === String(value || '') ? ' selected' : '') + '>' +
        util.escape(option.label) + '</option>';
    }).join('');
  }

  App.screens = App.screens || {};
  App.screens.meetings = {
    render: render,
    renderGroupDetail: renderGroupDetail,
    openMeetingForm: openMeetingForm,
    openGroupMeetingEditor: openGroupMeetingEditor,
    meetingCard: meetingCard,
    bindMeetingCards: bindMeetingCards,
    presentationCard: presentationCard
  };
})(window.App);
