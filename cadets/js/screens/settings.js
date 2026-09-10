/* הגדרות וגיבוי: ייצוא, ייבוא, ניהול קטגוריות ומחיקת כל הנתונים. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;
  var ui = App.ui;

  function render(container) {
    var data = store.all();
    var counts = [
      ['צוערים', data.cadets.length],
      ['משימות', data.tasks.length],
      ['פגישות אישיות', data.meetings.length],
      ['מפגשי קצינות', data.groupMeetings.length],
      ['הערות', data.notes.length],
      ['יעדים', data.goals.length]
    ];

    container.innerHTML =
      '<div class="screen-head"><div><h2>הגדרות וגיבוי</h2></div></div>' +

      (store.isStorageAvailable() ? '' :
        '<div class="card" style="margin-bottom:16px;border-color:var(--danger)">' +
          '<div class="card__title" style="color:var(--danger)">הדפדפן חוסם שמירה מקומית</div>' +
          '<div class="card__meta">המידע קיים בזיכרון בלבד ויימחק בסגירת הכרטיסייה. ' +
          'ייצא קובץ גיבוי עכשיו, ובדוק את הגדרות הפרטיות של הדפדפן (חסימת נתוני אתרים או גלישה פרטית).</div>' +
        '</div>') +

      '<section class="section">' +
        '<div class="section__head"><h3>מה שמור במערכת</h3></div>' +
        '<div class="card"><div class="cadet-card__stats">' +
          counts.map(function (row) {
            return '<div class="stat"><span>' + util.escape(row[0]) + ':</span>' +
              '<span class="stat__value">' + row[1] + '</span></div>';
          }).join('') +
        '</div></div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section__head"><h3>גיבוי והעברה בין מכשירים</h3></div>' +
        '<div class="card stack">' +
          '<p class="hint">המידע נשמר בדפדפן שבו הוא נוצר בלבד. כדי לעבוד גם מהנייד, ' +
            'ייצא קובץ גיבוי כאן וייבא אותו במכשיר השני. שמור גיבוי אחת לתקופה — ' +
            'ניקוי נתוני האתרים בדפדפן מוחק את המידע.</p>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn btn--primary" id="export-json">ייצוא גיבוי מלא (JSON)</button>' +
            '<button type="button" class="btn" id="import-json">ייבוא מקובץ גיבוי</button>' +
          '</div>' +
          '<input type="file" id="import-file" accept="application/json,.json" class="sr-only">' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section__head"><h3>ייצוא לאקסל</h3></div>' +
        '<div class="card stack">' +
          '<p class="hint">קובצי CSV לפתיחה באקסל. הם נועדו לקריאה ולהדפסה — ייבוא חזרה למערכת ' +
            'נעשה מקובץ ה-JSON בלבד.</p>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn" data-csv="cadets">צוערים</button>' +
            '<button type="button" class="btn" data-csv="tasks">משימות</button>' +
            '<button type="button" class="btn" data-csv="meetings">פגישות והצגות</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section__head"><h3>קטגוריות משימה</h3></div>' +
        '<div class="card stack">' +
          '<div class="row" id="category-list"></div>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn btn--sm" id="add-category">הוספת קטגוריה</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section__head"><h3>אזור מסוכן</h3></div>' +
        '<div class="card">' +
          '<p class="hint">מחיקת כל הנתונים במערכת. ודא שיש לך קובץ גיבוי לפני שאתה ממשיך.</p>' +
          '<button type="button" class="btn btn--danger" id="wipe">מחיקת כל הנתונים</button>' +
        '</div>' +
      '</section>';

    container.querySelector('#export-json').addEventListener('click', function () {
      util.downloadFile('cadets-backup-' + util.today() + '.json', store.exportJSON(), 'application/json');
      ui.toast('קובץ הגיבוי הורד');
    });

    var fileInput = container.querySelector('#import-file');
    container.querySelector('#import-json').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ui.confirm({
          title: 'ייבוא גיבוי',
          message: 'הייבוא ידרוס את כל המידע שקיים כרגע במערכת ויחליף אותו בתוכן הקובץ. להמשיך?',
          confirmLabel: 'ייבוא ודריסה',
          danger: true
        }).then(function (confirmed) {
          fileInput.value = '';
          if (!confirmed) return;
          try {
            store.importJSON(String(reader.result));
            ui.toast('הגיבוי יובא בהצלחה');
          } catch (err) {
            ui.openModal({
              title: 'הייבוא נכשל',
              content: '<p>' + util.escape(err.message || 'הקובץ אינו תקין') + '</p>',
              buttons: [{ label: 'סגירה', className: 'btn--primary', onClick: function (m) { m.close(); } }]
            });
          }
        });
      };
      reader.readAsText(file);
    });

    container.querySelectorAll('[data-csv]').forEach(function (button) {
      button.addEventListener('click', function () { exportCSV(button.dataset.csv); });
    });

    renderCategories(container);

    container.querySelector('#wipe').addEventListener('click', function () {
      ui.confirm({
        title: 'מחיקת כל הנתונים',
        message: 'כל הצוערים, המשימות, הפגישות, ההערות והיעדים יימחקו לצמיתות. הפעולה אינה הפיכה.',
        confirmLabel: 'המשך',
        danger: true
      }).then(function (first) {
        if (!first) return;
        return ui.confirm({
          title: 'אישור אחרון',
          message: 'זו ההזדמנות האחרונה לעצור. למחוק את הכול?',
          confirmLabel: 'מחיקת הכול',
          danger: true
        });
      }).then(function (second) {
        if (!second) return;
        store.replaceAll();
        ui.toast('כל הנתונים נמחקו');
        location.hash = '#/home';
      });
    });
  }

  function renderCategories(container) {
    var list = container.querySelector('#category-list');
    list.innerHTML = store.categories().map(function (name) {
      return '<span class="badge">' + util.escape(name) +
        ' <button type="button" class="modal__close" style="font-size:15px" data-remove-category="' +
        util.escape(name) + '" aria-label="הסרה">&times;</button></span>';
    }).join('') || '<span class="hint">אין קטגוריות</span>';

    list.querySelectorAll('[data-remove-category]').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.dataset.removeCategory;
        var inUse = store.tasks({ category: name }).length;
        ui.confirm({
          title: 'הסרת קטגוריה',
          message: inUse
            ? 'הקטגוריה משויכת ל-' + util.plural(inUse, 'משימה אחת', 'משימות') +
              '. הן יישארו במערכת עם הקטגוריה הקיימת, אבל היא לא תוצע יותר במשימות חדשות. להסיר?'
            : 'להסיר את הקטגוריה "' + name + '"?',
          confirmLabel: 'הסרה'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.setCategories(store.categories().filter(function (c) { return c !== name; }));
        });
      });
    });

    container.querySelector('#add-category').addEventListener('click', function () {
      ui.openForm({
        title: 'קטגוריה חדשה',
        values: { name: '' },
        fields: [{ name: 'name', label: 'שם הקטגוריה', required: true }],
        onSubmit: function (result) {
          var categories = store.categories();
          if (categories.indexOf(result.name) !== -1) {
            ui.toast('הקטגוריה כבר קיימת');
            return;
          }
          store.setCategories(categories.concat([result.name]));
          ui.toast('הקטגוריה נוספה');
        }
      });
    });
  }

  function exportCSV(kind) {
    var headers, rows, filename;

    if (kind === 'cadets') {
      filename = 'cadets';
      headers = ['שם', 'סוג', 'כיתה/צוות', 'טלפון', 'תאריך גיוס', 'סטטוס',
                 'משימות פתוחות', 'תיעוד אחרון', 'נקודות לשימור', 'נקודות לשיפור', 'רקע'];
      rows = store.cadets().map(function (cadet) {
        var summary = store.cadetSummary(cadet);
        return [cadet.name, store.rolesLabel(cadet), cadet.unit || '', cadet.phone || '',
          cadet.enlistDate ? util.formatDate(cadet.enlistDate) : '',
          cadet.active === false ? 'לא פעיל' : 'פעיל', summary.openTasks,
          summary.contacts.map(function (record) {
            return store.label('role', record.role) + ': ' +
              (record.date ? util.formatDate(record.date) : 'אין');
          }).join(' | '),
          cadet.keepPoints || '', cadet.improvePoints || '', cadet.background || ''];
      });
    } else if (kind === 'tasks') {
      filename = 'tasks';
      headers = ['צוער', 'סוג צוער', 'כותרת', 'תיאור', 'עדיפות', 'קטגוריה',
                 'תאריך יעד', 'סטטוס', 'עודכן'];
      rows = store.tasks({}).map(function (task) {
        var cadet = store.cadet(task.cadetId);
        return [store.cadetName(task.cadetId), cadet ? store.rolesLabel(cadet) : '',
          task.title, task.description || '', store.label('priority', task.priority),
          task.category || '', task.dueDate ? util.formatDate(task.dueDate) : '',
          store.label('status', task.status), util.formatDate((task.updatedAt || '').slice(0, 10))];
      });
    } else {
      filename = 'meetings';
      headers = ['תאריך', 'צוער', 'סוג תיעוד', 'נושאים / מה הציג', 'נקודות לשימור',
                 'נקודות לשיפור', 'סיכומים לפעם הבאה', 'תחושה כללית', 'מלל חופשי'];
      rows = [];
      store.meetings({}).forEach(function (meeting) {
        rows.push([util.formatDate(meeting.date), store.cadetName(meeting.cadetId), 'פגישה אישית',
          meeting.topics || '', meeting.strengths || '', meeting.improvements || '',
          meeting.followups || '', store.label('sentiment', meeting.sentiment), meeting.freeText || '']);
      });
      store.groupMeetings().forEach(function (meeting) {
        meeting.entries.forEach(function (entry) {
          if (entry.absent) {
            rows.push([util.formatDate(meeting.date), store.cadetName(entry.cadetId),
              'מפגש קצינות — נעדר', '', '', '', '', '', '']);
            return;
          }
          rows.push([util.formatDate(meeting.date), store.cadetName(entry.cadetId), 'מפגש קצינות',
            entry.presented || '', entry.strengths || '', entry.improvements || '',
            entry.followups || '', store.label('sentiment', entry.sentiment), entry.freeText || '']);
        });
      });
      rows = util.sortBy(rows, function (row) { return row[0]; }, 'desc');
    }

    util.downloadFile(filename + '-' + util.today() + '.csv', util.toCSV(headers, rows), 'text/csv');
    ui.toast('הקובץ הורד');
  }

  App.screens = App.screens || {};
  App.screens.settings = { render: render };
})(window.App);
