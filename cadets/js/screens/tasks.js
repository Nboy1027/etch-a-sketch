/* מסך המשימות: סינון, רשימה, ויצירה/עריכה של משימות (כולל הטלה קבוצתית). */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  /* מצב הסינון של המסך נשמר בין מעברים בין מסכים. */
  var filters = { cadetId: '', status: '', priority: '', category: '', from: '', to: '' };

  function categoryOptions() {
    return [{ value: '', label: 'ללא קטגוריה' }].concat(store.categories().map(function (name) {
      return { value: name, label: name };
    }));
  }

  /* טופס יצירה. defaults מאפשר לפתוח אותו מתוך כרטיס צוער או סיכום פגישה. */
  function openCreateForm(defaults) {
    var values = Object.assign({
      title: '', description: '', priority: 'medium', category: '',
      dueDate: '', cadetIds: []
    }, defaults || {});

    var cadets = store.cadets({ activeOnly: true });
    if (!cadets.length) {
      ui.toast('צריך להוסיף צוער אחד לפחות לפני שמטילים משימה');
      return;
    }

    ui.openForm({
      title: 'משימה חדשה',
      submitLabel: 'הטלת משימה',
      values: values,
      fields: [
        { name: 'title', label: 'כותרת', required: true, placeholder: 'מה צריך לעשות' },
        { name: 'description', label: 'תיאור', type: 'textarea', rows: 3 },
        [
          { name: 'priority', label: 'עדיפות', type: 'select', options: store.PRIORITIES },
          { name: 'category', label: 'קטגוריה', type: 'select', options: categoryOptions() }
        ],
        { name: 'dueDate', label: 'תאריך יעד', type: 'date' },
        {
          name: 'cadetIds', label: 'צוערים', type: 'cadet-picker', required: true,
          options: cadets,
          hint: 'בחירה של כמה צוערים יוצרת לכל אחד מהם משימה נפרדת, כדי שאפשר יהיה לעקוב אחרי כל אחד בנפרד.'
        }
      ],
      onSubmit: function (result) {
        store.createTasks({
          title: result.title,
          description: result.description,
          priority: result.priority,
          category: result.category,
          dueDate: result.dueDate
        }, result.cadetIds);
        ui.toast(result.cadetIds.length > 1
          ? 'המשימה הוטלה על ' + result.cadetIds.length + ' צוערים'
          : 'המשימה נוספה');
      }
    });
  }

  function openEditForm(taskId) {
    var task = store.task(taskId);
    if (!task) return;

    ui.openForm({
      title: 'עריכת משימה',
      values: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        dueDate: task.dueDate,
        status: task.status,
        cadet: store.cadetName(task.cadetId)
      },
      fields: [
        { name: 'cadet', label: 'צוער', type: 'static' },
        { name: 'title', label: 'כותרת', required: true },
        { name: 'description', label: 'תיאור', type: 'textarea', rows: 3 },
        [
          { name: 'priority', label: 'עדיפות', type: 'select', options: store.PRIORITIES },
          { name: 'category', label: 'קטגוריה', type: 'select', options: categoryOptions() }
        ],
        [
          { name: 'dueDate', label: 'תאריך יעד', type: 'date' },
          { name: 'status', label: 'סטטוס', type: 'select', options: store.TASK_STATUSES }
        ]
      ],
      onSubmit: function (result) {
        store.updateTask(taskId, result);
        ui.toast('המשימה עודכנה');
      }
    }).foot.insertAdjacentElement('beforeend', deleteButton(taskId));
  }

  function deleteButton(taskId) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--danger';
    button.style.marginInlineStart = 'auto';
    button.textContent = 'מחיקה';
    button.addEventListener('click', function () {
      ui.confirm({
        title: 'מחיקת משימה',
        message: 'המשימה תימחק לצמיתות. להמשיך?',
        confirmLabel: 'מחיקה',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) return;
        store.deleteTask(taskId);
        document.querySelectorAll('.modal-backdrop').forEach(function (node) { node.remove(); });
        ui.toast('המשימה נמחקה');
      });
    });
    return button;
  }

  function render(container, context) {
    var type = context.type;

    container.innerHTML =
      '<div class="screen-head">' +
        '<div><h2>משימות</h2><div class="sub" id="tasks-count"></div></div>' +
        '<button type="button" class="btn btn--primary" id="add-task">משימה חדשה</button>' +
      '</div>' +
      '<div class="filters">' +
        '<select id="f-cadet"></select>' +
        '<select id="f-status"></select>' +
        '<select id="f-priority"></select>' +
        '<select id="f-category"></select>' +
        '<input type="date" id="f-from" aria-label="מתאריך">' +
        '<input type="date" id="f-to" aria-label="עד תאריך">' +
        '<select id="f-sort"></select>' +
        '<button type="button" class="btn btn--sm btn--ghost" id="f-clear">ניקוי סינון</button>' +
      '</div>' +
      '<div class="list" id="task-list"></div>';

    var cadetSelect = container.querySelector('#f-cadet');
    /* רשימת הצוערים לסינון מצומצמת לסוג שנבחר בכותרת, כדי לא להציע מי שממילא מוסתר. */
    var selectable = store.cadets({ type: type });
    fillSelect(cadetSelect, [{ value: '', label: 'כל הצוערים' }].concat(selectable.map(function (cadet) {
      return { value: cadet.id, label: cadet.name };
    })), filters.cadetId);
    if (filters.cadetId && !util.byId(selectable, filters.cadetId)) {
      filters.cadetId = '';
      cadetSelect.value = '';
    }

    fillSelect(container.querySelector('#f-status'),
      [{ value: '', label: 'כל הסטטוסים' }, { value: 'open-only', label: 'פתוחות בלבד' }]
        .concat(store.TASK_STATUSES), filters.status);
    fillSelect(container.querySelector('#f-priority'),
      [{ value: '', label: 'כל העדיפויות' }].concat(store.PRIORITIES), filters.priority);
    fillSelect(container.querySelector('#f-category'),
      [{ value: '', label: 'כל הקטגוריות' }].concat(store.categories().map(function (name) {
        return { value: name, label: name };
      })), filters.category);
    fillSelect(container.querySelector('#f-sort'), [
      { value: 'due', label: 'מיון: תאריך יעד' },
      { value: 'priority', label: 'מיון: עדיפות' },
      { value: 'updated', label: 'מיון: עודכן לאחרונה' }
    ], filters.sort || 'due');

    container.querySelector('#f-from').value = filters.from;
    container.querySelector('#f-to').value = filters.to;

    var map = { '#f-cadet': 'cadetId', '#f-status': 'status', '#f-priority': 'priority',
                '#f-category': 'category', '#f-from': 'from', '#f-to': 'to', '#f-sort': 'sort' };
    Object.keys(map).forEach(function (selector) {
      container.querySelector(selector).addEventListener('change', function (event) {
        filters[map[selector]] = event.target.value;
        renderList(container, type);
      });
    });

    container.querySelector('#f-clear').addEventListener('click', function () {
      filters = { cadetId: '', status: '', priority: '', category: '', from: '', to: '', sort: filters.sort };
      App.render();
    });

    container.querySelector('#add-task').addEventListener('click', function () { openCreateForm(); });

    renderList(container, type);
  }

  function fillSelect(select, options, value) {
    select.innerHTML = options.map(function (option) {
      var val = option.value !== undefined ? option.value : '';
      return '<option value="' + util.escape(val) + '"' +
        (String(val) === String(value || '') ? ' selected' : '') + '>' + util.escape(option.label) + '</option>';
    }).join('');
  }

  function renderList(container, type) {
    var query = {
      type: type,
      cadetId: filters.cadetId,
      priority: filters.priority,
      category: filters.category,
      from: filters.from,
      to: filters.to
    };
    if (filters.status === 'open-only') query.openOnly = true;
    else if (filters.status) query.status = filters.status;

    var tasks = store.tasks(query);
    var sort = filters.sort || 'due';
    if (sort === 'priority') {
      tasks = tasks.slice().sort(function (a, b) {
        var diff = store.PRIORITY_ORDER[a.priority] - store.PRIORITY_ORDER[b.priority];
        return diff !== 0 ? diff : String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
      });
    } else if (sort === 'updated') {
      tasks = util.sortBy(tasks, function (t) { return t.updatedAt; }, 'desc');
    } else {
      tasks = util.sortBy(tasks, function (t) { return t.dueDate; });
    }

    var list = container.querySelector('#task-list');
    var count = container.querySelector('#tasks-count');
    var open = tasks.filter(store.isOpen).length;
    count.textContent = tasks.length
      ? tasks.length + ' משימות בתצוגה · ' + open + ' פתוחות'
      : '';

    if (!tasks.length) {
      list.innerHTML = '';
      list.appendChild(ui.emptyState(
        'אין משימות בתצוגה',
        store.cadets().length ? 'נסה לשנות את הסינון, או להטיל משימה חדשה.' : 'קודם צריך להוסיף צוערים.',
        store.cadets().length ? 'משימה חדשה' : null,
        function () { openCreateForm(); }
      ));
      return;
    }

    list.innerHTML = tasks.map(function (task) {
      return ui.taskRow(task, { showCadet: true, bucket: store.attentionBucket(task) });
    }).join('');
    ui.bindTaskRows(list, openEditForm);
  }

  App.screens = App.screens || {};
  App.screens.tasks = {
    render: render,
    openCreateForm: openCreateForm,
    openEditForm: openEditForm
  };
})(window.App);
