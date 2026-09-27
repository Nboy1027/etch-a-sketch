/* תמונות של פגישות.
   הן נשמרות ב-IndexedDB ולא ב-localStorage: ל-localStorage יש תקרה של כ-5MB,
   ותמונה אחת מהטלפון הייתה ממלאת אותה ושוברת את השמירה של כל שאר המידע.
   בנוסף כל תמונה מכווצת לפני השמירה, כדי שגם הגיבוי יישאר בר-העלאה. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var DB_NAME = 'cadets-photos';
  var STORE = 'photos';
  var MAX_DIMENSION = 1400;
  var QUALITY = 0.72;

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('הדפדפן אינו תומך בשמירת תמונות.'));
        return;
      }
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () {
        dbPromise = null;
        reject(new Error('לא ניתן לפתוח את מאגר התמונות בדפדפן.'));
      };
    });
    return dbPromise;
  }

  function transact(mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        try {
          result = run(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = function () { resolve(result && result.value !== undefined ? result.value : result); };
        tx.onerror = function () { reject(new Error('פעולת התמונות נכשלה.')); };
        tx.onabort = function () {
          reject(new Error(tx.error && tx.error.name === 'QuotaExceededError'
            ? 'אין מספיק מקום פנוי במכשיר לשמירת התמונה.'
            : 'פעולת התמונות נכשלה.'));
        };
      });
    });
  }

  function request(store, method, arg) {
    var req = store[method](arg);
    var box = {};
    req.onsuccess = function () { box.value = req.result; };
    return box;
  }

  /* כיווץ לפני שמירה: הקטנה לצלע המרבית והמרה ל-JPEG. */
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('קריאת הקובץ נכשלה.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () {
          reject(new Error('לא ניתן לקרוא את התמונה. נסה קובץ בפורמט JPG או PNG.'));
        };
        image.onload = function () {
          var scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
          } catch (err) {
            reject(new Error('עיבוד התמונה נכשל.'));
          }
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  var photos = {
    isSupported: function () { return !!window.indexedDB; },

    add: function (file) {
      if (!/^image\//.test(file.type)) {
        return Promise.reject(new Error('אפשר לצרף קובצי תמונה בלבד.'));
      }
      return compress(file).then(function (dataUrl) {
        var record = { id: App.util.uid(), dataUrl: dataUrl, createdAt: App.util.now() };
        return transact('readwrite', function (store) { store.put(record); })
          .then(function () { return record.id; });
      });
    },

    get: function (id) {
      return transact('readonly', function (store) { return request(store, 'get', id); })
        .then(function (record) { return record ? record.dataUrl : null; });
    },

    remove: function (id) {
      return transact('readwrite', function (store) { store.delete(id); });
    },

    /* כל התמונות שבשימוש, לצורך הכללתן בגיבוי. */
    exportAll: function (ids) {
      if (!ids || !ids.length) return Promise.resolve({});
      return transact('readonly', function (store) {
        var box = { value: {} };
        ids.forEach(function (id) {
          var req = store.get(id);
          req.onsuccess = function () { if (req.result) box.value[id] = req.result.dataUrl; };
        });
        return box;
      });
    },

    /* ייבוא גיבוי: מחליף את כל מאגר התמונות בתוכן הקובץ. */
    replaceAll: function (map) {
      return transact('readwrite', function (store) {
        store.clear();
        Object.keys(map || {}).forEach(function (id) {
          store.put({ id: id, dataUrl: map[id], createdAt: App.util.now() });
        });
      });
    },

    /* מנקה תמונות שאף פגישה כבר לא מפנה אליהן. */
    prune: function (usedIds) {
      var keep = {};
      (usedIds || []).forEach(function (id) { keep[id] = true; });
      return transact('readwrite', function (store) {
        var req = store.getAllKeys();
        req.onsuccess = function () {
          (req.result || []).forEach(function (id) { if (!keep[id]) store.delete(id); });
        };
      });
    }
  };

  App.photos = photos;
})(window.App);
