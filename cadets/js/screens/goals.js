/* יעדים: דאשבורד מרוכז לכל הצוערים, ורכיבי היעד שמשמשים גם בכרטיס הצוער.
   יעד חד-פעמי נמדד בהשגה; יעד שוטף נמדד בהתמדה — סימון של כל תקופה. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  var pendingOnly = false;

  /* ===== טופס היעד ===== */

  function openGoalForm(cadetId, goalId) {
    var goal = goalId ? store.goal(goalId) : null;
    var cadets = store.cadets({ activeOnly: true });
    if (!cadetId && !cadets.length) {
      ui.toast('צריך להוסיף צוער אחד לפחות');
      return;
    }

    var fields = [];
    if (!cadetId && !goal) {
      fields.push({
        name: 'cadetId', label: 'צוער', type: 'select', required: true,
        options: cadets.map(function (c) {
          return { value: c.id, label: c.name + ' · ' + store.rolesLabel(c) };
        })
      });
    }
    fields.push({ name: 'title', label: 'היעד', required: true, placeholder: 'לאן אנחנו חותרים' });
    fields.push({ name: 'description', label: 'פירוט', type: 'textarea', rows: 3 });
    fields.push([
      {
        name: 'kind', label: 'סוג היעד', type: 'select', options: store.GOAL_KINDS,
        hint: 'יעד שוטף חוזר על עצמו, ואתה מסמן כל תקופה אם התקיים.'
      },
      {
        name: 'frequency', label: 'תדירות', type: 'select', options: store.FREQUENCIES,
        showWhen: { field: 'kind', value: 'recurring' }
      }
    ]);
    fields.push([
      {
        name: 'targetDate', label: 'תאריך יעד משוער', type: 'date',
        showWhen: { field: 'kind', value: 'once' }
      },
      {
        name: 'status', label: 'סטטוס', type: 'select', options: store.GOAL_STATUSES,
        showWhen: { field: 'kind', value: 'once' }
      }
    ]);
    fields.push({
      name: 'recurringStatus', label: 'סטטוס', type: 'select', options: store.RECURRING_STATUSES,
      showWhen: { field: 'kind', value: 'recurring' },
      hint: 'יעד שוטף רץ עד שתפסיק אותו.'
    });

    var values = goal
      ? Object.assign({}, goal, { recurringStatus: goal.status })
      : { kind: 'once', status: 'active', recurringStatus: 'active', frequency: 'weekly', targetDate: '' };

    ui.openForm({
      title: goal ? 'עריכת יעד' : 'יעד חדש',
      values: values,
      fields: fields,
      onSubmit: function (result) {
        var saved = {
          cadetId: cadetId || (goal && goal.cadetId) || result.cadetId,
          title: result.title,
          description: result.description,
          kind: result.kind
        };
        if (result.kind === 'recurring') {
          saved.frequency = result.frequency;
          saved.status = result.recurringStatus;
          saved.targetDate = '';
        } else {
          saved.frequency = '';
          saved.status = result.status;
          saved.targetDate = result.targetDate;
        }
        if (goal) {
          saved.id = goal.id;
          saved.marks = goal.marks;
        }
        store.saveGoal(saved);
        ui.toast(goal ? 'היעד עודכן' : 'היעד נוסף');
      }
    });
  }

  /* ===== סימון תקופה ===== */

  function openMarkDialog(goalId, periodKey) {
    var goal = store.goal(goalId);
    if (!goal) return;
    var mark = (goal.marks || {})[periodKey] || {};

    ui.openForm({
      title: util.periodLabel(goal.frequency, periodKey),
      submitLabel: 'שמירת סימון',
      values: { status: mark.status || '', note: mark.note || '' },
      fields: [
        {
          name: 'status', label: 'האם התקיים', type: 'select',
          options: [{ value: '', label: 'ללא סימון' }].concat(store.MARK_STATUSES)
        },
        {
          name: 'note', label: 'הערה', type: 'textarea', rows: 3,
          hint: 'מה שתכתוב כאן יעמוד לרשותך בשיחה הבאה עם הצוער.'
        }
      ],
      onSubmit: function (result) {
        store.markGoal(goalId, periodKey, result.status, result.note);
        ui.toast(result.status ? 'התקופה סומנה' : 'הסימון הוסר');
      }
    });
  }

  /* ===== תצוגת יעד ===== */

  function recurringGoal(goal) {
    var streak = store.goalStreak(goal);
    var stopped = goal.status !== 'active';

    var cells = streak.periods.map(function (period) {
      var classes = ['streak__cell'];
      classes.push('streak__cell--' + (period.status || 'empty'));
      if (period.isCurrent) classes.push('streak__cell--current');
      var title = util.periodLabel(streak.frequency, period.key) +
        (period.status ? ' · ' + store.label('mark', period.status) : ' · ללא סימון') +
        (period.note ? ' · ' + period.note : '');
      return '<button type="button" class="' + classes.join(' ') + '" title="' + util.escape(title) +
        '" data-mark="' + util.escape(goal.id) + '" data-period="' + util.escape(period.key) + '">' +
        (period.status === 'done' ? '✓' : period.status === 'missed' ? '✗' : '') + '</button>';
    }).join('');

    var current = streak.currentMark;
    var currentBlock = stopped
      ? '<span class="muted">היעד הופסק.</span>'
      : current
        ? '<span class="badge badge--' + (current.status === 'done' ? 'ok' : 'danger') + '">' +
            util.escape(store.label('mark', current.status)) + '</span>' +
          (current.note ? '<span class="muted">' + util.escape(current.note) + '</span>' : '') +
          '<button type="button" class="btn btn--sm btn--ghost" data-mark="' + util.escape(goal.id) +
            '" data-period="' + util.escape(streak.currentPeriod) + '">שינוי או הערה</button>'
        : '<button type="button" class="btn btn--sm" data-quick="done" data-goal="' + util.escape(goal.id) +
            '">✓ התקיים</button>' +
          '<button type="button" class="btn btn--sm" data-quick="missed" data-goal="' + util.escape(goal.id) +
            '">✗ לא התקיים</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-mark="' + util.escape(goal.id) +
            '" data-period="' + util.escape(streak.currentPeriod) + '">עם הערה</button>';

    return '<div class="card goal' + (stopped ? ' goal--stopped' : '') + '">' +
      '<div class="row">' +
        '<span class="card__title">' + util.escape(goal.title) + '</span>' +
        '<span class="badge">' + util.escape(store.label('frequency', streak.frequency)) + '</span>' +
        (streak.rate === null
          ? '<span class="badge">טרם סומן</span>'
          : '<span class="badge badge--' + rateTone(streak.rate) + '">' + streak.rate + '% · ' +
            streak.done + ' מתוך ' + streak.marked + '</span>') +
        (stopped ? '<span class="badge">הופסק</span>' : '') +
        '<span class="spacer"></span>' +
        goalButtons(goal) +
      '</div>' +
      (goal.description ? '<div class="task__desc">' + util.escapeMultiline(goal.description) + '</div>' : '') +
      '<div class="streak" aria-label="רצף התקופות האחרונות">' + cells + '</div>' +
      '<div class="row goal__current">' +
        '<span class="muted">' + util.escape(util.periodLabel(streak.frequency, streak.currentPeriod)) + ':</span>' +
        currentBlock +
      '</div>' +
    '</div>';
  }

  function rateTone(rate) {
    if (rate >= 80) return 'ok';
    if (rate >= 50) return 'warn';
    return 'danger';
  }

  function onceGoal(goal) {
    var statusClass = { active: '', achieved: 'ok', cancelled: 'danger' };
    return '<div class="card">' +
      '<div class="row">' +
        '<span class="card__title">' + util.escape(goal.title) + '</span>' +
        '<span class="badge badge--' + (statusClass[goal.status] || '') + '">' +
          util.escape(store.label('goalStatus', goal.status)) + '</span>' +
        '<span class="spacer"></span>' +
        goalButtons(goal) +
      '</div>' +
      (goal.targetDate ? '<div class="card__meta">יעד: ' + util.formatDate(goal.targetDate) + '</div>' : '') +
      (goal.description ? '<div class="task__desc">' + util.escapeMultiline(goal.description) + '</div>' : '') +
    '</div>';
  }

  function goalButtons(goal) {
    return '<button type="button" class="btn btn--sm btn--ghost" data-goal-edit="' +
        util.escape(goal.id) + '">עריכה</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-goal-delete="' +
        util.escape(goal.id) + '">מחיקה</button>';
  }

  /* מרנדר את היעדים של צוער אחד לתוך מכולה, ומחבר את כל האירועים. */
  function renderGoalsInto(host, cadetId, options) {
    var opts = options || {};
    var recurring = store.goals(cadetId, { kind: 'recurring' });
    var once = store.goals(cadetId, { kind: 'once' });

    if (opts.pendingOnly) {
      recurring = recurring.filter(function (goal) {
        return goal.status === 'active' && !(goal.marks || {})[store.currentPeriod(goal)];
      });
      once = [];
    }

    if (!recurring.length && !once.length) {
      host.appendChild(ui.emptyState(
        opts.pendingOnly ? 'אין יעדים שממתינים לסימון' : 'אין יעדים',
        opts.pendingOnly ? 'כל היעדים השוטפים סומנו לתקופה הנוכחית.' : 'הגדר יעד לצוער.'
      ));
      return;
    }

    host.innerHTML =
      (recurring.length
        ? '<div class="section__head"><h4>שוטפים</h4>' +
            '<span class="section__count">' + recurring.length + '</span></div>' +
          '<div class="stack">' + recurring.map(recurringGoal).join('') + '</div>'
        : '') +
      (once.length
        ? '<div class="section__head" style="margin-top:14px"><h4>חד-פעמיים</h4>' +
            '<span class="section__count">' + once.length + '</span></div>' +
          '<div class="stack">' + once.map(onceGoal).join('') + '</div>'
        : '');

    bindGoalActions(host);
  }

  function bindGoalActions(container) {
    container.querySelectorAll('[data-quick]').forEach(function (button) {
      button.addEventListener('click', function () {
        var goal = store.goal(button.dataset.goal);
        store.markGoal(goal.id, store.currentPeriod(goal), button.dataset.quick, '');
        ui.toast('התקופה סומנה');
      });
    });
    container.querySelectorAll('[data-mark]').forEach(function (button) {
      button.addEventListener('click', function () {
        openMarkDialog(button.dataset.mark, button.dataset.period);
      });
    });
    container.querySelectorAll('[data-goal-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        var goal = store.goal(button.dataset.goalEdit);
        openGoalForm(goal.cadetId, goal.id);
      });
    });
    container.querySelectorAll('[data-goal-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        var goal = store.goal(button.dataset.goalDelete);
        ui.confirm({
          title: 'מחיקת יעד',
          message: goal.kind === 'recurring'
            ? 'מחיקת היעד תמחק גם את כל היסטוריית הסימונים שלו. להמשיך?'
            : 'למחוק את היעד?',
          confirmLabel: 'מחיקה', danger: true
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.deleteGoal(goal.id);
          ui.toast('היעד נמחק');
        });
      });
    });
  }

  /* ===== הדאשבורד ===== */

  function render(container, context) {
    var type = context.type;
    var awaiting = store.goalsAwaitingMark(type);
    var cadets = store.cadets({ type: type }).filter(function (cadet) {
      return store.goals(cadet.id).length;
    });

    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>יעדים</h2><div class="sub" id="goals-sub"></div></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn" id="toggle-pending"></button>' +
          '<button type="button" class="btn btn--primary" id="add-goal">יעד חדש</button>' +
        '</div>' +
      '</div>' +
      '<div id="goals-body"></div>';

    container.querySelector('#goals-sub').textContent = awaiting.length
      ? awaiting.length === 1
        ? 'יעד שוטף אחד ממתין לסימון בתקופה הנוכחית'
        : awaiting.length + ' יעדים שוטפים ממתינים לסימון בתקופה הנוכחית'
      : 'כל היעדים השוטפים מסומנים לתקופה הנוכחית';

    var toggle = container.querySelector('#toggle-pending');
    toggle.textContent = pendingOnly ? 'הצג את כל היעדים' : 'רק ממתינים לסימון';
    toggle.addEventListener('click', function () {
      pendingOnly = !pendingOnly;
      App.render();
    });

    container.querySelector('#add-goal').addEventListener('click', function () { openGoalForm(); });

    var body = container.querySelector('#goals-body');
    var shown = pendingOnly
      ? cadets.filter(function (cadet) {
          return awaiting.some(function (goal) { return goal.cadetId === cadet.id; });
        })
      : cadets;

    if (!shown.length) {
      body.appendChild(ui.emptyState(
        pendingOnly ? 'אין יעדים שממתינים לסימון' : 'אין יעדים בתצוגה',
        pendingOnly
          ? 'כל היעדים השוטפים סומנו לתקופה הנוכחית.'
          : 'הגדר יעד ראשון, או שנה את הסינון בראש המסך.',
        pendingOnly ? null : 'יעד חדש',
        function () { openGoalForm(); }
      ));
      return;
    }

    /* מקובץ לפי צוער — קודם מי שממתין לסימון, כדי שהעבודה תהיה בראש המסך. */
    shown.sort(function (a, b) {
      var pa = awaiting.filter(function (g) { return g.cadetId === a.id; }).length;
      var pb = awaiting.filter(function (g) { return g.cadetId === b.id; }).length;
      if (pa !== pb) return pb - pa;
      return a.name.localeCompare(b.name, 'he');
    });

    shown.forEach(function (cadet) {
      var pending = awaiting.filter(function (g) { return g.cadetId === cadet.id; }).length;
      var section = document.createElement('section');
      section.className = 'section';
      section.dataset.cadet = cadet.id;
      section.innerHTML =
        '<div class="section__head">' +
          '<h3><a href="#/cadet/' + util.escape(cadet.id) + '">' + util.escape(cadet.name) + '</a></h3>' +
          ui.roleBadges(cadet) +
          (pending ? '<span class="badge badge--warn">' + pending + ' ממתינים לסימון</span>' : '') +
        '</div>' +
        '<div class="goal-host"></div>';
      body.appendChild(section);
      renderGoalsInto(section.querySelector('.goal-host'), cadet.id, { pendingOnly: pendingOnly });
    });
  }

  App.screens = App.screens || {};
  App.screens.goals = {
    render: render,
    openGoalForm: openGoalForm,
    renderGoalsInto: renderGoalsInto
  };
})(window.App);
