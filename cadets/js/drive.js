/* גיבוי לגוגל דרייב.
   ההרשאה היא drive.file בלבד — ההיקף המצומצם ביותר: האתר רואה רק קבצים
   שהוא עצמו יצר, ולא את שאר הדרייב. לכן התיקייה חייבת להיווצר על ידי האתר. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;
  var store = App.store;

  var GIS_SRC = 'https://accounts.google.com/gsi/client';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var FOLDER_NAME = 'ניהול צוערים';
  var FOLDER_MIME = 'application/vnd.google-apps.folder';
  var API = 'https://www.googleapis.com/drive/v3/files';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var TOKEN_KEY = 'cadets-drive-token';

  var token = null;
  var scriptPromise = null;

  function clientId() {
    return String(store.getDevice('driveClientId')).trim();
  }

  function deviceName() {
    return String(store.getDevice('deviceName')).trim() || util.detectDevice();
  }

  /* ===== הרשאה ===== */

  function loadScript() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var tag = document.createElement('script');
      tag.src = GIS_SRC;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = function () {
        scriptPromise = null;
        reject(new Error('טעינת ספריית ההתחברות של Google נכשלה. בדוק את חיבור האינטרנט.'));
      };
      document.head.appendChild(tag);
    });
    return scriptPromise;
  }

  function readStoredToken() {
    try {
      var raw = sessionStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.expiresAt > Date.now() ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function storeToken(value) {
    token = value;
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      /* אחסון חסום — נמשיך עם האסימון בזיכרון בלבד. */
    }
  }

  function requestToken() {
    if (!clientId()) {
      return Promise.reject(new Error('חסר מזהה OAuth. הזן אותו בהגדרות לפני החיבור לדרייב.'));
    }
    return loadScript().then(function () {
      return new Promise(function (resolve, reject) {
        var client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId(),
          scope: SCOPE,
          callback: function (response) {
            if (response.error) {
              reject(new Error('ההתחברות לגוגל נכשלה: ' + (response.error_description || response.error)));
              return;
            }
            storeToken({
              value: response.access_token,
              /* שולי דקה, כדי לא לשלוח בקשה עם אסימון שפג בדיוק בדרך. */
              expiresAt: Date.now() + ((response.expires_in || 3600) * 1000) - 60000
            });
            resolve(token.value);
          },
          error_callback: function (err) {
            reject(new Error(err && err.type === 'popup_closed'
              ? 'חלון ההתחברות נסגר לפני שהושלמה ההרשאה.'
              : 'חלון ההתחברות נחסם. אפשר חלונות קופצים לאתר ונסה שוב.'));
          }
        });
        client.requestAccessToken({ prompt: '' });
      });
    });
  }

  function ensureToken() {
    if (!token) token = readStoredToken();
    if (token && token.expiresAt > Date.now()) return Promise.resolve(token.value);
    return requestToken();
  }

  /* ===== קריאות ל-API ===== */

  function request(url, options) {
    var opts = options || {};
    return ensureToken().then(function (accessToken) {
      var headers = Object.assign({ Authorization: 'Bearer ' + accessToken }, opts.headers || {});
      return fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body });
    }).then(function (response) {
      if (response.status === 401 || response.status === 403) {
        /* אסימון שפג או הרשאה שנשללה — מנקים כדי שהניסיון הבא יבקש התחברות. */
        storeToken(null);
        return response.text().then(function (text) {
          throw new Error(response.status === 401
            ? 'ההרשאה פגה. לחץ שוב על הפעולה כדי להתחבר מחדש.'
            : 'גוגל דחתה את הבקשה. ודא שה-Drive API מופעל בפרויקט ושהמזהה שייך לכתובת הזו. ' + short(text));
        });
      }
      if (!response.ok) {
        return response.text().then(function (text) {
          throw new Error('שגיאה מגוגל דרייב (' + response.status + '). ' + short(text));
        });
      }
      return response;
    });
  }

  function short(text) {
    var trimmed = String(text || '').slice(0, 200);
    try {
      var parsed = JSON.parse(text);
      if (parsed && parsed.error && parsed.error.message) return parsed.error.message;
    } catch (err) { /* לא JSON — מחזירים את הטקסט כמו שהוא */ }
    return trimmed;
  }

  function json(url, options) {
    return request(url, options).then(function (response) { return response.json(); });
  }

  /* התיקייה נבדקת בכל פעולה במקום להישמר במטמון, כדי שמחיקה או שינוי שם
     בדרייב לא ישאירו אותנו עם מזהה שאינו קיים. */
  function folderId() {
    var query = "mimeType='" + FOLDER_MIME + "' and name='" + FOLDER_NAME + "' and trashed=false";
    var url = API + '?q=' + encodeURIComponent(query) + '&fields=' + encodeURIComponent('files(id,name)') +
      '&pageSize=10';
    return json(url).then(function (result) {
      if (result.files && result.files.length) return result.files[0].id;
      return json(API + '?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME })
      }).then(function (created) { return created.id; });
    });
  }

  function backupName() {
    return FOLDER_NAME + ' - ' + deviceName() + ' - ' + util.fileStamp() + '.json';
  }

  /* שם להורדה מקומית: ASCII בלבד, אחרת הדפדפן מתעלם ממנו. */
  function localBackupName() {
    return 'cadets-backup-' + util.asciiName(deviceName(), util.detectDevice()) +
      '-' + util.fileStamp() + '.json';
  }

  function upload() {
    var name = backupName();
    var content = store.exportJSON();
    return folderId().then(function (parent) {
      var boundary = 'cadets-' + util.uid();
      var body =
        '--' + boundary + '\r\n' +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify({ name: name, parents: [parent], mimeType: 'application/json' }) + '\r\n' +
        '--' + boundary + '\r\n' +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        content + '\r\n' +
        '--' + boundary + '--';

      return json(UPLOAD + '?uploadType=multipart&fields=' + encodeURIComponent('id,name'), {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      });
    });
  }

  /* הקובץ האחרון בתיקייה, לפי מועד היצירה. */
  function latest() {
    return folderId().then(function (parent) {
      var query = "'" + parent + "' in parents and trashed=false";
      var url = API + '?q=' + encodeURIComponent(query) +
        '&orderBy=createdTime%20desc&pageSize=1&fields=' +
        encodeURIComponent('files(id,name,createdTime,size)');
      return json(url);
    }).then(function (result) {
      return result.files && result.files.length ? result.files[0] : null;
    });
  }

  function download(fileId) {
    return request(API + '/' + encodeURIComponent(fileId) + '?alt=media')
      .then(function (response) { return response.text(); });
  }

  App.drive = {
    FOLDER_NAME: FOLDER_NAME,
    isConfigured: function () { return !!clientId(); },
    isConnected: function () {
      if (!token) token = readStoredToken();
      return !!(token && token.expiresAt > Date.now());
    },
    deviceName: deviceName,
    backupName: backupName,
    localBackupName: localBackupName,
    connect: function () { return ensureToken(); },
    disconnect: function () { storeToken(null); },
    upload: upload,
    latest: latest,
    download: download
  };
})(window.App);
