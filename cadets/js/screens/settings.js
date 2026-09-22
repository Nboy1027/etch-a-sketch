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
        '<div class="section__head"><h3>גיבוי לגוגל דרייב</h3></div>' +
        '<div class="card stack">' +
          '<div id="drive-status"></div>' +
          '<div class="field">' +
            '<label for="drive-client">מזהה OAuth (Client ID)</label>' +
            '<input id="drive-client" class="ltr" type="text" dir="ltr" spellcheck="false" data-no-mic ' +
              'placeholder="1234-abc.apps.googleusercontent.com" value="' +
              util.escape(store.getDevice('driveClientId')) + '">' +
            '<div class="field__hint">נוצר בפרויקט Google Cloud שלך. ההוראות המלאות בהמשך הדף.</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="drive-device">שם המכשיר הזה</label>' +
            '<input id="drive-device" type="text" placeholder="' + util.escape(util.detectDevice()) + '" value="' +
              util.escape(store.getDevice('deviceName')) + '">' +
            '<div class="field__hint">מופיע בשם קובץ הגיבוי, כדי שתדע מאיזה מכשיר הוא נוצר. ' +
              'ריק — ייעשה שימוש בזיהוי האוטומטי.</div>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn btn--primary" id="drive-export">ייצוא לדרייב</button>' +
            '<button type="button" class="btn" id="drive-import">ייבוא מהדרייב</button>' +
            '<button type="button" class="btn btn--ghost" id="drive-disconnect">ניתוק</button>' +
          '</div>' +
          '<div class="field__hint" id="drive-name-preview"></div>' +
        '</div>' +
        '<details class="card" style="margin-top:12px">' +
          '<summary style="cursor:pointer;font-weight:600">איך יוצרים את מזהה ה-OAuth (פעם אחת)</summary>' +
          '<ol style="margin:10px 0 0;padding-inline-start:20px;line-height:1.9">' +
            '<li>היכנס ל-<a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> וצור פרויקט חדש.</li>' +
            '<li>ב-<b>APIs &amp; Services → Library</b> חפש <b>Google Drive API</b> ולחץ Enable.</li>' +
            '<li>ב-<b>OAuth consent screen</b> בחר <b>External</b>, מלא שם ואימייל, ובשלב <b>Test users</b> הוסף את כתובת הגוגל שלך.</li>' +
            '<li>ב-<b>Credentials → Create credentials → OAuth client ID</b> בחר <b>Web application</b>, ותחת <b>Authorized JavaScript origins</b> הוסף בדיוק: <code class="ltr">https://nboy1027.github.io</code></li>' +
            '<li>העתק את ה-Client ID והדבק אותו בשדה למעלה.</li>' +
          '</ol>' +
          '<p class="hint" style="margin-top:10px">ההרשאה המבוקשת היא <code class="ltr">drive.file</code> — הצרה ביותר: ' +
            'האתר רואה רק קבצים שהוא עצמו יצר, ולא את שאר הדרייב שלך. לכן חשוב לתת לאתר ליצור את ' +
            'התיקייה "ניהול צוערים" בעצמו ולא ליצור אותה ידנית.</p>' +
        '</details>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section__head"><h3>גיבוי מקומי לקובץ</h3></div>' +
        '<div class="card stack">' +
          '<p class="hint">גיבוי ישירות לקובץ במכשיר, ללא תלות בחיבור לגוגל. ' +
            'שימושי כשאין אינטרנט, או כגיבוי נוסף לצד הדרייב. שם הקובץ כאן באנגלית בלבד — ' +
            'דפדפנים מתעלמים משם הורדה שמכיל עברית ומורידים אותו בשם "download".</p>' +
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
      util.downloadFile(App.drive.localBackupName(), store.exportJSON(), 'application/json');
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
    wireDrive(container);

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

  /* ===== גוגל דרייב ===== */

  function wireDrive(container) {
    var drive = App.drive;
    var status = container.querySelector('#drive-status');
    var preview = container.querySelector('#drive-name-preview');

    function refresh() {
      if (!drive.isConfigured()) {
        status.innerHTML = '<div class="card__meta">לא מוגדר — הזן מזהה OAuth כדי להפעיל את הגיבוי לדרייב.</div>';
      } else if (drive.isConnected()) {
        status.innerHTML = '<div class="all-clear">מחובר לגוגל דרייב.</div>';
      } else {
        status.innerHTML = '<div class="card__meta">מוגדר. החיבור לגוגל יתבצע בפעולה הראשונה שתבצע.</div>';
      }
      preview.textContent = 'שם הקובץ הבא: ' + drive.backupName();
    }

    container.querySelector('#drive-client').addEventListener('change', function (event) {
      store.setDevice('driveClientId', event.target.value.trim());
      drive.disconnect();
      refresh();
      ui.toast('המזהה נשמר');
    });

    container.querySelector('#drive-device').addEventListener('change', function (event) {
      store.setDevice('deviceName', event.target.value.trim());
      refresh();
      ui.toast('שם המכשיר נשמר');
    });

    container.querySelector('#drive-disconnect').addEventListener('click', function () {
      drive.disconnect();
      refresh();
      ui.toast('החיבור נותק במכשיר הזה');
    });

    container.querySelector('#drive-export').addEventListener('click', function (event) {
      var button = event.currentTarget;
      run(button, 'מעלה...', drive.upload().then(function (file) {
        refresh();
        ui.toast('הגיבוי הועלה: ' + file.name);
      }));
    });

    container.querySelector('#drive-import').addEventListener('click', function (event) {
      var button = event.currentTarget;
      run(button, 'מחפש...', drive.latest().then(function (file) {
        if (!file) {
          throw new Error('לא נמצא גיבוי בתיקיית "' + drive.FOLDER_NAME + '" בדרייב. ' +
            'ייתכן שעדיין לא ייצאת ממכשיר כלשהו.');
        }
        return ui.confirm({
          title: 'ייבוא מהדרייב',
          message: 'הקובץ האחרון בתיקייה הוא:\n' + file.name + '\n\n' +
            'הייבוא ידרוס את כל המידע שקיים כרגע במכשיר הזה. להמשיך?',
          confirmLabel: 'ייבוא ודריסה',
          danger: true
        }).then(function (confirmed) {
          if (!confirmed) return;
          return drive.download(file.id).then(function (text) {
            store.importJSON(text);
            ui.toast('יובא מהדרייב: ' + file.name);
          });
        });
      }));
    });

    refresh();
  }

  /* מנטרל את הכפתור בזמן פעולת רשת, ומציג שגיאה קריאה אם היא נכשלה. */
  function run(button, busyLabel, promise) {
    var original = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    promise.catch(function (err) {
      ui.openModal({
        title: 'הפעולה נכשלה',
        content: '<p>' + util.escapeMultiline(err && err.message ? err.message : String(err)) + '</p>',
        buttons: [{ label: 'סגירה', className: 'btn--primary', onClick: function (m) { m.close(); } }]
      });
    }).then(function () {
      button.disabled = false;
      button.textContent = original;
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
      headers = ['שם', 'סוג', 'כיתה/צוות', 'קצינות', 'סטטוס',
                 'משימות פתוחות', 'תיעוד אחרון', 'נקודות לשימור', 'נקודות לשיפור', 'רקע'];
      rows = store.cadets().map(function (cadet) {
        var summary = store.cadetSummary(cadet);
        return [cadet.name, store.rolesLabel(cadet), cadet.unit || '',
          cadet.trackId ? store.trackName(cadet.trackId) : '',
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
        return [task.trackId ? 'קצינות ' + store.trackName(task.trackId) : store.cadetName(task.cadetId),
          task.trackId ? 'קצינותי' : (cadet ? store.rolesLabel(cadet) : ''),
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
