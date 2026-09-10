/* רכיבי ממשק משותפים: מודאל, בונה טפסים, אישור, הודעות, ורכיבי תצוגה חוזרים. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var modalRoot = null;
  var openModals = [];

  function root() {
    if (!modalRoot) modalRoot = document.getElementById('modal-root');
    return modalRoot;
  }

  /* ===== מודאל ===== */

  function openModal(options) {
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal' + (options.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<h3>' + util.escape(options.title) + '</h3>' +
          '<button type="button" class="modal__close" aria-label="סגירה">&times;</button>' +
        '</div>' +
        '<div class="modal__body"></div>' +
        '<div class="modal__foot"></div>' +
      '</div>';

    var body = backdrop.querySelector('.modal__body');
    var foot = backdrop.querySelector('.modal__foot');
    if (typeof options.content === 'string') body.innerHTML = options.content;
    else if (options.content) body.appendChild(options.content);

    var handle = {
      element: backdrop,
      body: body,
      foot: foot,
      close: function () {
        var index = openModals.indexOf(handle);
        if (index === -1) return;
        openModals.splice(index, 1);
        backdrop.remove();
        if (typeof options.onClose === 'function') options.onClose();
      }
    };

    (options.buttons || []).forEach(function (spec) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn ' + (spec.className || '');
      button.textContent = spec.label;
      button.addEventListener('click', function () { spec.onClick(handle); });
      foot.appendChild(button);
    });

    backdrop.querySelector('.modal__close').addEventListener('click', handle.close);
    backdrop.addEventListener('mousedown', function (event) {
      if (event.target === backdrop) handle.close();
    });

    root().appendChild(backdrop);
    openModals.push(handle);

    var firstField = body.querySelector('input, select, textarea');
    if (firstField) firstField.focus();
    return handle;
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && openModals.length) {
      openModals[openModals.length - 1].close();
    }
  });

  /* ===== הודעות ===== */

  function toast(message) {
    var node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    document.getElementById('toast-root').appendChild(node);
    setTimeout(function () { node.remove(); }, 2600);
  }

  function confirm(options) {
    return new Promise(function (resolve) {
      var settled = false;
      var finish = function (handle, value) {
        settled = true;
        handle.close();
        resolve(value);
      };
      openModal({
        title: options.title,
        content: '<p>' + util.escapeMultiline(options.message) + '</p>',
        onClose: function () { if (!settled) resolve(false); },
        buttons: [
          {
            label: options.confirmLabel || 'אישור',
            className: options.danger ? 'btn--danger' : 'btn--primary',
            onClick: function (handle) { finish(handle, true); }
          },
          { label: 'ביטול', className: 'btn--ghost', onClick: function (handle) { finish(handle, false); } }
        ]
      });
    });
  }

  /* ===== בונה טפסים =====
     שדה: { name, label, type, options, required, rows, hint, placeholder, half }
     סוגי שדה: text, tel, date, textarea, select, cadet-picker, static */

  function buildField(field, values) {
    var value = values[field.name];
    var wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.dataset.name = field.name;

    var id = 'f-' + field.name + '-' + Math.random().toString(36).slice(2, 7);
    var labelHtml = field.label
      ? '<label for="' + id + '">' + util.escape(field.label) + (field.required ? ' *' : '') + '</label>'
      : '';
    var hintHtml = field.hint ? '<div class="field__hint">' + util.escape(field.hint) + '</div>' : '';
    var controlHtml = '';

    if (field.type === 'textarea') {
      controlHtml = '<textarea id="' + id + '" rows="' + (field.rows || 3) + '" placeholder="' +
        util.escape(field.placeholder || '') + '">' + util.escape(value || '') + '</textarea>';
    } else if (field.type === 'select') {
      controlHtml = '<select id="' + id + '">' + (field.options || []).map(function (option) {
        var selected = String(option.value) === String(value === undefined ? '' : value) ? ' selected' : '';
        return '<option value="' + util.escape(option.value) + '"' + selected + '>' +
          util.escape(option.label) + '</option>';
      }).join('') + '</select>';
    } else if (field.type === 'cadet-picker') {
      controlHtml =
        '<div class="picker" id="' + id + '">' +
          '<div class="picker__tools">' +
            '<button type="button" class="btn btn--sm" data-pick="all">כל המוצגים</button>' +
            '<button type="button" class="btn btn--sm" data-pick="personal">כל האישיים</button>' +
            '<button type="button" class="btn btn--sm" data-pick="officer">כל הקצינותיים</button>' +
            '<button type="button" class="btn btn--sm btn--ghost" data-pick="none">ניקוי</button>' +
          '</div>' +
          (field.options || []).map(function (cadet) {
            var checked = (value || []).indexOf(cadet.id) !== -1 ? ' checked' : '';
            return '<label class="picker__item" data-roles="' + util.escape((cadet.roles || []).join(' ')) + '">' +
              '<input type="checkbox" value="' + util.escape(cadet.id) + '"' + checked + '>' +
              '<span>' + util.escape(cadet.name) + '</span>' +
              roleBadges(cadet) +
              '</label>';
          }).join('') +
        '</div>';
    } else if (field.type === 'checkgroup') {
      controlHtml = '<div class="picker" id="' + id + '">' + (field.options || []).map(function (option) {
        var checked = (value || []).indexOf(option.value) !== -1 ? ' checked' : '';
        return '<label class="picker__item">' +
          '<input type="checkbox" value="' + util.escape(option.value) + '"' + checked + '>' +
          '<span>' + util.escape(option.label) + '</span></label>';
      }).join('') + '</div>';
    } else if (field.type === 'static') {
      controlHtml = '<div class="muted">' + util.escapeMultiline(value || '') + '</div>';
    } else {
      controlHtml = '<input id="' + id + '" type="' + (field.type || 'text') + '" value="' +
        util.escape(value === undefined || value === null ? '' : value) + '" placeholder="' +
        util.escape(field.placeholder || '') + '">';
    }

    wrapper.innerHTML = labelHtml + controlHtml + hintHtml;

    if (field.type === 'cadet-picker') {
      wrapper.querySelectorAll('[data-pick]').forEach(function (button) {
        button.addEventListener('click', function () {
          var mode = button.dataset.pick;
          wrapper.querySelectorAll('.picker__item').forEach(function (item) {
            var box = item.querySelector('input');
            if (mode === 'none') box.checked = false;
            else if (mode === 'all') box.checked = true;
            else box.checked = (item.dataset.roles || '').split(' ').indexOf(mode) !== -1;
          });
        });
      });
    }
    return wrapper;
  }

  function readField(wrapper, field) {
    if (field.type === 'static') return undefined;
    if (field.type === 'cadet-picker' || field.type === 'checkgroup') {
      return Array.prototype.slice.call(wrapper.querySelectorAll('input:checked')).map(function (box) {
        return box.value;
      });
    }
    var control = wrapper.querySelector('input, select, textarea');
    return control ? control.value.trim() : '';
  }

  function isEmpty(value) {
    return value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);
  }

  /* פותח טופס במודאל. onSubmit מקבל את הערכים ומחזיר false כדי להשאיר את הטופס פתוח. */
  function openForm(options) {
    var values = options.values || {};
    var form = document.createElement('div');
    form.className = 'form';
    var wrappers = {};

    (options.fields || []).forEach(function (field) {
      if (Array.isArray(field)) {
        var row = document.createElement('div');
        row.className = 'field-row';
        field.forEach(function (sub) {
          wrappers[sub.name] = buildField(sub, values);
          row.appendChild(wrappers[sub.name]);
        });
        form.appendChild(row);
      } else {
        wrappers[field.name] = buildField(field, values);
        form.appendChild(wrappers[field.name]);
      }
    });

    var flat = [];
    (options.fields || []).forEach(function (field) {
      if (Array.isArray(field)) flat = flat.concat(field);
      else flat.push(field);
    });

    var handle = openModal({
      title: options.title,
      content: form,
      wide: options.wide,
      buttons: [
        {
          label: options.submitLabel || 'שמירה',
          className: 'btn--primary',
          onClick: function (modal) {
            var result = {};
            var firstInvalid = null;

            flat.forEach(function (field) {
              var wrapper = wrappers[field.name];
              wrapper.classList.remove('has-error');
              var existingError = wrapper.querySelector('.field__error');
              if (existingError) existingError.remove();

              var value = readField(wrapper, field);
              if (value !== undefined) result[field.name] = value;

              if (field.required && isEmpty(value)) {
                wrapper.classList.add('has-error');
                var error = document.createElement('div');
                error.className = 'field__error';
                error.textContent = 'שדה חובה';
                wrapper.appendChild(error);
                if (!firstInvalid) firstInvalid = wrapper;
              }
            });

            if (firstInvalid) {
              var control = firstInvalid.querySelector('input, select, textarea');
              if (control) control.focus();
              return;
            }
            if (options.onSubmit(result) !== false) modal.close();
          }
        },
        { label: 'ביטול', className: 'btn--ghost', onClick: function (modal) { modal.close(); } }
      ]
    });
    return handle;
  }

  /* ===== רכיבי תצוגה חוזרים ===== */

  function roleBadges(cadet) {
    return (cadet.roles || []).map(function (role) {
      return '<span class="badge badge--' + util.escape(role) + '">' +
        util.escape(store.label('role', role)) + '</span>';
    }).join('');
  }

  function sentimentBadge(sentiment) {
    if (!sentiment) return '';
    var tone = { good: 'ok', ok: 'warn', concern: 'danger' }[sentiment] || '';
    return '<span class="badge badge--' + tone + '">' + util.escape(store.label('sentiment', sentiment)) + '</span>';
  }

  function dueLabel(task) {
    if (!task.dueDate) return '<span class="muted">ללא תאריך יעד</span>';
    var today = util.today();
    var cls = '';
    if (store.isOpen(task)) {
      if (task.dueDate < today) cls = ' due--overdue';
      else {
        var left = util.dayDiff(today, task.dueDate);
        if (left !== null && left <= store.THRESHOLDS.dueSoonDays) cls = ' due--soon';
      }
    }
    return '<span class="due' + cls + '">יעד: ' + util.formatDate(task.dueDate) +
      (store.isOpen(task) ? ' · ' + util.relativeDays(task.dueDate) : '') + '</span>';
  }

  /* שורת משימה. showCadet מוסיף את שם הצוער, bucket מוסיף פס צבע בצד. */
  function taskRow(task, options) {
    var opts = options || {};
    var closed = !store.isOpen(task);
    var cadet = store.cadet(task.cadetId);
    var classes = ['task'];
    if (opts.bucket) classes.push('task--' + opts.bucket);

    return '<div class="' + classes.join(' ') + '" data-task-id="' + util.escape(task.id) + '">' +
      '<div class="task__body">' +
        '<div class="task__title' + (closed ? ' is-done' : '') + '">' + util.escape(task.title) + '</div>' +
        '<div class="task__meta">' +
          (opts.showCadet && cadet
            ? '<a href="#/cadet/' + util.escape(cadet.id) + '">' + util.escape(cadet.name) + '</a>' : '') +
          '<span class="badge badge--' + util.escape(task.priority) + '">' +
            util.escape(store.label('priority', task.priority)) + '</span>' +
          (task.category ? '<span class="badge">' + util.escape(task.category) + '</span>' : '') +
          dueLabel(task) +
          (opts.bucket === 'stale'
            ? '<span class="muted">ללא עדכון ' + util.days(util.daysSince((task.updatedAt || '').slice(0, 10))) + '</span>'
            : '') +
          (task.groupId ? '<span class="badge">הטלה קבוצתית</span>' : '') +
        '</div>' +
        (task.description ? '<div class="task__desc">' + util.escapeMultiline(task.description) + '</div>' : '') +
      '</div>' +
      '<div class="task__side">' +
        '<select class="status-select" data-task-status="' + util.escape(task.id) + '" aria-label="סטטוס משימה">' +
          store.TASK_STATUSES.map(function (status) {
            return '<option value="' + status.value + '"' +
              (status.value === task.status ? ' selected' : '') + '>' + status.label + '</option>';
          }).join('') +
        '</select>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-task-edit="' + util.escape(task.id) + '">עריכה</button>' +
      '</div>' +
    '</div>';
  }

  /* מחבר את אירועי שורות המשימה בתוך מכולה נתונה. */
  function bindTaskRows(container, onEdit) {
    container.querySelectorAll('[data-task-status]').forEach(function (select) {
      select.addEventListener('change', function () {
        store.updateTask(select.dataset.taskStatus, { status: select.value });
        toast('הסטטוס עודכן');
      });
    });
    container.querySelectorAll('[data-task-edit]').forEach(function (button) {
      button.addEventListener('click', function () { onEdit(button.dataset.taskEdit); });
    });
  }

  function emptyState(title, message, actionLabel, onAction) {
    var node = document.createElement('div');
    node.className = 'empty';
    node.innerHTML = '<div class="empty__title">' + util.escape(title) + '</div>' +
      '<div>' + util.escape(message || '') + '</div>';
    if (actionLabel) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--primary';
      button.style.marginTop = '14px';
      button.textContent = actionLabel;
      button.addEventListener('click', onAction);
      node.appendChild(button);
    }
    return node;
  }

  App.ui = {
    openModal: openModal,
    openForm: openForm,
    confirm: confirm,
    toast: toast,
    roleBadges: roleBadges,
    sentimentBadge: sentimentBadge,
    dueLabel: dueLabel,
    taskRow: taskRow,
    bindTaskRows: bindTaskRows,
    emptyState: emptyState
  };
})(window.App);
